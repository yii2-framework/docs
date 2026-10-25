import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { run } from "./catalog-import.mjs";
import { COMMITS, fixture, fixtureFetch } from "./fixtures/packagist/fetch.mjs";
import {
  blobUrl,
  buildRecord,
  chooseRevision,
  deriveDocsUrl,
  deriveEcosystems,
  deriveFamily,
  deriveKind,
  deriveMaintainer,
  expandVersions,
  formatRecord,
  humanName,
  isPlaceholder,
  licenseFrom,
  mergeCurated,
  normalizeRepository,
  parseStability,
  rawUrl,
  RECORD_KEYS,
  statsFrom,
  summaryFrom,
} from "./lib/catalog-import.mjs";
import { createClient, USER_AGENT } from "./lib/packagist.mjs";

const CATALOG = fileURLToPath(new URL("../src/data/catalog/", import.meta.url));
/** Records as they were before the migration to releases (bootstrap5 pins its master branch). */
const RECORDS = fileURLToPath(
  new URL("./fixtures/packagist/records/", import.meta.url),
);
const TODAY = "2026-10-25";
const versions = (name, id) => expandVersions(fixture(name).packages[id]);
const queueTags = () =>
  versions("yiisoft--yii2-queue.p2.json", "yiisoft/yii2-queue");
const temporary = [];

after(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

/** A copy of the real catalog directory, so validation runs against the other records. */
function catalogCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "catalog-import-"));
  temporary.push(dir);
  cpSync(CATALOG, dir, { recursive: true });
  return dir;
}

function output() {
  let text = "";
  return {
    write(chunk) {
      text += chunk;
    },
    get text() {
      return text;
    },
  };
}

/** Runs the CLI offline; returns the exit status, outputs and the fake fetch. */
async function importCli(argv, { catalogDir = catalogCopy(), routes } = {}) {
  const fetch = fixtureFetch(routes);
  const stdout = output();
  const stderr = output();
  const status = await run(argv, {
    client: createClient({ fetch, token: "secret-token" }),
    catalogDir,
    today: TODAY,
    stdout,
    stderr,
  });
  return {
    status,
    stdout: stdout.text,
    stderr: stderr.text,
    fetch,
    catalogDir,
  };
}

test("expandVersions applies cumulative shallow diffs and __unset like MetadataMinifier::expand", () => {
  const tags = queueTags();
  assert.equal(tags.length, 10);
  assert.deepEqual(tags.map((meta) => meta.version).slice(6, 10), [
    "2.3.2",
    "2.3.1",
    "2.3.0",
    "2.2.1",
  ]);
  assert.ok(tags.every((meta) => meta.name === "yiisoft/yii2-queue"));
  assert.ok(Object.hasOwn(tags[7], "funding"));
  assert.ok(!Object.hasOwn(tags[8], "funding"), "2.3.0 unsets funding");
  assert.ok(!Object.hasOwn(tags[9], "funding"), "the unset key stays absent");
  assert.equal(tags[0].source.reference, COMMITS.queue);
  tags[1].name = "changed";
  assert.equal(tags[2].name, "yiisoft/yii2-queue", "versions are copies");

  const dev = versions("yiisoft--yii2-queue.dev.json", "yiisoft/yii2-queue");
  assert.equal(dev[0]["default-branch"], true);
  assert.ok(!Object.hasOwn(dev[1], "default-branch"));
  assert.deepEqual(expandVersions([]), []);
  assert.throws(() => expandVersions("404 not found"), /version list/);
});

test("parseStability ports Composer's VersionParser::parseStability", () => {
  const cases = {
    "2.3.8.0": "stable",
    "1.8.0.0-patch1": "stable",
    "1.0.0.0-pl2": "stable",
    "1.0.0.0-p1": "stable",
    "2.1.1.0-RC2": "RC",
    "1.0.0.0-beta": "beta",
    "1.0.0.0-b2": "beta",
    "0.1.0.0-alpha3": "alpha",
    "3.0.0.0-alpha1#abc": "alpha",
    "dev-main": "dev",
    "22.0.9999999.9999999-dev": "dev",
    "1.0.0.0-beta1-dev": "dev",
  };
  for (const [version, expected] of Object.entries(cases))
    assert.equal(parseStability(version), expected, version);
});

test("chooseRevision pins the first stable tag in list order, else the default branch", () => {
  const pjax = versions("yiisoft--jquery-pjax.p2.json", "yiisoft/jquery-pjax");
  const first = chooseRevision(pjax, []);
  assert.equal(first.kind, "release");
  assert.equal(first.ref, "v2.0.5", "the v prefix of the tag is kept");
  assert.match(first.commit, /^[a-f0-9]{40}$/);
  assert.equal(chooseRevision(pjax.slice(6), []).ref, "v1.8.0-patch1");

  const yii2dev = versions("yiisoft--yii2-dev.p2.json", "yiisoft/yii2-dev");
  assert.equal(yii2dev[0].version, "3.0.0-alpha1");
  assert.equal(chooseRevision(yii2dev, []).ref, "2.0.55");

  const alphaOnly = yii2dev.slice(0, 1);
  assert.throws(() => chooseRevision(alphaOnly, []), /only pre-release tags/);
  const allowed = chooseRevision(alphaOnly, [], { allowPrerelease: true });
  assert.equal(allowed.ref, "3.0.0-alpha1");
  assert.equal(allowed.prerelease, true);

  const nestedDev = versions(
    "yii2-extensions--nested-sets-behavior.dev.json",
    "yii2-extensions/nested-sets-behavior",
  );
  const source = chooseRevision([], nestedDev);
  assert.equal(source.kind, "source");
  assert.equal(source.ref, "main");
  const queueDev = versions(
    "yiisoft--yii2-queue.dev.json",
    "yiisoft/yii2-queue",
  );
  assert.equal(chooseRevision([], queueDev).ref, "master");
  assert.throws(() => chooseRevision([], []), /no tag and no default branch/);
  assert.throws(
    () =>
      chooseRevision([{ version: "1.0.0", version_normalized: "1.0.0.0" }], []),
    /no full commit SHA/,
  );
});

test("normalizeRepository returns an HTTPS URL without .git or a trailing slash", () => {
  assert.equal(
    normalizeRepository("https://bitbucket.org/miniframe/social-login.git"),
    "https://bitbucket.org/miniframe/social-login",
  );
  assert.equal(
    normalizeRepository("git@github.com:yiisoft/yii2-queue.git"),
    "https://github.com/yiisoft/yii2-queue",
  );
  assert.equal(
    normalizeRepository("http://GitHub.com/yiisoft/yii2-queue/"),
    "https://github.com/yiisoft/yii2-queue",
  );
  assert.throws(
    () => normalizeRepository("https://github.com/yiisoft"),
    /owner/,
  );
  assert.throws(() => normalizeRepository(""), /no repository/);
  assert.throws(() => normalizeRepository("ftp://example.com/a/b"), /invalid/);
});

test("blobUrl and rawUrl follow the GitHub, GitLab and Bitbucket shapes and refuse other hosts", () => {
  const sha = COMMITS.miniframe;
  assert.equal(
    blobUrl("https://github.com/o/r", sha, "docs/guide/en/README.md"),
    `https://github.com/o/r/blob/${sha}/docs/guide/en/README.md`,
  );
  assert.equal(
    rawUrl("https://github.com/o/r", sha, "composer.json"),
    `https://raw.githubusercontent.com/o/r/${sha}/composer.json`,
  );
  assert.equal(
    blobUrl("https://gitlab.com/ns/p", sha, "README.md"),
    `https://gitlab.com/ns/p/-/blob/${sha}/README.md`,
  );
  assert.equal(
    rawUrl("https://gitlab.com/ns/p", sha, "composer.json"),
    `https://gitlab.com/ns/p/-/raw/${sha}/composer.json`,
  );
  assert.equal(
    blobUrl("https://bitbucket.org/w/r", sha, "README.md"),
    `https://bitbucket.org/w/r/src/${sha}/README.md`,
  );
  assert.equal(
    rawUrl("https://bitbucket.org/w/r", sha, "composer.json"),
    `https://bitbucket.org/w/r/raw/${sha}/composer.json`,
  );
  assert.throws(
    () => blobUrl("https://git.drupalcode.org/project/x", sha, "README.md"),
    /unsupported Git host/,
  );
  assert.throws(
    () => rawUrl("https://github.com/o/r", "main", "x"),
    /invalid commit/,
  );
});

test("deriveEcosystems maps yiisoft/yii2 to yii2, Yii3 yiisoft packages to yii3 and the rest to php", () => {
  const evidence = "https://github.com/o/r/blob/sha/composer.json";
  assert.deepEqual(
    deriveEcosystems(
      fixture("yiisoft--yii2-queue.composer.json").require,
      evidence,
    ),
    {
      ecosystems: ["yii2"],
      compatibility: [{ ecosystem: "yii2", constraint: "~2.0.14", evidence }],
      php: ">=5.5.0",
    },
  );
  assert.deepEqual(
    deriveEcosystems(
      fixture("yiisoft--bootstrap5.composer.json").require,
      evidence,
    ).compatibility[0],
    {
      ecosystem: "yii3",
      constraint: "yiisoft/html ^3.13 || ^4.0; yiisoft/widget ^2.0",
      evidence,
    },
  );
  const php = deriveEcosystems(
    { php: ">=8.1", "yiisoft/yii2-bootstrap5": "^2.0" },
    evidence,
  );
  assert.deepEqual(php.ecosystems, ["php"]);
  assert.equal(php.compatibility[0].constraint, ">=8.1");
  assert.equal(
    deriveEcosystems(
      fixture("miniframe--social-login.composer.json").require,
      evidence,
    ).php,
    ">=7.3",
  );
  assert.throws(
    () => deriveEcosystems({ "yiisoft/yii2": "~2.0" }, evidence),
    /no PHP requirement/,
  );
  assert.throws(() => deriveEcosystems(undefined, evidence), /no require/);
});

test("deriveDocsUrl prefers support.docs, then a documentation homepage, then the README at the commit", () => {
  const repo = "https://github.com/o/r";
  const sha = COMMITS.queue;
  assert.deepEqual(
    deriveDocsUrl(
      fixture("yiisoft--yii2-queue.composer.json"),
      null,
      repo,
      sha,
      "README.md",
    ),
    {
      url: "https://github.com/yiisoft/yii2-queue/blob/master/docs/guide",
      source: "support.docs",
    },
  );
  assert.deepEqual(
    deriveDocsUrl(
      fixture("miniframe--social-login.composer.json"),
      null,
      "https://bitbucket.org/miniframe/social-login",
      sha,
      "README.md",
    ),
    { url: "https://miniframe.dev/", source: "homepage" },
  );
  const readme = { url: `${repo}/blob/${sha}/README.md`, source: "readme" };
  for (const homepage of [
    "https://github.com/o/r",
    "https://github.com/o/r#readme",
    "https://github.com/someone/else",
    "https://www.yiiframework.com/",
    "https://packagist.org/packages/o/r",
    "http://docs.example.com/",
  ])
    assert.deepEqual(
      deriveDocsUrl({ homepage }, null, repo, sha, "README.md"),
      readme,
      homepage,
    );
  assert.deepEqual(
    deriveDocsUrl(
      {},
      { homepage: "https://docs.example.com/r/" },
      repo,
      sha,
      null,
    ),
    { url: "https://docs.example.com/r/", source: "homepage" },
  );
  assert.deepEqual(deriveDocsUrl({}, null, repo, sha, null), {
    url: repo,
    source: "repository",
  });
});

test("deriveMaintainer uses an author's GitHub profile, else the repository owner", () => {
  assert.deepEqual(
    deriveMaintainer(
      fixture("yii2-extensions--nested-sets-behavior.composer.json"),
      "https://github.com/yii2-extensions/nested-sets-behavior",
    ),
    {
      name: "Wilmer Arambula",
      url: "https://github.com/terabytesoftw",
      source: "author",
    },
  );
  assert.deepEqual(
    deriveMaintainer(
      fixture("yiisoft--yii2-queue.composer.json"),
      "https://github.com/yiisoft/yii2-queue",
    ),
    { name: "yiisoft", url: "https://github.com/yiisoft", source: "owner" },
  );
  assert.deepEqual(
    deriveMaintainer(
      fixture("miniframe--social-login.composer.json"),
      "https://bitbucket.org/miniframe/social-login",
    ),
    {
      name: "miniframe",
      url: "https://bitbucket.org/miniframe",
      source: "owner",
    },
  );
  assert.equal(
    deriveMaintainer({ authors: null }, "https://github.com/o/r").name,
    "o",
  );
});

test("deriveFamily follows the maintained collections and the validator's relationship rules", () => {
  for (const vendor of ["yii2-extensions", "php-forge", "ui-awesome"]) {
    assert.deepEqual(deriveFamily(vendor), {
      family: vendor,
      relationship: "maintained",
    });
    assert.deepEqual(deriveFamily(vendor, "community"), {
      family: vendor,
      relationship: "maintained",
    });
    assert.equal(
      deriveFamily(vendor, "contributed").relationship,
      "contributed",
    );
  }
  assert.deepEqual(deriveFamily("yiisoft"), {
    family: "community",
    relationship: "community",
  });
  assert.deepEqual(deriveFamily("yiisoft", "contributed"), {
    family: "community",
    relationship: "contributed",
  });
  assert.throws(
    () => deriveFamily("yiisoft", "maintained"),
    /not a maintained collection/,
  );
  assert.throws(() => deriveFamily("yiisoft", "owner"), /unknown relationship/);
});

test("deriveKind, humanName and the small text helpers", () => {
  assert.equal(deriveKind("yii2-extension"), "extension");
  assert.equal(deriveKind("project"), "template");
  assert.equal(deriveKind("phpstan-extension"), "tool");
  assert.equal(deriveKind("composer-plugin"), "tool");
  assert.equal(deriveKind("library"), "library");
  assert.equal(deriveKind(undefined), "library");
  assert.equal(humanName("yiisoft/yii2-queue"), "Queue");
  assert.equal(
    humanName("yii2-extensions/nested-sets-behavior"),
    "Nested sets behavior",
  );
  assert.equal(humanName("php-forge/vite"), "Vite");
  assert.equal(humanName("yiisoft/yii2"), "Yii2");
  assert.ok(isPlaceholder("_____"));
  assert.ok(isPlaceholder(""));
  assert.ok(isPlaceholder(undefined));
  assert.ok(isPlaceholder("TODO"));
  assert.ok(!isPlaceholder("Queue extension."));
  assert.equal(summaryFrom("  Vite  integration "), "Vite integration.");
  assert.equal(summaryFrom("Done!"), "Done!");
  assert.equal(licenseFrom(["BSD-3-Clause"]), "BSD-3-Clause");
  assert.equal(licenseFrom(["MIT", "GPL-2.0-only"]), "MIT OR GPL-2.0-only");
  assert.equal(licenseFrom("BSD-3-Clause"), "BSD-3-Clause");
  assert.equal(licenseFrom(null), null);
  assert.deepEqual(
    statsFrom(fixture("yiisoft--yii2-queue.package.json").package, TODAY),
    {
      downloadsMonthly: 332838,
      downloadsTotal: 12262582,
      favers: 1084,
      fetchedAt: TODAY,
    },
  );
  assert.equal(statsFrom({ downloads: {} }, TODAY), null);
});

test("formatRecord reproduces every catalog record byte for byte", () => {
  for (const dir of [CATALOG, RECORDS]) {
    for (const name of readdirSync(dir).filter((file) =>
      file.endsWith(".json"),
    )) {
      const text = readFileSync(path.join(dir, name), "utf8");
      assert.equal(formatRecord(JSON.parse(text)), text, name);
    }
  }
});

test("formatRecord keeps a scalar array inline up to 80 columns including the comma", () => {
  const fits = ["a".repeat(10), "a".repeat(49)];
  assert.equal(
    formatRecord({ tags: fits, x: 1 }),
    `{\n    "tags": ["${fits[0]}", "${fits[1]}"],\n    "x": 1\n}\n`,
  );
  const long = ["a".repeat(10), "a".repeat(50)];
  assert.equal(
    formatRecord({ tags: long, x: 1 }),
    `{\n    "tags": [\n        "${long[0]}",\n        "${long[1]}"\n    ],\n    "x": 1\n}\n`,
  );
  assert.equal(
    formatRecord({ x: 1, tags: long }),
    `{\n    "x": 1,\n    "tags": ["${long[0]}", "${long[1]}"]\n}\n`,
    "the last member has no comma",
  );
  assert.equal(
    formatRecord({ a: [], b: {} }),
    '{\n    "a": [],\n    "b": {}\n}\n',
  );
});

test("buildRecord writes the catalog key order and leaves out absent stats", () => {
  const record = JSON.parse(
    readFileSync(path.join(RECORDS, "yiisoft--bootstrap5.json"), "utf8"),
  );
  const shuffled = Object.fromEntries(Object.entries(record).reverse());
  assert.deepEqual(
    Object.keys(buildRecord(shuffled)),
    RECORD_KEYS.slice(0, -1),
  );
  assert.deepEqual(
    Object.keys(
      buildRecord({
        ...record,
        stats: statsFrom(
          { downloads: { monthly: 1, total: 2 }, favers: 0 },
          TODAY,
        ),
      }),
    ),
    RECORD_KEYS,
  );
  const { php, ...missing } = record;
  void php;
  assert.throws(() => buildRecord(missing), /field php is missing/);
});

test("mergeCurated keeps curated fields, re-derives constraints and moves links at the old commit", () => {
  const existing = JSON.parse(
    readFileSync(path.join(RECORDS, "yiisoft--bootstrap5.json"), "utf8"),
  );
  const composer = fixture("yiisoft--bootstrap5.composer.json");
  const repo = "https://github.com/yiisoft/bootstrap5";
  const evidence = blobUrl(repo, COMMITS.bootstrap5, "composer.json");
  const generated = buildRecord({
    ...existing,
    name: "Bootstrap5",
    summary: "Generated.",
    maintainer: { name: "yiisoft", url: "https://github.com/yiisoft" },
    ...deriveEcosystems(composer.require, evidence),
    docsUrl: blobUrl(repo, COMMITS.bootstrap5, "README.md"),
    relationshipEvidence: evidence,
    provenance: {
      ref: "1.2.0",
      commit: COMMITS.bootstrap5,
      reviewedAt: TODAY,
      url: evidence,
      kind: "release",
    },
  });
  const { record, changes, moves } = mergeCurated(
    existing,
    generated,
    composer.require,
  );
  for (const key of [
    "name",
    "summary",
    "family",
    "topic",
    "tags",
    "maintainer",
    "kind",
  ])
    assert.deepEqual(record[key], existing[key], key);
  assert.deepEqual(record.compatibility, [
    {
      ecosystem: "yii3",
      constraint: "yiisoft/html ^3.13 || ^4.0; yiisoft/widget ^2.0",
      evidence,
    },
  ]);
  assert.deepEqual(changes, [
    "yii3 constraint: yiisoft/html ^3.0; yiisoft/widget ^2.0 -> yiisoft/html ^3.13 || ^4.0; yiisoft/widget ^2.0",
  ]);
  assert.equal(
    record.docsUrl,
    `${repo}/blob/${COMMITS.bootstrap5}/docs/guide/en/README.md`,
  );
  assert.equal(
    record.relationshipEvidence,
    `${repo}/blob/${COMMITS.bootstrap5}/README.md`,
  );
  assert.deepEqual(
    moves.map((move) => [move.field, move.path]),
    [
      ["relationshipEvidence", "README.md"],
      ["docsUrl", "docs/guide/en/README.md"],
    ],
  );
  assert.deepEqual(record.provenance, generated.provenance);

  const local = { ...existing, docsUrl: "/extensions/bootstrap5/" };
  assert.equal(
    mergeCurated(local, generated, composer.require).record.docsUrl,
    "/extensions/bootstrap5/",
  );
  const elsewhere = {
    ...existing,
    docsUrl: "https://docs.example.com/bootstrap5/",
  };
  assert.equal(
    mergeCurated(elsewhere, generated, composer.require).record.docsUrl,
    "https://docs.example.com/bootstrap5/",
  );
  assert.throws(
    () =>
      mergeCurated(
        { ...existing, ecosystems: ["yii2"] },
        generated,
        composer.require,
      ),
    /kept ecosystem yii2 cannot be derived at 1\.2\.0/,
  );
});

test("the client sends the User-Agent, treats Packagist 404 strings as missing and caches responses", async () => {
  const fetch = fixtureFetch({
    "https://api.github.com/repos/o/r": { status: 200, body: "{}" },
    "https://repo.packagist.org/p2/broken/broken.json": {
      status: 503,
      body: "busy",
    },
  });
  const client = createClient({ fetch, token: "secret-token" });
  assert.equal(await client.tags("yii2-extensions/template"), null);
  assert.equal(await client.info("yii2-extensions/template"), null);
  assert.equal((await client.tags("yiisoft/yii2-queue")).length, 10);
  await client.tags("yiisoft/yii2-queue");
  await client.json("https://api.github.com/repos/o/r");
  await assert.rejects(client.tags("broken/broken"), /HTTP 503/);
  assert.equal(
    fetch.calls.filter((call) =>
      call.url.endsWith("p2/yiisoft/yii2-queue.json"),
    ).length,
    1,
  );
  assert.ok(
    fetch.calls.every((call) => call.headers["User-Agent"] === USER_AGENT),
  );
  for (const call of fetch.calls)
    assert.equal(
      call.headers.Authorization,
      new URL(call.url).hostname === "api.github.com"
        ? "Bearer secret-token"
        : undefined,
      call.url,
    );
  const anonymous = fixtureFetch({
    "https://api.github.com/repos/o/r": { status: 200, body: "{}" },
  });
  await createClient({ fetch: anonymous, token: "" }).json(
    "https://api.github.com/repos/o/r",
  );
  assert.equal(anonymous.calls[0].headers.Authorization, undefined);
});

test("the client probes README names in order, falls back to GET on 405 and reports timeouts", async () => {
  const sha = COMMITS.queue;
  const repo = "https://github.com/o/r";
  const fetch = fixtureFetch({
    [`https://raw.githubusercontent.com/o/r/${sha}/README`]: {
      status: 200,
      body: "",
    },
  });
  assert.equal(await createClient({ fetch }).readmePath(repo, sha), "README");
  assert.deepEqual(
    fetch.calls.map((call) => call.url.split("/").pop()),
    ["README.md", "readme.md", "README"],
  );
  let calls = 0;
  const notAllowed = async (url, init) => {
    calls += 1;
    return new Response(init.method === "HEAD" ? null : "x", {
      status: init.method === "HEAD" ? 405 : 200,
    });
  };
  assert.equal(
    await createClient({ fetch: notAllowed }).exists(repo, sha, "README.md"),
    true,
  );
  assert.equal(calls, 2);
  const slow = async () => {
    throw new DOMException("The operation timed out.", "TimeoutError");
  };
  await assert.rejects(
    createClient({ fetch: slow, timeout: 5 }).tags("o/r"),
    /timed out after 5 ms/,
  );
});

test("imports a new package with derived fields, a Review list and no GitHub API call", async () => {
  const result = await importCli([
    "yiisoft/yii2-queue",
    "--topic=background-integrations",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const file = path.join(result.catalogDir, "yiisoft--yii2-queue.json");
  const text = readFileSync(file, "utf8");
  const record = JSON.parse(text);
  assert.equal(text, formatRecord(record));
  assert.deepEqual(Object.keys(record), RECORD_KEYS);
  const evidence = `https://github.com/yiisoft/yii2-queue/blob/${COMMITS.queue}/composer.json`;
  assert.deepEqual(record, {
    id: "yiisoft/yii2-queue",
    name: "Queue",
    summary:
      "Yii2 Queue Extension which supports queues based on DB, Redis, RabbitMQ, Beanstalk, SQS, and Gearman.",
    family: "community",
    topic: "background-integrations",
    tags: [
      "queue",
      "async",
      "gii",
      "db",
      "redis",
      "rabbitmq",
      "beanstalk",
      "gearman",
    ],
    ecosystems: ["yii2"],
    kind: "extension",
    php: ">=5.5.0",
    compatibility: [{ ecosystem: "yii2", constraint: "~2.0.14", evidence }],
    docsUrl: "https://github.com/yiisoft/yii2-queue/blob/master/docs/guide",
    repository: "https://github.com/yiisoft/yii2-queue",
    license: "BSD-3-Clause",
    maintainer: { name: "yiisoft", url: "https://github.com/yiisoft" },
    relationship: "community",
    relationshipEvidence: evidence,
    provenance: {
      ref: "2.3.8",
      commit: COMMITS.queue,
      reviewedAt: TODAY,
      url: evidence,
      kind: "release",
    },
    stats: {
      downloadsMonthly: 332838,
      downloadsTotal: 12262582,
      favers: 1084,
      fetchedAt: TODAY,
    },
  });
  assert.match(result.stdout, /release 2\.3\.8 \(e0f935e5/);
  assert.match(result.stdout, /Review:\n- name: "Queue" was guessed/);
  assert.match(
    result.stdout,
    /docsUrl: support\.docs of composer\.json; it points at a branch/,
  );
  assert.match(
    result.stdout,
    /kind: extension, guessed from the composer type "yii2-extension"/,
  );
  assert.match(
    result.stdout,
    /maintainer: no author has a GitHub profile homepage/,
  );
  assert.match(result.stdout, /Wrote .*yiisoft--yii2-queue\.json/);
  assert.ok(
    result.fetch.calls.every((call) => !call.url.includes("api.github.com")),
  );
});

test("--dry-run prints the record and writes nothing; --tags and --date override the derived values", async () => {
  const result = await importCli([
    "yiisoft/yii2-queue",
    "--topic=background-integrations",
    "--tags=queue,jobs",
    "--date=2026-10-20",
    "--dry-run",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    !existsSync(path.join(result.catalogDir, "yiisoft--yii2-queue.json")),
  );
  const record = JSON.parse(
    result.stdout.slice(0, result.stdout.indexOf("\n}\n") + 3),
  );
  assert.deepEqual(record.tags, ["queue", "jobs"]);
  assert.equal(record.provenance.reviewedAt, "2026-10-20");
  assert.equal(record.stats.fetchedAt, "2026-10-20");
  assert.match(result.stdout, /Dry run: nothing written\./);
  assert.doesNotMatch(result.stdout, /tags: normalised/);
});

test("imports a Bitbucket package with a documentation homepage", async () => {
  const result = await importCli([
    "miniframe/social-login",
    "--topic=security-auth",
    "--relationship=contributed",
    "--dry-run",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const record = JSON.parse(
    result.stdout.slice(0, result.stdout.indexOf("\n}\n") + 3),
  );
  const blob = `https://bitbucket.org/miniframe/social-login/src/${COMMITS.miniframe}`;
  assert.equal(
    record.repository,
    "https://bitbucket.org/miniframe/social-login",
  );
  assert.equal(record.provenance.url, `${blob}/composer.json`);
  assert.equal(record.provenance.ref, "v1.1.0");
  assert.deepEqual(record.ecosystems, ["php"]);
  assert.equal(record.php, ">=7.3");
  assert.equal(record.license, "CC-BY-SA-4.0");
  assert.equal(record.docsUrl, "https://miniframe.dev/");
  assert.deepEqual(record.maintainer, {
    name: "miniframe",
    url: "https://bitbucket.org/miniframe",
  });
  assert.equal(record.family, "community");
  assert.equal(record.relationship, "contributed");
  assert.equal(record.tags.length, 8);
  assert.match(result.stdout, /docsUrl: the composer\.json homepage/);
  assert.match(
    result.stdout,
    /relationshipEvidence: composer\.json at the commit/,
  );
});

test("--update keeps curated fields, re-pins the newest stable tag and moves evidence", async () => {
  const catalogDir = catalogCopy();
  const file = path.join(
    catalogDir,
    "yii2-extensions--nested-sets-behavior.json",
  );
  const old = COMMITS.nestedOld;
  const current = JSON.parse(readFileSync(file, "utf8"));
  const blob = `https://github.com/yii2-extensions/nested-sets-behavior/blob/${old}/composer.json`;
  const before = {
    ...current,
    php: ">=8.1",
    compatibility: [
      { ecosystem: "yii2", constraint: "^2.0.53|^22", evidence: blob },
    ],
    relationshipEvidence: blob,
    provenance: {
      ref: "main",
      commit: old,
      reviewedAt: "2026-10-18",
      url: blob,
      kind: "source",
    },
  };
  writeFileSync(file, formatRecord(before));
  const result = await importCli(
    ["yii2-extensions/nested-sets-behavior", "--update", "--date=2026-10-25"],
    { catalogDir },
  );
  assert.equal(result.status, 0, result.stderr);
  const record = JSON.parse(readFileSync(file, "utf8"));
  const evidence = `https://github.com/yii2-extensions/nested-sets-behavior/blob/${COMMITS.nested}/composer.json`;
  for (const key of [
    "name",
    "summary",
    "family",
    "topic",
    "tags",
    "relationship",
    "kind",
    "maintainer",
    "ecosystems",
    "docsUrl",
  ])
    assert.deepEqual(record[key], current[key], key);
  assert.equal(record.php, ">=8.3");
  assert.deepEqual(record.compatibility, [
    { ecosystem: "yii2", constraint: "~2.0.55 || ^22.0@dev", evidence },
  ]);
  assert.equal(record.relationshipEvidence, evidence);
  assert.deepEqual(record.provenance, {
    ref: "0.2.0",
    commit: COMMITS.nested,
    reviewedAt: "2026-10-25",
    url: evidence,
    kind: "release",
  });
  assert.deepEqual(record.stats, {
    downloadsMonthly: 27,
    downloadsTotal: 504,
    favers: 3,
    fetchedAt: "2026-10-25",
  });
  assert.match(
    result.stdout,
    /changed yii2 constraint: \^2\.0\.53\|\^22 -> ~2\.0\.55 \|\| \^22\.0@dev/,
  );
  assert.match(result.stdout, /changed php: >=8\.1 -> >=8\.3/);
  assert.ok(
    result.fetch.calls.some(
      (call) =>
        call.method === "HEAD" &&
        call.url.endsWith(`${COMMITS.nested}/composer.json`),
    ),
    "the moved evidence is checked at the new commit",
  );
});

test("--update keeps the curated tags when the keywords leave none; --tags still needs one", async () => {
  const url = `https://raw.githubusercontent.com/yii2-extensions/nested-sets-behavior/${COMMITS.nested}/composer.json`;
  const composer = fixture(
    "yii2-extensions--nested-sets-behavior.composer.json",
  );
  const routes = {
    [url]: {
      status: 200,
      body: JSON.stringify({
        ...composer,
        keywords: ["yii2", "yii2-extension"],
      }),
    },
  };
  const catalogDir = catalogCopy();
  const file = path.join(
    catalogDir,
    "yii2-extensions--nested-sets-behavior.json",
  );
  const tags = JSON.parse(readFileSync(file, "utf8")).tags;
  const argv = ["yii2-extensions/nested-sets-behavior", "--update"];
  let result = await importCli(argv, { catalogDir, routes });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")).tags, tags);
  result = await importCli([...argv, "--tags=,"], { catalogDir, routes });
  assert.match(result.stderr, /no usable keywords for tags; pass --tags=/);
});

test("--update refuses a moved link whose file is gone at the new revision", async () => {
  const catalogDir = catalogCopy();
  const file = path.join(catalogDir, "yiisoft--bootstrap5.json");
  const record = JSON.parse(
    readFileSync(path.join(RECORDS, "yiisoft--bootstrap5.json"), "utf8"),
  );
  record.docsUrl = record.docsUrl.replace(
    "docs/guide/en/README.md",
    "docs/missing.md",
  );
  writeFileSync(file, formatRecord(record));
  const result = await importCli(["yiisoft/bootstrap5", "--update"], {
    catalogDir,
  });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /docsUrl names docs\/missing\.md, which does not exist at 1\.2\.0/,
  );
});

test("refuses what it cannot import, one line per problem on stderr", async () => {
  const cases = [
    [
      ["yiisoft/yii2-queue"],
      /--topic is required for a new record; one of: forms-widgets/,
    ],
    [["yiisoft/yii2-queue", "--topic=missing"], /unknown topic missing/],
    [
      ["Yiisoft/Queue", "--topic=html-views"],
      /expected a lowercase vendor\/package/,
    ],
    [
      ["yiisoft/yii2-queue", "--topic=html-views", "--date=2026-02-31"],
      /expected a valid YYYY-MM-DD date/,
    ],
    [
      ["yiisoft/yii2-queue", "--topic=html-views", "--bogus"],
      /unknown or empty option --bogus/,
    ],
    [
      ["yii2-extensions/nested-sets-behavior", "--topic=data-modelling"],
      /already in the catalog \(yii2-extensions--nested-sets-behavior\.json\); use --update/,
    ],
    [["yiisoft/yii2-queue", "--update"], /has no catalog record to update/],
    [
      ["yii2-extensions/template", "--update"],
      /yii2-extensions\/template is not on Packagist; add the record manually, see \/contribute\//,
    ],
    [
      ["yiisoft/db-redis", "--topic=data-modelling"],
      /abandoned on Packagist without a suggested replacement/,
    ],
    [
      ["swiftmailer/swiftmailer", "--topic=background-integrations"],
      /abandoned on Packagist; it suggests symfony\/mailer instead/,
    ],
    [
      [
        "yiisoft/yii2-queue",
        "--topic=background-integrations",
        "--relationship=maintained",
      ],
      /not a maintained collection/,
    ],
    [
      [
        "yiisoft/yii2-queue",
        "--topic=background-integrations",
        "--tags=php,queue",
      ],
      /tag php is on the stop list/,
    ],
  ];
  for (const [argv, message] of cases) {
    const result = await importCli(argv);
    assert.equal(result.status, 1, argv.join(" "));
    assert.match(result.stderr, message, argv.join(" "));
    assert.match(result.stderr, /^\[catalog-import\] /);
    assert.equal(result.stdout, "");
  }
});

test("refuses placeholder metadata, a renamed composer.json and keywords that leave no tag", async () => {
  const url = `https://raw.githubusercontent.com/yiisoft/yii2-queue/${COMMITS.queue}/composer.json`;
  const composer = fixture("yiisoft--yii2-queue.composer.json");
  const serve = (data) => ({
    [url]: { status: 200, body: JSON.stringify(data) },
  });
  const argv = ["yiisoft/yii2-queue", "--topic=background-integrations"];
  let result = await importCli(argv, {
    routes: serve({ ...composer, description: "_____" }),
  });
  assert.match(
    result.stderr,
    /empty or placeholder description; add the record manually/,
  );
  result = await importCli(argv, {
    routes: serve({ ...composer, name: "other/name" }),
  });
  assert.match(result.stderr, /composer\.json at e0f935e5.* names other\/name/);
  result = await importCli(argv, {
    routes: serve({ ...composer, keywords: ["yii", "_____"] }),
  });
  assert.match(result.stderr, /no usable keywords for tags; pass --tags=/);
  result = await importCli(argv, {
    routes: serve({ ...composer, license: [] }),
  });
  assert.match(result.stderr, /declares no license/);
  result = await importCli(argv, {
    routes: { [url]: { status: 404, body: "404: Not Found" } },
  });
  assert.match(
    result.stderr,
    /no composer\.json in https:\/\/github\.com\/yiisoft\/yii2-queue/,
  );
});

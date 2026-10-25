import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { formatSummary, parseArgs, run } from "./catalog-refresh.mjs";
import { COMMITS, fixtureFetch } from "./fixtures/packagist/fetch.mjs";
import { createClient } from "./lib/packagist.mjs";

/** Records as they were before the migration to releases: bootstrap5 pins a branch, nested-sets has no stats. */
const RECORDS = fileURLToPath(
  new URL("./fixtures/packagist/records/", import.meta.url),
);
const TODAY = "2026-10-30";
const temporary = [];

after(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

/** A catalog directory with copies of the named records (plus `extra` files written as given). */
function catalog(names, extra = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "catalog-refresh-"));
  temporary.push(dir);
  for (const name of names)
    copyFileSync(path.join(RECORDS, name), path.join(dir, name));
  for (const [name, text] of Object.entries(extra))
    writeFileSync(path.join(dir, name), text);
  return dir;
}

const read = (dir, name) =>
  JSON.parse(readFileSync(path.join(dir, name), "utf8"));

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

async function refresh(argv, catalogDir, today = TODAY) {
  const fetch = fixtureFetch();
  const stdout = output();
  const stderr = output();
  const status = await run(argv, {
    client: createClient({ fetch }),
    catalogDir,
    today,
    stdout,
    stderr,
  });
  return { status, stdout: stdout.text, stderr: stderr.text, fetch };
}

const records = [
  "yii2-extensions--nested-sets-behavior.json",
  "yii2-extensions--template.json",
  "yiisoft--bootstrap5.json",
];

test("re-imports a record whose newest stable tag changed and refreshes stale or missing stats only", async () => {
  const dir = catalog(records);
  const nestedBefore = read(dir, records[0]);
  const templateBefore = readFileSync(path.join(dir, records[1]), "utf8");
  const summaryFile = path.join(dir, "summary.md");
  const result = await refresh([`--summary=${summaryFile}`], dir);
  assert.equal(result.status, 0, result.stderr);

  const bootstrap5 = read(dir, records[2]);
  assert.deepEqual(bootstrap5.provenance, {
    ref: "1.2.0",
    commit: COMMITS.bootstrap5,
    reviewedAt: TODAY,
    url: `https://github.com/yiisoft/bootstrap5/blob/${COMMITS.bootstrap5}/composer.json`,
    kind: "release",
  });
  assert.equal(
    bootstrap5.name,
    "Bootstrap 5 for Yii3",
    "curated fields are kept",
  );
  assert.equal(
    bootstrap5.compatibility[0].constraint,
    "yiisoft/html ^3.13 || ^4.0; yiisoft/widget ^2.0",
  );
  assert.equal(bootstrap5.stats.fetchedAt, TODAY);

  const nested = read(dir, records[0]);
  assert.deepEqual(
    nested.provenance,
    nestedBefore.provenance,
    "a stats-only refresh keeps provenance",
  );
  assert.deepEqual(nested.stats, {
    downloadsMonthly: 27,
    downloadsTotal: 504,
    favers: 3,
    fetchedAt: TODAY,
  });
  assert.equal(
    readFileSync(path.join(dir, records[1]), "utf8"),
    templateBefore,
  );

  assert.equal(readFileSync(summaryFile, "utf8"), result.stdout);
  assert.match(result.stdout, /^## Catalog refresh, 2026-10-30\n/);
  assert.match(result.stdout, /\| Package \| Before \| After \| Changes \|/);
  assert.match(
    result.stdout,
    /\| `yii2-extensions\/nested-sets-behavior` \| 0\.2\.0 \(release\) \| 0\.2\.0 \(release\) \| stats added \|/,
  );
  assert.match(
    result.stdout,
    /\| `yiisoft\/bootstrap5` \| master \(source\) \| 1\.2\.0 \(release\) \| revision; yii3 constraint: .*; relationshipEvidence moved to 1\.2\.0: README\.md; docsUrl moved to 1\.2\.0: docs\/guide\/en\/README\.md; stats \|/,
  );
  assert.match(
    result.stdout,
    /Not on Packagist, kept as manual records: `yii2-extensions\/template`\./,
  );

  const again = await refresh([], dir);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /No record needed a change\./);
  assert.ok(
    again.fetch.calls.every((call) =>
      call.url.includes("repo.packagist.org/p2/"),
    ),
    "fresh records need only the tag list",
  );

  const later = await refresh(["--stats-max-age=3"], dir, "2026-11-02");
  assert.match(
    later.stdout,
    /`yiisoft\/bootstrap5` \| 1\.2\.0 \(release\) \| 1\.2\.0 \(release\) \| stats \|/,
  );
  assert.equal(read(dir, records[2]).provenance.reviewedAt, TODAY);
});

test("--dry-run reports the changes and writes no record", async () => {
  const dir = catalog(records);
  const before = records.map((name) =>
    readFileSync(path.join(dir, name), "utf8"),
  );
  const result = await refresh(["--dry-run"], dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\(dry run\)/);
  assert.match(
    result.stdout,
    /`yiisoft\/bootstrap5` \| master \(source\) \| 1\.2\.0 \(release\)/,
  );
  assert.deepEqual(
    records.map((name) => readFileSync(path.join(dir, name), "utf8")),
    before,
  );
});

const dbRedis = () =>
  readFileSync(
    path.join(RECORDS, "yiisoft--bootstrap5.json"),
    "utf8",
  ).replaceAll("yiisoft/bootstrap5", "yiisoft/db-redis");

test("failures alone exit with status 1 and the summary starts with the Failed section", async () => {
  const text = dbRedis();
  const dir = catalog([], { "yiisoft--db-redis.json": text });
  const result = await refresh([], dir);
  assert.equal(result.status, 1);
  assert.equal(
    readFileSync(path.join(dir, "yiisoft--db-redis.json"), "utf8"),
    text,
  );
  assert.match(
    result.stdout,
    /^## Failed: 1 record\(s\) left unchanged\n\n- `yiisoft\/db-redis`: abandoned on Packagist; review the record by hand\n\n## Catalog refresh, 2026-10-30\n\nNo record needed a change\./,
  );
  assert.match(
    result.stderr,
    /^\[catalog-refresh\] yiisoft\/db-redis: abandoned/,
  );
});

test("failures next to refreshed records exit with status 0 and are listed first in the summary", async () => {
  const text = dbRedis();
  const dir = catalog(["yiisoft--bootstrap5.json"], {
    "yiisoft--db-redis.json": text,
  });
  const summaryFile = path.join(dir, "summary.md");
  const result = await refresh([`--summary=${summaryFile}`], dir);
  assert.equal(result.status, 0, "the refresh pull request must still open");
  assert.equal(readFileSync(summaryFile, "utf8"), result.stdout);
  assert.equal(
    readFileSync(path.join(dir, "yiisoft--db-redis.json"), "utf8"),
    text,
  );
  assert.equal(read(dir, "yiisoft--bootstrap5.json").provenance.ref, "1.2.0");
  assert.match(
    result.stdout,
    /^## Failed: 1 record\(s\) left unchanged\n\n- `yiisoft\/db-redis`: abandoned on Packagist[^\n]*\n\n## Catalog refresh, 2026-10-30\n\n\| Package \|/,
  );
  assert.match(
    result.stdout,
    /\| `yiisoft\/bootstrap5` \| master \(source\) \| 1\.2\.0 \(release\) \|/,
  );
  assert.match(result.stderr, /yiisoft\/db-redis: abandoned/);
});

test("parseArgs and formatSummary", () => {
  assert.deepEqual(parseArgs([]), {
    dryRun: false,
    statsMaxAge: 7,
    summary: null,
  });
  assert.deepEqual(
    parseArgs(["--dry-run", "--stats-max-age=0", "--summary=out.md"]),
    {
      dryRun: true,
      statsMaxAge: 0,
      summary: "out.md",
    },
  );
  assert.throws(() => parseArgs(["--stats-max-age=soon"]), /malformed option/);
  assert.throws(() => parseArgs(["--force"]), /unknown/);
  assert.equal(
    formatSummary(
      {
        rows: [
          {
            id: "a/b",
            before: "main (source)",
            after: "1.0|`x`\n (release)",
            changes: ["revision"],
          },
        ],
        manual: [],
        problems: [],
      },
      { today: TODAY },
    ),
    "## Catalog refresh, 2026-10-30\n\n| Package | Before | After | Changes |\n| --- | --- | --- | --- |\n| `a/b` | main (source) | 1.0\\|x  (release) | revision |\n",
  );
});

test("a malformed option exits with status 1", async () => {
  const result = await refresh(["--bogus"], catalog([]));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown or malformed option --bogus/);
});

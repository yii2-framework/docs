import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { packages } from "../src/lib/catalog.mjs";
import {
  displayOrder,
  hostedPackages,
  hostingFor,
  loadHosting,
} from "../src/lib/hosting.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("../packages.json", import.meta.url), "utf8"),
).filter(({ type }) => type !== "framework");

test("every published or template package of packages.json has a catalog record", () => {
  const ids = new Set(packages.map((pkg) => pkg.id));
  const missing = manifest
    .filter(({ status }) => ["published", "template"].includes(status))
    .filter(({ packagist }) => !ids.has(packagist))
    .map(({ name }) => name);

  assert.deepEqual(missing, []);
});

test("every catalog record with a local extension guide names a packages.json entry", () => {
  const names = new Set(manifest.map(({ name }) => name));
  const unknown = packages
    .map((pkg) => /^\/extensions\/([^/]+)\/$/.exec(pkg.docsUrl)?.[1])
    .filter((name) => name !== undefined && !names.has(name));

  assert.deepEqual(unknown, []);
});

test("the hosting join is read-only and stays out of the catalog loader", () => {
  const source = readFileSync(
    new URL("../src/lib/hosting.mjs", import.meta.url),
    "utf8",
  );

  for (const forbidden of ["writeFileSync", "rmSync", "child_process"]) {
    assert.ok(!source.includes(forbidden), forbidden);
  }

  const hosting = loadHosting();

  assert.ok(Object.isFrozen(hosting));
  assert.throws(() => hosting.set("x/y", {}), /read-only/);
});

test("hosting tolerates a missing skill index and falls back to skillsDir", () => {
  const root = mkdtempSync(path.join(tmpdir(), "hosting-"));

  try {
    const write = (file, content) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), content);
    };

    write(
      "packages.json",
      JSON.stringify([
        { name: "yii2", type: "framework", packagist: "yiisoft/yii2" },
        {
          name: "demo",
          title: "Demo",
          status: "published",
          packagist: "vendor/demo",
          order: ["installation", "missing"],
          demos: true,
          skillsDir: "skills",
        },
      ]),
    );
    write("tools.json", JSON.stringify([{ name: "box", title: "Box" }]));
    write(
      "src/content/docs/extensions/demo/index.md",
      "---\ntitle: Demo\n---\n",
    );
    write(
      "src/content/docs/extensions/demo/installation.md",
      '---\ntitle: "Install the demo"\n---\n',
    );

    const hosting = loadHosting({ root });
    const demo = hostingFor("vendor/demo", hosting);

    assert.equal(hostingFor("yiisoft/yii2", hosting), null);
    assert.equal(demo.guide, true);
    assert.equal(demo.reference, false);
    assert.equal(demo.demos, true);
    assert.equal(demo.skill, null);
    assert.equal(demo.agentSkill, true);
    assert.deepEqual(
      demo.pages.map(({ title, url }) => [title, url]),
      [
        ["Overview", "/extensions/demo/"],
        ["Install the demo", "/extensions/demo/installation/"],
      ],
    );
    assert.equal(hostingFor("tool:box", hosting).guide, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown packages have no hosting and hosted entries are listed first", () => {
  const hosting = loadHosting();

  assert.equal(hostingFor("missing/package", hosting), null);
  assert.equal(hostingFor({ id: "missing/package" }, hosting), null);

  const ordered = displayOrder(packages, hosting);
  const hosted = new Set(hostedPackages(packages, hosting).map(({ id }) => id));
  const firstExternal = ordered.findIndex(({ id }) => !hosted.has(id));

  assert.equal(ordered.length, packages.length);
  assert.ok(
    firstExternal === -1 ||
      ordered.slice(firstExternal).every(({ id }) => !hosted.has(id)),
  );
});

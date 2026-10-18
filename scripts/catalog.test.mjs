import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  catalogMarkdown,
  ecosystemLabels,
  familyLabels,
  getPackage,
  packageMarkdown,
  packages,
  validateCatalog,
  withBase,
} from "../src/lib/catalog.mjs";

const copy = (id = "yii2-extensions/filepond") =>
  structuredClone(getPackage(id));

test("loads reviewed records for all collections in a stable order", () => {
  assert.ok(packages.length > 0);
  assert.deepEqual(
    packages.map((pkg) => pkg.id),
    packages.map((pkg) => pkg.id).sort(),
  );
  assert.deepEqual(
    new Set(packages.map((pkg) => pkg.family)),
    new Set(Object.keys(familyLabels)),
  );
  assert.deepEqual(
    new Set(packages.flatMap((pkg) => pkg.ecosystems)),
    new Set(Object.keys(ecosystemLabels)),
  );
  assert.ok(Object.isFrozen(packages));
  assert.ok(Object.isFrozen(packages[0].provenance));
  assert.equal(getPackage("missing/package"), undefined);
});

test("rejects duplicate package identities instead of shadowing another record", () => {
  assert.throws(() => validateCatalog([copy(), copy()]), /duplicate package/);
});

test("rejects executable import and unreviewed publication fields at every supported object level", () => {
  for (const field of [
    "scripts",
    "localPath",
    "srcDir",
    "import",
    "fetch",
    "demos",
    "latestVersion",
    "stability",
  ]) {
    const pkg = copy();
    pkg[field] = "untrusted";
    assert.throws(() => validateCatalog([pkg]), /unknown field/);
  }
  for (const select of [
    (pkg) => pkg.maintainer,
    (pkg) => pkg.provenance,
    (pkg) => pkg.compatibility[0],
  ]) {
    const pkg = copy();
    select(pkg).scripts = "untrusted";
    assert.throws(() => validateCatalog([pkg]), /unknown field/);
  }
  const pkg = JSON.parse(
    JSON.stringify(copy()).replace('"name":', '"__proto__":{},"name":'),
  );
  assert.throws(() => validateCatalog([pkg]), /unknown field __proto__/);
});

test("requires every declared ecosystem to have one matching compatibility statement", () => {
  for (const change of [
    (pkg) => {
      pkg.ecosystems = ["yii4"];
    },
    (pkg) => {
      pkg.ecosystems = ["yii2", "yii2"];
    },
    (pkg) => {
      pkg.compatibility = [];
    },
    (pkg) => {
      pkg.compatibility.push(pkg.compatibility[0]);
    },
    (pkg) => {
      pkg.compatibility[0].ecosystem = "yii3";
    },
  ]) {
    const pkg = copy();
    change(pkg);
    assert.throws(() => validateCatalog([pkg]), /ecosystem/);
  }
});

test("preserves PHP and Yii development constraints instead of inventing stable compatibility", () => {
  assert.equal(
    getPackage("yii2-extensions/inertia").compatibility[0].constraint,
    "^22.0@dev",
  );
  assert.equal(
    getPackage("yii2-extensions/filepond").compatibility[0].constraint,
    "~2.0.55 || ^22.0@dev",
  );
  assert.equal(getPackage("php-forge/support").php, "^8.1");
  assert.equal(getPackage("ui-awesome/html").php, "^8.3");
  const pkg = copy("php-forge/support");
  pkg.compatibility[0].constraint = ">=8.3";
  assert.throws(() => validateCatalog([pkg]), /literal PHP requirement/);
  assert.ok(packages.every((item) => item.provenance.kind === "source"));
});

test("does not silently turn unknown requirements into a supported version", () => {
  const pkg = copy("php-forge/support");
  pkg.php = "Not declared";
  pkg.compatibility[0].constraint = "Not declared";
  const [validated] = validateCatalog([pkg]);
  assert.equal(validated.php, "Not declared");
  assert.match(packageMarkdown(validated), /PHP requirement: Not declared/);
});

test("requires evidence of provenance, compatibility and the maintainer relationship", () => {
  for (const change of [
    (pkg) => {
      delete pkg.provenance.reviewedAt;
    },
    (pkg) => {
      pkg.provenance.reviewedAt = "2026-02-31";
    },
    (pkg) => {
      pkg.provenance.commit = "main";
    },
    (pkg) => {
      pkg.provenance.url = `${pkg.repository}/blob/main/composer.json`;
    },
    (pkg) => {
      pkg.provenance.url = `https://github.com/other/repo/blob/${pkg.provenance.commit}/composer.json`;
    },
    (pkg) => {
      pkg.provenance.kind = "verified-stable";
    },
    (pkg) => {
      delete pkg.relationshipEvidence;
    },
    (pkg) => {
      delete pkg.compatibility[0].evidence;
    },
  ]) {
    const pkg = copy();
    change(pkg);
    assert.throws(() => validateCatalog([pkg]), /Catalog/);
  }
});

test("keeps community ownership distinct from the maintained collections", () => {
  const pkg = copy("yiisoft/bootstrap5");
  assert.equal(pkg.family, "community");
  assert.equal(pkg.relationship, "community");
  assert.equal(pkg.maintainer.name, "Yii Software");
  assert.equal(
    pkg.compatibility[0].constraint,
    "yiisoft/html ^3.0; yiisoft/widget ^2.0",
  );
  pkg.relationship = "maintained";
  assert.throws(() => validateCatalog([pkg]), /community/);
});

test("allows only HTTPS destinations and whitelisted local documentation paths", () => {
  for (const field of ["repository", "relationshipEvidence", "docsUrl"]) {
    for (const value of [
      "javascript:alert(1)",
      "http://example.com/",
      "//example.com/",
      "https://user:password@example.com/",
    ]) {
      const pkg = copy();
      pkg[field] = value;
      assert.throws(() => validateCatalog([pkg]), /HTTPS/);
    }
  }
  for (const value of [
    "/skills/private/",
    "/extensions/../secret/",
    "/extensions/%2e%2e/",
    "/docs/extensions/filepond/",
    "/extensions/filepond/?redirect=bad",
    "https://example.com/%0aevil",
  ]) {
    const pkg = copy();
    pkg.docsUrl = value;
    assert.throws(() => validateCatalog([pkg]), /HTTPS/);
  }
  assert.doesNotThrow(() => validateCatalog([copy()]));
});

test("base handling preserves site paths under project hosting and leaves external docs external", () => {
  assert.equal(
    withBase("/extensions/filepond/", "/docs/"),
    "/docs/extensions/filepond/",
  );
  assert.equal(
    withBase("/packages/index.md", "https://example.com/docs/"),
    "https://example.com/docs/packages/index.md",
  );
  assert.equal(withBase("/packages/index.md", "/"), "/packages/index.md");
  assert.equal(
    withBase("https://example.com/README.md", "/docs/"),
    "https://example.com/README.md",
  );
  for (const base of [
    "//host",
    "javascript:alert(1)",
    "/../private",
    "https://host/docs?x=1",
  ]) {
    assert.throws(() => withBase("/packages/", base), /Catalog base/);
  }
  assert.throws(
    () => withBase("/packages/../private", "/docs/"),
    /Catalog link/,
  );
});

test("Markdown details are complete documents with reviewable evidence and working Markdown routes", () => {
  const pkg = getPackage("yii2-extensions/inertia");
  const result = packageMarkdown(pkg, "/docs/");
  assert.match(result, /^# Inertia for Yii2\n\n> /);
  assert.ok(result.includes("^22\\.0@dev"));
  assert.ok(result.includes(pkg.provenance.commit));
  assert.ok(result.includes("/docs/extensions/inertia/index.md"));
  assert.ok(result.includes("/docs/packages/index.md"));
  assert.ok(
    result.includes(
      "A released package version and release stability have not been established",
    ),
  );
  assert.equal((result.match(/^# /gm) || []).length, 1);
});

test("Markdown escapes submitted text instead of creating HTML, links, images or inline formatting", () => {
  const pkg = copy();
  pkg.name = "![image](https://example.com/x)";
  pkg.summary =
    "Read [guide](javascript:alert(1)) <script> **bold** & raw `code` | cell";
  const result = packageMarkdown(pkg);
  assert.ok(result.includes("\\!\\[image\\]\\(https://example\\.com/x\\)"));
  assert.ok(result.includes("\\[guide\\]\\(javascript:alert\\(1\\)\\)"));
  assert.ok(
    result.includes(
      "&lt;script&gt; \\*\\*bold\\*\\* &amp; raw \\`code\\` \\| cell",
    ),
  );
  assert.ok(!result.includes("<script>"));
  assert.ok(!result.includes("[guide](javascript:"));
});

test("Markdown discovery includes every package and keeps the public catalog separate from imports", () => {
  const result = catalogMarkdown("/docs/");
  assert.match(result, /^# Package catalog\n/);
  for (const pkg of packages) {
    assert.ok(result.includes(`/docs/packages/${pkg.id}/index.md`));
    assert.ok(result.includes(pkg.provenance.url));
  }
  const loader = readFileSync(
    new URL("../src/lib/catalog.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(!loader.includes("packages.json"));
  assert.ok(!loader.includes("tools.json"));
  assert.ok(!loader.includes("child_process"));
  assert.ok(!loader.includes("fetch("));
});

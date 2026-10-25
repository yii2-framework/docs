import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  catalogMarkdown,
  documentationTarget,
  ecosystemLabels,
  evidenceLabel,
  familyLabels,
  getPackage,
  hostedSummary,
  maintainerLink,
  packageMarkdown,
  packages,
  relationshipLabels,
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
  assert.ok(
    packages.every(
      (item) =>
        item.provenance.kind === "source" ||
        /^v?\d+\.\d+\.\d+$/.test(item.provenance.ref),
    ),
  );
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

const hosting = Object.freeze({
  guide: true,
  reference: true,
  demos: true,
  agentSkill: true,
  skill: "yii2-filepond-uploads",
  skillUrl: "/skills/yii2-filepond-uploads/SKILL.md",
  referenceUrl: "/extensions/filepond/reference/",
  pages: [
    { slug: "", title: "Overview", url: "/extensions/filepond/" },
    {
      slug: "installation",
      title: "Installation guide",
      url: "/extensions/filepond/installation/",
    },
  ],
});

test("relationship labels describe every supported relationship in reader wording", () => {
  assert.deepEqual(Object.keys(relationshipLabels).sort(), [
    "community",
    "contributed",
    "maintained",
  ]);
  assert.ok(Object.isFrozen(relationshipLabels));
  assert.equal(relationshipLabels.maintained, "Site curator");
  assert.equal(relationshipLabels.community, "Independent community project");
  for (const pkg of packages) {
    assert.ok(Object.hasOwn(relationshipLabels, pkg.relationship));
  }
});

test("Markdown documents stay unchanged when no hosting is passed", () => {
  for (const pkg of packages) {
    const result = packageMarkdown(pkg, "/docs/");
    assert.equal(packageMarkdown(pkg, "/docs/", null), result);
    assert.deepEqual(result.match(/^## .+$/gm), [
      "## Compatibility",
      "## Source and version",
      "## Links",
    ]);
    assert.ok(result.includes(`- Relationship: ${pkg.relationship} (`));
    assert.ok(!result.includes("On this site"));
  }
  const result = catalogMarkdown("/docs/");
  assert.equal(catalogMarkdown("/docs/", undefined), result);
  assert.ok(!result.includes("On this site"));
  assert.ok(!result.includes("Documentation: in the project"));
  assert.ok(!result.includes("/docs/documentation/index.md"));
});

test("Markdown details list the hosted guide pages, reference and skill when hosting is passed", () => {
  const pkg = getPackage("yii2-extensions/filepond");
  const result = packageMarkdown(pkg, "/docs/", hosting);
  assert.ok(
    result.includes(
      "- On this site: guide, API reference, live demos, agent skill",
    ),
  );
  assert.ok(
    result.includes(`- Relationship: ${relationshipLabels.maintained}`),
  );
  assert.ok(result.includes("## Documentation on this site"));
  for (const url of [
    "/docs/extensions/filepond/index.md",
    "/docs/extensions/filepond/installation/index.md",
    "/docs/extensions/filepond/reference/index.md",
    "/docs/skills/yii2-filepond-uploads/SKILL.md",
  ]) {
    assert.ok(result.includes(`(<${url}>)`), url);
  }
  assert.ok(
    result.indexOf("## Documentation on this site") <
      result.indexOf("## Compatibility"),
  );
  assert.equal((result.match(/^# /gm) || []).length, 1);

  const external = packageMarkdown(getPackage("php-forge/vite"), "/docs/", {
    guide: false,
  });
  assert.ok(external.includes("- Documentation: in the project's repository"));
  assert.ok(
    external.includes("The guide is maintained in the project's repository."),
  );
  assert.ok(!external.includes("## Documentation on this site"));
});

test("Markdown discovery says where each entry's documentation is when a resolver is passed", () => {
  const result = catalogMarkdown("/docs/", (pkg) =>
    pkg.id === "yii2-extensions/filepond" ? hosting : null,
  );
  assert.ok(result.includes("(</docs/documentation/index.md>)"));
  assert.equal((result.match(/^- On this site: /gm) || []).length, 1);
  assert.equal(
    (result.match(/^- Documentation: in the project's repository$/gm) || [])
      .length,
    packages.filter((pkg) => pkg.docsUrl.startsWith("https://")).length,
  );
  assert.equal(
    (result.match(/^- Documentation: not yet published on this site$/gm) || [])
      .length,
    packages.filter((pkg) => pkg.docsUrl.startsWith("/")).length - 1,
  );
  assert.equal(hostedSummary(null), "");
  assert.equal(hostedSummary({ guide: true }), "guide");
});

test("documentation targets distinguish hosted, external and unpublished documentation", () => {
  const filepond = getPackage("yii2-extensions/filepond");
  assert.deepEqual(documentationTarget(filepond, hosting), {
    kind: "hosted",
    url: undefined,
    label: "Read the guide",
  });
  assert.deepEqual(
    documentationTarget(filepond, { ...hosting, url: "/extensions/filepond/" }),
    { kind: "hosted", url: "/extensions/filepond/", label: "Read the guide" },
  );
  for (const missing of [null, { guide: false }]) {
    assert.deepEqual(documentationTarget(filepond, missing), {
      kind: "unpublished",
      url: null,
      label: "Documentation not yet published",
    });
  }
  const vite = getPackage("php-forge/vite");
  assert.deepEqual(documentationTarget(vite), {
    kind: "external",
    url: vite.docsUrl,
    label: "Documentation on GitHub",
  });
  assert.equal(
    documentationTarget({ docsUrl: "https://example.com/docs/" }).label,
    "External documentation",
  );

  const result = packageMarkdown(filepond, "/docs/", { guide: false });
  assert.ok(result.includes("- Documentation: not yet published on this site"));
  assert.ok(result.includes("The guide is not yet published on this site."));
  assert.ok(!result.includes("/docs/extensions/filepond/index.md"));
});

test("maintainers are shown as their GitHub handle, or by name for other URLs", () => {
  assert.deepEqual(maintainerLink(getPackage("yii2-extensions/filepond")), {
    label: "@terabytesoftw",
    url: "https://github.com/terabytesoftw",
  });
  assert.deepEqual(maintainerLink(getPackage("yiisoft/bootstrap5")), {
    label: "Yii Software",
    url: "https://www.yiiframework.com/",
  });
  const named = (url) =>
    maintainerLink({ maintainer: { name: "Example Org", url } }).label;
  assert.equal(named("https://github.com/terabytesoftw/"), "@terabytesoftw");
  assert.equal(
    named("https://github.com/yii2-extensions/filepond"),
    "Example Org",
  );
  assert.equal(
    named("https://github.com/orgs/yii2-extensions/people"),
    "Example Org",
  );
  assert.equal(named("https://gitlab.com/example"), "Example Org");
  assert.equal(relationshipLabels.contributed, "Contributor");
  const result = packageMarkdown(
    getPackage("yii2-extensions/filepond"),
    "/docs/",
  );
  assert.ok(
    result.includes(
      "- Maintainer: [@terabytesoftw](<https://github.com/terabytesoftw>)",
    ),
  );
  assert.ok(
    packageMarkdown(getPackage("yiisoft/bootstrap5")).includes(
      "- Maintainer: [Yii Software](<https://www.yiiframework.com/>)",
    ),
  );
});

test("evidence links are labelled by their destination", () => {
  const commit = "35e49c93f2b9dac39eae25239b742b22e76d6350";
  const blob = `https://github.com/yii2-extensions/demo/blob/${commit}`;
  for (const kind of ["provenance", "compatibility"]) {
    assert.equal(
      evidenceLabel(`${blob}/composer.json`, kind),
      "composer.json at this commit",
    );
  }
  assert.equal(
    evidenceLabel(`${blob}/docs/installation.md`, "provenance"),
    "View source at this commit",
  );
  assert.equal(
    evidenceLabel(`${blob}/tests/WidgetTest.php`, "compatibility"),
    "View requirement evidence",
  );
  assert.equal(
    evidenceLabel("https://example.com/docs/requirements", "compatibility"),
    "View requirement evidence",
  );
  assert.equal(
    evidenceLabel("https://example.com/composer.json.bak", "provenance"),
    "View source at this commit",
  );
  const pkg = getPackage("yii2-extensions/filepond");
  assert.ok(
    packageMarkdown(pkg).includes(
      `([composer\\.json at this commit](<${pkg.compatibility[0].evidence}>))`,
    ),
  );
  const other = copy();
  other.compatibility[0].evidence = `${other.repository}/blob/${other.provenance.commit}/docs/installation.md`;
  assert.ok(packageMarkdown(other).includes("([View requirement evidence](<"));
});

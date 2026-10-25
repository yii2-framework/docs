import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogSearchRecord,
  documentationKinds,
  filtersUrl,
  githubHandle,
  matchesFilters,
  normalizeFilters,
} from "../src/lib/catalog-filter.mjs";

const record = catalogSearchRecord({
  id: "example/upload",
  name: "Résumé uploads",
  summary: "File uploads for Yii2 applications",
  family: "yii2-extensions",
  kind: "extension",
  php: ">=8.3",
  maintainer: { name: "Example maintainer" },
  ecosystems: ["yii2", "php"],
  relationship: "maintained",
  compatibility: [{ constraint: "~2.0.55 || ^22.0@dev" }],
});

test("an empty or unknown filter preserves the complete list", () => {
  assert.equal(matchesFilters(record), true);
  assert.equal(
    matchesFilters(record, {
      ecosystem: "unknown",
      relationship: "official",
    }),
    true,
  );
});

test("all words match across package metadata, independent of case and accents", () => {
  assert.equal(
    matchesFilters(record, { q: "  RESUME  maintainer Yii2  " }),
    true,
  );
  assert.equal(matchesFilters(record, { q: "uploads Laravel" }), false);
  assert.equal(matchesFilters(record, { q: "^22.0@dev" }), true);
});

test("ecosystems are exact memberships and combine with family and relationship", () => {
  assert.equal(
    matchesFilters(record, {
      ecosystem: "php",
      family: "yii2-extensions",
      relationship: "maintained",
    }),
    true,
  );
  assert.equal(matchesFilters(record, { ecosystem: "yii3" }), false);
  assert.equal(matchesFilters(record, { family: "community" }), false);
  assert.equal(matchesFilters(record, { relationship: "community" }), false);
});

test("query state accepts supported values and bounds search text", () => {
  assert.deepEqual(
    normalizeFilters(
      new URLSearchParams(
        "q=+uploads+&ecosystem=yii2&family=unknown&relationship=community",
      ),
    ),
    {
      q: "uploads",
      ecosystem: "yii2",
      family: "",
      docs: "",
      relationship: "community",
    },
  );
  assert.equal(normalizeFilters({ q: "x".repeat(300) }).q.length, 200);
  assert.deepEqual(normalizeFilters({ q: 123, ecosystem: ["yii2"] }), {
    q: "",
    ecosystem: "",
    family: "",
    docs: "",
    relationship: "",
  });
});

test("URL round trips preserve the base path, unrelated parameters and fragment", () => {
  const before = new URL(
    "https://example.test/docs/packages/?campaign=guide#results",
  );
  const after = filtersUrl(before, {
    q: "upload & media",
    ecosystem: "yii2",
    family: "yii2-extensions",
  });
  assert.equal(after.pathname, "/docs/packages/");
  assert.equal(after.searchParams.get("campaign"), "guide");
  assert.equal(after.hash, "#results");
  assert.deepEqual(normalizeFilters(after.searchParams), {
    q: "upload & media",
    ecosystem: "yii2",
    family: "yii2-extensions",
    docs: "",
    relationship: "",
  });
  assert.equal(before.search, "?campaign=guide");
});

test("reset removes all filter parameters including duplicates", () => {
  const result = filtersUrl(
    "https://example.test/docs/packages/?q=one&q=two&family=community&campaign=guide",
  );
  assert.equal(result.search, "?campaign=guide");
});

const hosted = catalogSearchRecord(
  {
    id: "example/hosted",
    name: "Hosted",
    summary: "A package with a guide on this site",
    family: "yii2-extensions",
    kind: "extension",
    php: ">=8.3",
    maintainer: { name: "Example maintainer" },
    ecosystems: ["yii2"],
    relationship: "maintained",
    compatibility: [{ constraint: "^22.0@dev" }],
  },
  { guide: true, demos: true, reference: true, agentSkill: true },
);

test("documentation kinds describe hosted guides, skills and external documentation", () => {
  assert.deepEqual(documentationKinds(), ["external"]);
  assert.deepEqual(documentationKinds({ guide: false, agentSkill: true }), [
    "skill",
    "external",
  ]);
  assert.deepEqual(hosted.docs, ["guide", "skill"]);
  assert.deepEqual(record.docs, ["external"]);
});

test("the documentation filter selects hosted guides, skills or external documentation", () => {
  assert.equal(matchesFilters(hosted, { docs: "guide" }), true);
  assert.equal(matchesFilters(hosted, { docs: "skill" }), true);
  assert.equal(matchesFilters(hosted, { docs: "external" }), false);
  assert.equal(matchesFilters(record, { docs: "external" }), true);
  assert.equal(matchesFilters(record, { docs: "guide" }), false);
  assert.equal(matchesFilters(record, { docs: "elsewhere" }), true);
  assert.equal(normalizeFilters({ docs: "elsewhere" }).docs, "");
  assert.equal(
    normalizeFilters(new URLSearchParams("docs=skill")).docs,
    "skill",
  );
});

test("hosting words are searchable and the legacy relationship filter still applies", () => {
  for (const q of ["guide", "demos", "skill", "api reference"]) {
    assert.equal(matchesFilters(hosted, { q }), true, q);
    assert.equal(matchesFilters(record, { q }), false, q);
  }
  assert.equal(
    matchesFilters(hosted, { docs: "guide", relationship: "maintained" }),
    true,
  );
  assert.equal(
    matchesFilters(hosted, { docs: "guide", relationship: "community" }),
    false,
  );
  assert.equal(
    filtersUrl("https://example.test/docs/packages/", {
      docs: "guide",
      relationship: "maintained",
    }).search,
    "?docs=guide&relationship=maintained",
  );
});

test("the maintainer's GitHub handle is searchable", () => {
  const curated = catalogSearchRecord({
    id: "example/curated",
    name: "Curated",
    summary: "A curated package",
    family: "yii2-extensions",
    kind: "extension",
    php: ">=8.3",
    maintainer: {
      name: "Wilmer Arambula",
      url: "https://github.com/terabytesoftw",
    },
    ecosystems: ["yii2"],
    relationship: "maintained",
    compatibility: [{ constraint: "^22.0@dev" }],
  });
  assert.equal(matchesFilters(curated, { q: "terabytesoftw" }), true);
  assert.equal(matchesFilters(curated, { q: "@terabytesoftw" }), true);
  assert.equal(matchesFilters(record, { q: "terabytesoftw" }), false);
  assert.equal(
    githubHandle("https://github.com/terabytesoftw/"),
    "@terabytesoftw",
  );
  assert.equal(githubHandle("https://github.com/a/b"), null);
  assert.equal(githubHandle(undefined), null);
});

test("a local docsUrl without a hosted guide is neither a guide nor documentation elsewhere", () => {
  assert.deepEqual(documentationKinds(null, "/extensions/demo/"), []);
  assert.deepEqual(
    documentationKinds({ guide: false }, "/extensions/demo/"),
    [],
  );
  assert.deepEqual(
    documentationKinds({ guide: false, agentSkill: true }, "/extensions/demo/"),
    ["skill"],
  );
  assert.deepEqual(
    documentationKinds({ guide: false }, "https://github.com/vendor/demo"),
    ["external"],
  );
  assert.deepEqual(documentationKinds({ guide: true }, "/extensions/demo/"), [
    "guide",
  ]);
  const unsynced = catalogSearchRecord({
    id: "example/unsynced",
    name: "Unsynced",
    summary: "A guide that is not synced yet",
    family: "yii2-extensions",
    kind: "extension",
    php: ">=8.3",
    maintainer: { name: "Example maintainer" },
    ecosystems: ["yii2"],
    relationship: "maintained",
    compatibility: [{ constraint: "^22.0@dev" }],
    docsUrl: "/extensions/unsynced/",
  });
  assert.equal(matchesFilters(unsynced, { docs: "external" }), false);
  assert.equal(matchesFilters(unsynced, { docs: "guide" }), false);
  assert.equal(matchesFilters(unsynced), true);
});

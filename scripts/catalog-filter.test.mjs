import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogSearchRecord,
  documentationKinds,
  filterKeys,
  filtersUrl,
  githubHandle,
  isTagSlug,
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
      tag: "",
      relationship: "community",
    },
  );
  assert.equal(normalizeFilters({ q: "x".repeat(300) }).q.length, 200);
  assert.deepEqual(normalizeFilters({ q: 123, ecosystem: ["yii2"] }), {
    q: "",
    ecosystem: "",
    family: "",
    docs: "",
    tag: "",
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
    tag: "",
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

const tagged = catalogSearchRecord(
  {
    id: "example/tagged",
    name: "Tagged",
    summary: "A package with tags and a topic",
    family: "yii2-extensions",
    topic: "forms-widgets",
    tags: ["widget", "file-upload", "cropperjs", "image-crop"],
    kind: "extension",
    php: ">=8.3",
    maintainer: { name: "Example maintainer" },
    ecosystems: ["yii2"],
    relationship: "maintained",
    compatibility: [{ constraint: "^22.0@dev" }],
  },
  null,
  { id: "forms-widgets", title: "Forms and widgets" },
);

test("the tag filter accepts tag slugs of at most 32 characters only", () => {
  assert.ok(filterKeys.includes("tag"));
  for (const tag of ["widget", "psr-7", "a", "x".repeat(32)]) {
    assert.equal(isTagSlug(tag), true, tag);
    assert.equal(normalizeFilters({ tag }).tag, tag, tag);
  }
  for (const tag of [
    "",
    "Widget",
    "-widget",
    "widget-",
    "psr--7",
    "file upload",
    "file_upload",
    "<script>",
    "x".repeat(33),
    ["widget"],
    7,
    null,
  ]) {
    assert.equal(isTagSlug(tag), false, String(tag));
    assert.equal(normalizeFilters({ tag }).tag, "", String(tag));
  }
  assert.equal(
    normalizeFilters(new URLSearchParams("tag=psr-7&tag=widget")).tag,
    "psr-7",
  );
});

test("the tag filter matches records carrying the tag and combines with the other filters", () => {
  assert.deepEqual(tagged.tags, [
    "widget",
    "file-upload",
    "cropperjs",
    "image-crop",
  ]);
  assert.equal(tagged.topic, "forms-widgets");
  assert.equal(matchesFilters(tagged, { tag: "widget" }), true);
  // A tag the card does not show (fourth tag) still matches.
  assert.equal(matchesFilters(tagged, { tag: "image-crop" }), true);
  assert.equal(matchesFilters(tagged, { tag: "file" }), false);
  // A malformed tag is dropped, so it filters nothing instead of hiding every record.
  assert.equal(matchesFilters(tagged, { tag: "Widget" }), true);
  assert.equal(
    matchesFilters(tagged, { tag: "widget", ecosystem: "yii3" }),
    false,
  );
  assert.equal(
    matchesFilters(tagged, { tag: "widget", relationship: "maintained" }),
    true,
  );
  // Records without tags (an older search record) never match a tag filter.
  assert.equal(matchesFilters(record, { tag: "widget" }), false);
  assert.deepEqual(record.tags, []);
  assert.equal(record.topic, "");
  assert.equal(
    filtersUrl("https://example.test/docs/packages/?tag=old", {
      tag: "psr-7",
      relationship: "maintained",
    }).search,
    "?tag=psr-7&relationship=maintained",
  );
  assert.equal(
    filtersUrl("https://example.test/docs/packages/?tag=widget").search,
    "",
  );
});

test("the search text holds every tag, the topic id and the topic title", () => {
  for (const q of [
    "image-crop",
    "cropperjs",
    "file upload",
    "forms-widgets",
    "forms and widgets",
    "WIDGETS",
  ]) {
    assert.equal(matchesFilters(tagged, { q }), true, q);
  }
  const untitled = catalogSearchRecord({
    id: "example/untitled",
    name: "Untitled",
    summary: "A record searched without its topic title",
    family: "yii2-extensions",
    topic: "html-views",
    tags: ["html"],
    kind: "library",
    php: ">=8.3",
    maintainer: { name: "Example maintainer" },
    ecosystems: ["php"],
    relationship: "maintained",
    compatibility: [{ constraint: ">=8.3" }],
  });
  assert.equal(matchesFilters(untitled, { q: "html-views" }), true);
  assert.equal(matchesFilters(untitled, { q: "views and html" }), false);
});

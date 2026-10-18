import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogSearchRecord,
  filtersUrl,
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
      relationship: "community",
    },
  );
  assert.equal(normalizeFilters({ q: "x".repeat(300) }).q.length, 200);
  assert.deepEqual(normalizeFilters({ q: 123, ecosystem: ["yii2"] }), {
    q: "",
    ecosystem: "",
    family: "",
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

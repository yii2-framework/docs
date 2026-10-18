export const filterKeys = Object.freeze([
  "q",
  "ecosystem",
  "family",
  "relationship",
]);

const choices = Object.freeze({
  ecosystem: ["yii2", "yii3", "php"],
  family: ["yii2-extensions", "php-forge", "ui-awesome", "community"],
  relationship: ["maintained", "contributed", "community"],
});

/** Keep URLs and browser controls within the supported catalog filters. */
export function normalizeFilters(input = {}) {
  const read = (key) =>
    input instanceof URLSearchParams ? input.get(key) : input[key];
  const q = read("q");
  return {
    q: typeof q === "string" ? q.trim().slice(0, 200) : "",
    ...Object.fromEntries(
      Object.entries(choices).map(([key, values]) => {
        const value = read(key);
        return [key, values.includes(value) ? value : ""];
      }),
    ),
  };
}

const searchable = (text) =>
  String(text).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Produce the same searchable record for rendered HTML and unit tests. */
export function catalogSearchRecord(pkg) {
  return {
    search: searchable(
      [
        pkg.id,
        pkg.name,
        pkg.summary,
        pkg.family,
        pkg.kind,
        pkg.php,
        pkg.maintainer.name,
        ...pkg.ecosystems,
        ...pkg.compatibility.map((entry) => entry.constraint),
      ].join(" "),
    ),
    ecosystems: pkg.ecosystems,
    family: pkg.family,
    relationship: pkg.relationship,
  };
}

export function matchesFilters(record, input = {}) {
  const filters = normalizeFilters(input);
  return (
    (!filters.ecosystem || record.ecosystems.includes(filters.ecosystem)) &&
    (!filters.family || record.family === filters.family) &&
    (!filters.relationship || record.relationship === filters.relationship) &&
    searchable(filters.q)
      .split(/\s+/u)
      .filter(Boolean)
      .every((term) => searchable(record.search).includes(term))
  );
}

/** Change only catalog-owned parameters, preserving links from other site features. */
export function filtersUrl(url, input = {}) {
  const result = new URL(url);
  const filters = normalizeFilters(input);
  for (const key of filterKeys) {
    result.searchParams.delete(key);
    if (filters[key]) result.searchParams.set(key, filters[key]);
  }
  return result;
}

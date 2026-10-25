export const filterKeys = Object.freeze([
  "q",
  "ecosystem",
  "family",
  "docs",
  "relationship",
]);

const choices = Object.freeze({
  ecosystem: ["yii2", "yii3", "php"],
  family: ["yii2-extensions", "php-forge", "ui-awesome", "community"],
  docs: ["guide", "skill", "external"],
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

/**
 * Returns the GitHub handle (`@user`) of a profile URL `https://github.com/<user>` (one path segment, optional
 * trailing slash), or `null` for any other URL.
 *
 * @param {unknown} url
 */
export function githubHandle(url) {
  const user =
    /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/?$/.exec(
      typeof url === "string" ? url : "",
    )?.[1];

  return user === undefined ? null : `@${user}`;
}

const searchable = (text) =>
  String(text).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Lists where a record's documentation is: `guide` (hosted on this site), `skill` (agent skill available) or
 * `external` (no hosted guide).
 *
 * @param {{ guide?: boolean, agentSkill?: boolean } | null} hosting Result of `hostingFor()` in `hosting.mjs`.
 */
export function documentationKinds(hosting = null) {
  const kinds = [];

  if (hosting?.guide === true) kinds.push("guide");
  if (hosting?.agentSkill === true) kinds.push("skill");
  if (!kinds.includes("guide")) kinds.push("external");

  return kinds;
}

/** Produce the same searchable record for rendered HTML and unit tests; `hosting` adds the documentation facts. */
export function catalogSearchRecord(pkg, hosting = null) {
  const docs = documentationKinds(hosting);
  const words = [
    hosting?.guide === true ? "guide" : "",
    hosting?.demos === true ? "demos" : "",
    hosting?.agentSkill === true ? "skill" : "",
    hosting?.reference === true ? "api reference" : "",
  ];

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
        githubHandle(pkg.maintainer.url) ?? "",
        ...pkg.ecosystems,
        ...pkg.compatibility.map((entry) => entry.constraint),
        ...words,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    ecosystems: pkg.ecosystems,
    family: pkg.family,
    docs,
    relationship: pkg.relationship,
  };
}

export function matchesFilters(record, input = {}) {
  const filters = normalizeFilters(input);
  return (
    (!filters.ecosystem || record.ecosystems.includes(filters.ecosystem)) &&
    (!filters.family || record.family === filters.family) &&
    (!filters.docs || (record.docs ?? []).includes(filters.docs)) &&
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

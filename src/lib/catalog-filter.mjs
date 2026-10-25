export const filterKeys = Object.freeze([
  "q",
  "ecosystem",
  "family",
  "docs",
  "tag",
  "relationship",
]);

/** Longest accepted tag, as in the record validator of `catalog.mjs`. */
const MAX_TAG_LENGTH = 32;

/**
 * Whether a value is a tag slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, at most 32 characters), the shape every record tag has.
 * The list of tags is not known here, so a well-formed tag that no record uses is accepted and matches nothing.
 *
 * @param {unknown} value
 */
export function isTagSlug(value) {
  return (
    typeof value === "string" &&
    value.length <= MAX_TAG_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

const choices = Object.freeze({
  ecosystem: ["yii2", "yii3", "php"],
  family: ["yii2-extensions", "php-forge", "ui-awesome", "community"],
  docs: ["guide", "skill", "external"],
  relationship: ["maintained", "contributed", "community"],
});

/** Keep URLs and browser controls within the supported catalog filters; `tag` must be a tag slug. */
export function normalizeFilters(input = {}) {
  const read = (key) =>
    input instanceof URLSearchParams ? input.get(key) : input[key];
  const q = read("q");
  const tag = read("tag");
  return {
    q: typeof q === "string" ? q.trim().slice(0, 200) : "",
    ...Object.fromEntries(
      Object.entries(choices).map(([key, values]) => {
        const value = read(key);
        return [key, values.includes(value) ? value : ""];
      }),
    ),
    tag: isTagSlug(tag) ? tag : "",
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
 * Whether a `docsUrl` is a path on this site (`/extensions/<name>/`) rather than documentation elsewhere. Shared with
 * `documentationTarget()` in `catalog.mjs`.
 *
 * @param {unknown} docsUrl
 */
export function isLocalDocsUrl(docsUrl) {
  return typeof docsUrl === "string" && docsUrl.startsWith("/");
}

/**
 * Lists where a record's documentation is: `guide` (hosted on this site), `skill` (agent skill available) or
 * `external` (no hosted guide and documentation elsewhere). A local `docsUrl` without a hosted guide (not synced or
 * not published yet) is neither `guide` nor `external`.
 *
 * @param {{ guide?: boolean, agentSkill?: boolean } | null} hosting Result of `hostingFor()` in `hosting.mjs`.
 * @param {string | null} [docsUrl] The record's `docsUrl`.
 */
export function documentationKinds(hosting = null, docsUrl = null) {
  const kinds = [];

  if (hosting?.guide === true) kinds.push("guide");
  if (hosting?.agentSkill === true) kinds.push("skill");
  if (!kinds.includes("guide") && !isLocalDocsUrl(docsUrl))
    kinds.push("external");

  return kinds;
}

/**
 * Produce the same searchable record for rendered HTML and unit tests; `hosting` adds the documentation facts. The
 * search text holds every tag (also those a card does not show), the topic id and, when `topic` is passed, its title.
 * This module is bundled for the browser, so the caller passes the topic (`getTopic()` of `catalog.mjs`).
 *
 * @param {object} pkg Catalog record.
 * @param {object | null} [hosting] Result of `hostingFor()` in `hosting.mjs`.
 * @param {{ title: string } | null} [topic] The record's topic.
 */
export function catalogSearchRecord(pkg, hosting = null, topic = null) {
  const docs = documentationKinds(hosting, pkg.docsUrl);
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
        pkg.topic ?? "",
        topic?.title ?? "",
        ...(pkg.tags ?? []),
        ...words,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    ecosystems: pkg.ecosystems,
    family: pkg.family,
    docs,
    relationship: pkg.relationship,
    tags: pkg.tags ?? [],
    topic: pkg.topic ?? "",
  };
}

export function matchesFilters(record, input = {}) {
  const filters = normalizeFilters(input);
  return (
    (!filters.ecosystem || record.ecosystems.includes(filters.ecosystem)) &&
    (!filters.family || record.family === filters.family) &&
    (!filters.docs || (record.docs ?? []).includes(filters.docs)) &&
    (!filters.relationship || record.relationship === filters.relationship) &&
    (!filters.tag || (record.tags ?? []).includes(filters.tag)) &&
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

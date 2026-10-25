// What this site hosts for each catalog package: guide pages, API reference, live demos and agent skill. Joins the
// import manifests (`packages.json`, `tools.json`) with the synced content and the generated skill index. Read-only:
// it never writes, deletes or runs anything. `src/lib/catalog.mjs` stays independent of the manifests; callers pass
// the result of `loadHosting()` to it.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { familyLabels, getPackage } from "./catalog.mjs";

/** Project root. The bundled build moves this module; the catalog source define (astro.config.mjs) still names it. */
export const PROJECT_ROOT = fileURLToPath(
  typeof __PORTAL_CATALOG_SOURCE__ === "string"
    ? new URL("../../../", __PORTAL_CATALOG_SOURCE__)
    : new URL("../../", import.meta.url),
);
const DEFAULT_ROOT = PROJECT_ROOT;
const cache = new Map();

/**
 * Reads a one-line scalar of a Markdown page's frontmatter (`key: x`, `key: "x"` or `key: 'x'`).
 *
 * @param {string} file Absolute path of the page.
 * @param {"title" | "description"} key
 * @returns {string | undefined}
 */
function frontmatterField(file, key) {
  const frontmatter =
    /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, "utf8"))?.[1] ?? "";
  const raw = new RegExp(`^${key}:[ \\t]*(.*)$`, "m")
    .exec(frontmatter)?.[1]
    ?.trim();

  if (!raw) {
    return undefined;
  }

  if (raw.startsWith('"')) {
    return JSON.parse(raw);
  }

  return raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
}

/**
 * Reads a JSON file, or returns `fallback` when the file does not exist.
 *
 * @param {string} file
 * @param {unknown} [fallback] Omitted: a missing file is an error.
 */
function readJson(file, fallback) {
  if (!existsSync(file)) {
    if (fallback === undefined) {
      throw new Error(`[hosting] ${file} does not exist.`);
    }

    return fallback;
  }

  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Returns the hosting facts of one manifest entry.
 *
 * @param {string} root Project root.
 * @param {{ name: string, title: string, status?: string, order?: string[], demos?: boolean, skillsDir?: string }}
 *   entry
 * @param {"extension" | "tool"} type
 * @param {Record<string, { package?: string }>} skills Skills of `public/skills/index.json`, or `{}`.
 */
function describe(root, entry, type, skills) {
  const section = type === "tool" ? "development-tools" : "extensions";
  const directory = path.join(root, "src/content/docs", section, entry.name);
  const url = `/${section}/${entry.name}/`;
  const guide = existsSync(path.join(directory, "index.md"));
  const reference =
    type === "extension" &&
    existsSync(path.join(directory, "reference/index.md"));
  const skill =
    Object.entries(skills).find(
      ([, value]) => value?.package === entry.name,
    )?.[0] ?? null;
  const file = (slug) => `${section}/${entry.name}/${slug}.md`;
  const pages = guide
    ? [
        { slug: "", title: "Overview", url, file: file("index") },
        ...(entry.order ?? [])
          .filter((slug) => existsSync(path.join(directory, `${slug}.md`)))
          .map((slug) => ({
            slug,
            title:
              frontmatterField(path.join(directory, `${slug}.md`), "title") ??
              slug,
            url: `${url}${slug}/`,
            file: file(slug),
          })),
      ]
    : [];

  return {
    name: entry.name,
    title: entry.title,
    description: guide
      ? (frontmatterField(path.join(directory, "index.md"), "description") ??
        "")
      : "",
    type,
    status: entry.status ?? "published",
    guide,
    url: guide ? url : null,
    pages,
    reference,
    referenceUrl: reference ? `${url}reference/` : null,
    demos: entry.demos === true,
    skill,
    agentSkill: skill !== null || typeof entry.skillsDir === "string",
    skillUrl: skill === null ? null : `/skills/${skill}/SKILL.md`,
  };
}

/** Deep-freezes the hosting facts and makes the Map read-only. */
function readOnly(entries) {
  const map = new Map(entries);
  const refuse = () => {
    throw new TypeError("[hosting] the hosting map is read-only.");
  };

  for (const value of map.values()) {
    value.pages.forEach(Object.freeze);
    Object.freeze(value.pages);
    Object.freeze(value);
  }

  map.set = refuse;
  map.delete = refuse;
  map.clear = refuse;

  return Object.freeze(map);
}

/**
 * Loads what the site hosts for each package, keyed by Composer id (`packagist` of `packages.json`; the framework
 * entry is left out). Tools of `tools.json` have no Composer id and are keyed `tool:<name>`. Each value is
 * `{ name, title, description, type, status, guide, url, pages, reference, referenceUrl, demos, skill, agentSkill, skillUrl }`:
 * `guide` when the synced `index.md` exists, `pages` the landing page (`Overview`) and each page of the manifest
 * `order` that exists, with its frontmatter title and content path (`file`); `description` the landing page's; `skill` from `public/skills/index.json` (`null` when the index
 * is missing, for example in `astro dev` without a sync; `agentSkill` then falls back to the manifest `skillsDir`).
 * URLs are site-root relative, without the Astro `base`. Results are cached per root.
 *
 * @param {{ root?: string }} [options] Project root (default: this repository).
 * @returns {ReadonlyMap<string, ReturnType<typeof describe>>}
 */
export function loadHosting({ root = DEFAULT_ROOT } = {}) {
  if (cache.has(root)) {
    return cache.get(root);
  }

  const packages = readJson(path.join(root, "packages.json")).filter(
    ({ type }) => type !== "framework",
  );
  const tools = readJson(path.join(root, "tools.json"));
  const skills =
    readJson(path.join(root, "public/skills/index.json"), {}).skills ?? {};
  const hosting = readOnly([
    ...packages
      .filter(({ packagist }) => typeof packagist === "string")
      .map((entry) => [
        entry.packagist,
        describe(root, entry, "extension", skills),
      ]),
    ...tools.map((entry) => [
      `tool:${entry.name}`,
      describe(root, entry, "tool", skills),
    ]),
  ]);

  cache.set(root, hosting);

  return hosting;
}

/**
 * Returns the hosting facts of a catalog record (or Composer id), or `null` when the site hosts nothing for it.
 *
 * @param {{ id: string } | string} pkg
 * @param {ReadonlyMap<string, object>} [hosting]
 */
export function hostingFor(pkg, hosting = loadHosting()) {
  return hosting.get(typeof pkg === "string" ? pkg : pkg.id) ?? null;
}

/**
 * Returns the records whose guide is hosted on this site, in their given order.
 *
 * @template {{ id: string }} T
 * @param {readonly T[]} records
 * @param {ReadonlyMap<string, object>} [hosting]
 * @returns {T[]}
 */
export function hostedPackages(records, hosting = loadHosting()) {
  return records.filter((pkg) => hostingFor(pkg, hosting)?.guide === true);
}

/**
 * Returns the records in display order: hosted guide first, then by collection (the order of `familyLabels`), then
 * by name. Display only: `validateCatalog()` keeps its id order.
 *
 * @template {{ id: string, family: string, name: string }} T
 * @param {readonly T[]} records
 * @param {ReadonlyMap<string, object>} [hosting]
 * @returns {T[]}
 */
export function displayOrder(records, hosting = loadHosting()) {
  const families = Object.keys(familyLabels);
  const rank = (pkg) => (hostingFor(pkg, hosting)?.guide === true ? 0 : 1);

  return [...records].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      families.indexOf(a.family) - families.indexOf(b.family) ||
      a.name.localeCompare(b.name, "en"),
  );
}

/**
 * Returns the catalog record of an extension guide landing page (route id `extensions/<name>`, English only), or
 * `null` for any other page and for packages without a record.
 *
 * @param {string} routeId Starlight route or content entry id.
 * @param {ReadonlyMap<string, { type: string, name: string }>} [hosting]
 */
export function guideLandingPackage(routeId, hosting = loadHosting()) {
  const name = /^extensions\/([^/]+)$/.exec(routeId)?.[1];

  if (name === undefined) {
    return null;
  }

  for (const [id, value] of hosting) {
    if (value.type === "extension" && value.name === name) {
      return getPackage(id) ?? null;
    }
  }

  return null;
}

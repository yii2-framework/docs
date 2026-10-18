import { lstatSync, readFileSync, readdirSync } from "node:fs";

export const familyLabels = Object.freeze({
  "yii2-extensions": "Yii2 Extensions",
  "php-forge": "PHP Forge",
  "ui-awesome": "UI Awesome",
  community: "Community",
});

export const ecosystemLabels = Object.freeze({
  yii2: "Yii2",
  yii3: "Yii3",
  php: "PHP",
});

const relationships = new Set(["maintained", "contributed", "community"]);
const kinds = new Set(["library", "extension", "tool", "template"]);
const fields = [
  "id",
  "name",
  "summary",
  "family",
  "ecosystems",
  "kind",
  "php",
  "compatibility",
  "docsUrl",
  "repository",
  "license",
  "maintainer",
  "relationship",
  "relationshipEvidence",
  "provenance",
];
const packageId =
  /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const localDocs =
  /^\/(?:extensions|guide|api|development-tools|project|internals)\/(?:[a-z0-9-]+\/)*$/;

function fail(location, message) {
  throw new TypeError(`Catalog ${location}: ${message}`);
}

function object(value, keys, location) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail(location, "must be a plain object");
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail(location, `unknown field ${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail(location, `missing field ${key}`);
  }
}

function text(value, location, max = 240) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > max ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    fail(location, `must be a single-line string of 1–${max} characters`);
}

function https(value, location) {
  text(value, location, 2048);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(location, "must be an HTTPS URL");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    /[\s\\<>"']/.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  )
    fail(
      location,
      "must be an HTTPS URL without credentials or control characters",
    );
  return url;
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Validate display metadata only. No record can select code, imports or build steps. */
export function validateCatalog(records) {
  if (!Array.isArray(records)) fail("records", "must be an array");
  const seen = new Set();
  for (const [index, pkg] of records.entries()) {
    const at = `record ${index}`;
    object(pkg, fields, at);
    text(pkg.id, `${at}.id`, 160);
    if (!packageId.test(pkg.id)) fail(`${at}.id`, "must be vendor/package");
    if (seen.has(pkg.id)) fail(`${at}.id`, `duplicate package ${pkg.id}`);
    seen.add(pkg.id);
    for (const field of ["name", "summary", "php", "license"]) {
      text(pkg[field], `${pkg.id}.${field}`, field === "summary" ? 400 : 160);
    }
    if (
      typeof pkg.family !== "string" ||
      !Object.hasOwn(familyLabels, pkg.family)
    )
      fail(pkg.id, "unknown family");
    if (!kinds.has(pkg.kind)) fail(pkg.id, "unknown kind");
    if (!relationships.has(pkg.relationship))
      fail(pkg.id, "unknown relationship");
    if (pkg.family === "community" && pkg.relationship === "maintained") {
      fail(
        pkg.id,
        "the community family requires a community or contributed relationship",
      );
    }
    if (pkg.relationship === "community" && pkg.family !== "community") {
      fail(pkg.id, "a community relationship requires the community family");
    }
    if (
      !Array.isArray(pkg.ecosystems) ||
      pkg.ecosystems.length === 0 ||
      pkg.ecosystems.some(
        (value) =>
          typeof value !== "string" || !Object.hasOwn(ecosystemLabels, value),
      ) ||
      new Set(pkg.ecosystems).size !== pkg.ecosystems.length
    )
      fail(
        pkg.id,
        "ecosystems must contain distinct supported ecosystem names",
      );
    if (!Array.isArray(pkg.compatibility))
      fail(pkg.id, "compatibility must be an array");
    const mapped = new Set();
    for (const item of pkg.compatibility) {
      object(
        item,
        ["ecosystem", "constraint", "evidence"],
        `${pkg.id}.compatibility`,
      );
      if (
        !pkg.ecosystems.includes(item.ecosystem) ||
        mapped.has(item.ecosystem)
      ) {
        fail(pkg.id, "compatibility must map each ecosystem exactly once");
      }
      mapped.add(item.ecosystem);
      text(item.constraint, `${pkg.id}.compatibility.constraint`);
      https(item.evidence, `${pkg.id}.compatibility.evidence`);
      if (item.ecosystem === "php" && item.constraint !== pkg.php) {
        fail(
          pkg.id,
          "PHP compatibility must preserve the literal PHP requirement",
        );
      }
    }
    if (mapped.size !== pkg.ecosystems.length) {
      fail(pkg.id, "compatibility must map each ecosystem exactly once");
    }
    https(pkg.repository, `${pkg.id}.repository`);
    if (pkg.repository.endsWith("/") || /[?#]/.test(pkg.repository)) {
      fail(
        pkg.id,
        "repository must not have a trailing slash, query or fragment",
      );
    }
    https(pkg.relationshipEvidence, `${pkg.id}.relationshipEvidence`);
    if (typeof pkg.docsUrl !== "string" || !localDocs.test(pkg.docsUrl)) {
      https(pkg.docsUrl, `${pkg.id}.docsUrl`);
    }
    object(pkg.maintainer, ["name", "url"], `${pkg.id}.maintainer`);
    text(pkg.maintainer.name, `${pkg.id}.maintainer.name`);
    https(pkg.maintainer.url, `${pkg.id}.maintainer.url`);
    object(
      pkg.provenance,
      ["ref", "commit", "reviewedAt", "url", "kind"],
      `${pkg.id}.provenance`,
    );
    text(pkg.provenance.ref, `${pkg.id}.provenance.ref`);
    if (!/^[a-f0-9]{40}$/.test(pkg.provenance.commit)) {
      fail(pkg.id, "provenance.commit must be a full Git SHA");
    }
    const reviewedAt = pkg.provenance.reviewedAt;
    if (
      typeof reviewedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt) ||
      !Number.isFinite(Date.parse(reviewedAt)) ||
      new Date(reviewedAt).toISOString().slice(0, 10) !== reviewedAt
    )
      fail(pkg.id, "provenance.reviewedAt must be a valid YYYY-MM-DD date");
    if (!["source", "release"].includes(pkg.provenance.kind)) {
      fail(pkg.id, "provenance.kind must be source or release");
    }
    const evidence = https(pkg.provenance.url, `${pkg.id}.provenance.url`);
    if (
      !pkg.provenance.url.startsWith(`${pkg.repository}/`) ||
      !evidence.pathname.split("/").includes(pkg.provenance.commit)
    )
      fail(
        pkg.id,
        "provenance.url must identify this repository and exact commit",
      );
  }
  return freeze(
    structuredClone(records).sort((a, b) => a.id.localeCompare(b.id, "en")),
  );
}

const directory =
  typeof __PORTAL_CATALOG_SOURCE__ === "string"
    ? new URL(__PORTAL_CATALOG_SOURCE__)
    : new URL("../data/catalog/", import.meta.url);
const records = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const file = new URL(name, directory);
    if (lstatSync(file).isSymbolicLink())
      fail(name, "data files must not be symlinks");
    return JSON.parse(readFileSync(file, "utf8"));
  });

export const packages = validateCatalog(records);
export const getPackage = (id) => packages.find((pkg) => pkg.id === id);

/** Local paths are site-root relative; the supplied base may be /docs/ or an HTTPS site URL. */
export function withBase(url, base = "") {
  if (url.startsWith("https://")) {
    https(url, "link");
    return url;
  }
  if (
    !/^\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]*\/?$/.test(url) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(url)
  ) {
    fail("link", "must be an HTTPS URL or a site-root relative path");
  }
  if (base === "" || base === "/") return url;
  if (base.startsWith("https://")) {
    const parsed = https(base, "base");
    if (parsed.search || parsed.hash)
      fail("base", "must not contain a query or fragment");
  } else if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*\/?$/.test(base)) {
    fail("base", "must be an HTTPS URL or a site-root relative path");
  }
  return `${base.replace(/\/+$/, "")}${url}`;
}

export function markdownText(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+\-.!|~]/g, "\\$&");
}

const link = (label, url) => `[${markdownText(label)}](<${url}>)`;

/** Complete Markdown detail document, generated from the same records as the HTML catalog. */
export function packageMarkdown(pkg, base = "") {
  validateCatalog([pkg]);
  const source =
    pkg.provenance.kind === "source" ? "Source revision" : "Release reference";
  const documentation = pkg.docsUrl.startsWith("/")
    ? `${pkg.docsUrl}index.md`
    : pkg.docsUrl;
  return [
    `# ${markdownText(pkg.name)}`,
    "",
    `> ${markdownText(pkg.summary)}`,
    "",
    `- Package: ${markdownText(pkg.id)}`,
    `- Collection: ${familyLabels[pkg.family]}`,
    `- Kind: ${pkg.kind}`,
    `- Relationship: ${pkg.relationship} (${link("evidence", pkg.relationshipEvidence)})`,
    `- Maintainer: ${link(pkg.maintainer.name, pkg.maintainer.url)}`,
    `- PHP requirement: ${markdownText(pkg.php)}`,
    `- License: ${markdownText(pkg.license)}`,
    "",
    "## Compatibility",
    "",
    ...pkg.compatibility.map(
      (entry) =>
        `- ${ecosystemLabels[entry.ecosystem]}: ${markdownText(entry.constraint)} (${link("source", entry.evidence)})`,
    ),
    "",
    "Requirements are recorded from the linked source revision. A catalog listing does not verify an application's dependency resolution or runtime behavior.",
    "",
    "## Source and version",
    "",
    `- ${source}: ${link(pkg.provenance.commit, pkg.provenance.url)}`,
    `- Reference inspected: ${markdownText(pkg.provenance.ref)}`,
    `- Metadata reviewed: ${pkg.provenance.reviewedAt}`,
    "",
    pkg.provenance.kind === "source"
      ? "This is a source snapshot. A released package version and release stability have not been established for this record. Development constraints such as @dev remain explicit."
      : "The recorded release reference is scoped to this revision; it is not a claim that this is the newest release.",
    "",
    "## Links",
    "",
    `- ${link("Documentation", withBase(documentation, base))}`,
    `- ${link("Repository", pkg.repository)}`,
    `- ${link("Package catalog", withBase("/packages/index.md", base))}`,
    "",
  ].join("\n");
}

/** Complete Markdown discovery document; external packages remain metadata-only entries. */
export function catalogMarkdown(base = "") {
  return [
    "# Package catalog",
    "",
    "> Packages for Yii2, Yii3 and PHP, with compatibility evidence and source revisions.",
    "",
    "Maintained projects and community packages have separate relationship labels. Listing a package does not imply an official Yii affiliation or execute its code. Source revisions are not release claims.",
    "",
    ...packages.flatMap((pkg) => [
      `## ${link(pkg.name, withBase(`/packages/${pkg.id}/index.md`, base))}`,
      "",
      markdownText(pkg.summary),
      "",
      `- Package: ${markdownText(pkg.id)}`,
      `- Collection: ${familyLabels[pkg.family]}; relationship: ${pkg.relationship}`,
      `- PHP requirement: ${markdownText(pkg.php)}`,
      ...pkg.compatibility.map(
        (entry) =>
          `- ${ecosystemLabels[entry.ecosystem]}: ${markdownText(entry.constraint)}`,
      ),
      `- ${link(pkg.provenance.kind === "source" ? "Source revision" : "Release reference", pkg.provenance.url)}; reviewed ${pkg.provenance.reviewedAt}`,
      "",
    ]),
  ].join("\n");
}

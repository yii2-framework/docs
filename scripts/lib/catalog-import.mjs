// Pure functions of the catalog importer (`scripts/catalog-import.mjs`) and refresh (`scripts/catalog-refresh.mjs`):
// Packagist metadata expansion, revision choice, URL shapes per Git host and the derivation of each record field.
// Nothing here reads files or the network, so the tests run on fixtures.

/** Vendors whose packages form a maintained collection of this site; every other vendor is `community`. */
export const MAINTAINED_VENDORS = Object.freeze([
  "yii2-extensions",
  "php-forge",
  "ui-awesome",
]);

/** Record keys in the order the catalog files use. `stats` is the only optional one. */
export const RECORD_KEYS = Object.freeze([
  "id",
  "name",
  "summary",
  "family",
  "topic",
  "tags",
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
  "stats",
]);

/** Fields `mergeCurated()` keeps from the existing record. */
export const CURATED_KEYS = Object.freeze([
  "name",
  "summary",
  "family",
  "topic",
  "tags",
  "relationship",
  "kind",
  "maintainer",
  "ecosystems",
]);

/** Project-wide landing pages that many packages give as `homepage`; they are not package documentation. */
const UMBRELLA_HOSTS = new Set([
  "yiiframework.com",
  "symfony.com",
  "laravel.com",
]);

const SHA = /^[a-f0-9]{40}$/;

/**
 * Expands a Packagist p2 version list exactly like `Composer\MetadataMinifier\MetadataMinifier::expand()`: the first
 * entry is complete, each later entry is a shallow diff against the previously expanded one and `"__unset"` removes
 * a key.
 *
 * @param {unknown} minified The `packages[<id>]` array of a p2 response.
 * @returns {Record<string, unknown>[]}
 */
export function expandVersions(minified) {
  if (!Array.isArray(minified)) throw new TypeError("expected a version list");
  const expanded = [];
  let current = null;
  for (const diff of minified) {
    if (current === null) {
      current = { ...diff };
    } else {
      for (const [key, value] of Object.entries(diff)) {
        if (value === "__unset") delete current[key];
        else current[key] = value;
      }
    }
    expanded.push({ ...current });
  }
  return expanded;
}

const modifier =
  /[._-]?(?:(stable|beta|b|rc|alpha|a|patch|pl|p)((?:[.-]?\d+)*)?)?([.-]?dev)?(?:\+.*)?$/;

/**
 * Port of `Composer\Semver\VersionParser::parseStability()`: `dev`, `alpha`, `beta`, `RC` or `stable`
 * (`-patch`, `-pl` and `-p` suffixes are stable).
 *
 * @param {string} versionNormalized A `version_normalized` value.
 * @returns {"dev" | "alpha" | "beta" | "RC" | "stable"}
 */
export function parseStability(versionNormalized) {
  const version = String(versionNormalized).replace(/#.+$/, "");
  if (version.startsWith("dev-") || version.endsWith("-dev")) return "dev";
  const match = version.toLowerCase().match(modifier);
  if (match?.[3]) return "dev";
  const stability = match?.[1];
  if (stability === "beta" || stability === "b") return "beta";
  if (stability === "alpha" || stability === "a") return "alpha";
  if (stability === "rc") return "RC";
  return "stable";
}

/** The 40-hex commit of an expanded version, from `source.reference` or `dist.reference`. */
function commitOf(meta) {
  const commit = meta?.source?.reference ?? meta?.dist?.reference;
  if (typeof commit !== "string" || !SHA.test(commit))
    throw new Error(
      `version ${meta?.version} has no full commit SHA in its source reference`,
    );
  return commit;
}

/**
 * Picks the revision to pin: the first stable tag in list order (Packagist lists versions newest first) as a
 * `release`; without any tag, the `default-branch` entry of `~dev` as a `source` revision. Tags that are all
 * pre-releases are refused unless `allowPrerelease` is set (then the first one is pinned with `prerelease: true`).
 *
 * @param {Record<string, any>[]} tags Expanded p2 versions.
 * @param {Record<string, any>[]} dev Expanded p2 `~dev` versions.
 * @param {{ allowPrerelease?: boolean }} [options]
 * @returns {{ kind: "release" | "source", ref: string, commit: string, meta: Record<string, any>, prerelease?: true }}
 */
export function chooseRevision(tags, dev, { allowPrerelease = false } = {}) {
  const stable = tags.find(
    (meta) => parseStability(meta.version_normalized) === "stable",
  );
  if (stable)
    return {
      kind: "release",
      ref: stable.version,
      commit: commitOf(stable),
      meta: stable,
    };
  if (tags.length > 0) {
    if (!allowPrerelease)
      throw new Error(
        `only pre-release tags are published (newest ${tags[0].version}); add the record manually or allow pre-releases`,
      );
    return {
      kind: "release",
      ref: tags[0].version,
      commit: commitOf(tags[0]),
      meta: tags[0],
      prerelease: true,
    };
  }
  const branch = dev.find((meta) => meta["default-branch"] === true);
  if (branch)
    return {
      kind: "source",
      ref: String(branch.version).replace(/^dev-/, ""),
      commit: commitOf(branch),
      meta: branch,
    };
  throw new Error("Packagist lists no tag and no default branch");
}

/**
 * Canonical repository URL: HTTPS, lower-case host, no credentials, no `.git` suffix and no trailing slash
 * (`git@github.com:o/r.git` and `http://github.com/o/r/` become `https://github.com/o/r`).
 *
 * @param {string} url
 */
export function normalizeRepository(url) {
  if (typeof url !== "string" || url.trim() === "")
    throw new Error("no repository URL");
  let value = url.trim();
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(value);
  if (scp) value = `https://${scp[1]}/${scp[2]}`;
  value = value.replace(/^(?:git|http|ssh|git\+ssh):\/\//i, "https://");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`invalid repository URL ${url}`);
  }
  if (parsed.protocol !== "https:")
    throw new Error(`invalid repository URL ${url}`);
  const path = parsed.pathname.replace(/\/+$/, "").replace(/\.git$/i, "");
  if (path.split("/").filter(Boolean).length < 2)
    throw new Error(
      `repository URL ${url} does not name an owner and a repository`,
    );
  return `https://${parsed.hostname.toLowerCase()}${path}`;
}

/** Host and owner/repository path parts of a normalised repository URL. */
function repositoryParts(repository) {
  const parsed = new URL(repository);
  return {
    host: parsed.hostname,
    path: parsed.pathname.replace(/^\/+/, ""),
  };
}

const encodePath = (path) =>
  String(path)
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

function checkCommit(commit) {
  if (!SHA.test(commit)) throw new Error(`invalid commit ${commit}`);
}

/**
 * Web URL of a file at a commit: `blob/<sha>/` on GitHub, `-/blob/<sha>/` on GitLab, `src/<sha>/` on Bitbucket.
 * Other hosts have no known convention and throw.
 *
 * @param {string} repository Normalised repository URL.
 * @param {string} commit 40-hex SHA.
 * @param {string} path File path inside the repository.
 */
export function blobUrl(repository, commit, path) {
  checkCommit(commit);
  const { host } = repositoryParts(repository);
  const file = encodePath(path);
  if (host === "github.com") return `${repository}/blob/${commit}/${file}`;
  if (host === "gitlab.com") return `${repository}/-/blob/${commit}/${file}`;
  if (host === "bitbucket.org") return `${repository}/src/${commit}/${file}`;
  throw new Error(
    `unsupported Git host ${host}; only github.com, gitlab.com and bitbucket.org are known`,
  );
}

/**
 * Raw content URL of a file at a commit (`raw.githubusercontent.com`, GitLab `-/raw/`, Bitbucket `raw/`).
 * Other hosts throw.
 *
 * @param {string} repository Normalised repository URL.
 * @param {string} commit 40-hex SHA.
 * @param {string} path File path inside the repository.
 */
export function rawUrl(repository, commit, path) {
  checkCommit(commit);
  const { host, path: slug } = repositoryParts(repository);
  const file = encodePath(path);
  if (host === "github.com")
    return `https://raw.githubusercontent.com/${slug}/${commit}/${file}`;
  if (host === "gitlab.com") return `${repository}/-/raw/${commit}/${file}`;
  if (host === "bitbucket.org") return `${repository}/raw/${commit}/${file}`;
  throw new Error(
    `unsupported Git host ${host}; only github.com, gitlab.com and bitbucket.org are known`,
  );
}

/** The file path of a blob URL of `repository` at `commit`, or `null` when the URL is not one. */
export function blobPath(url, repository, commit) {
  if (typeof url !== "string" || !url.startsWith(`${repository}/`)) return null;
  const marker = `/${commit}/`;
  const index = url.indexOf(marker, repository.length);
  if (index === -1) return null;
  const path = url.slice(index + marker.length);
  return path === "" ? null : decodeURIComponent(path);
}

function requireObject(require) {
  if (require === null || typeof require !== "object" || Array.isArray(require))
    throw new Error("composer.json has no require section");
  return require;
}

function phpOf(require) {
  const php = require.php;
  if (typeof php !== "string" || php.trim() === "")
    throw new Error("composer.json declares no PHP requirement (require.php)");
  return php;
}

/** `yiisoft/*` requirements that are Yii3 packages (not `yiisoft/yii2*`), as `"<pkg> <constraint>"`, in order. */
function yii3Requirements(require) {
  return Object.entries(require)
    .filter(
      ([name]) =>
        name.startsWith("yiisoft/") && !name.startsWith("yiisoft/yii2"),
    )
    .map(([name, constraint]) => `${name} ${constraint}`);
}

/**
 * The constraint of one ecosystem from a `require` section: `yii2` is the literal `yiisoft/yii2` constraint, `yii3`
 * the Yii3 `yiisoft/*` requirements joined with `; ` and `php` the literal PHP requirement. Throws when absent.
 *
 * @param {"yii2" | "yii3" | "php"} ecosystem
 * @param {Record<string, string>} require
 */
export function ecosystemConstraint(ecosystem, require) {
  requireObject(require);
  if (ecosystem === "php") return phpOf(require);
  if (ecosystem === "yii2") {
    const constraint = require["yiisoft/yii2"];
    if (typeof constraint !== "string" || constraint.trim() === "")
      throw new Error("composer.json does not require yiisoft/yii2");
    return constraint;
  }
  if (ecosystem === "yii3") {
    const parts = yii3Requirements(require);
    if (parts.length === 0)
      throw new Error("composer.json requires no Yii3 yiisoft/* package");
    return parts.join("; ");
  }
  throw new Error(`unknown ecosystem ${ecosystem}`);
}

/**
 * Ecosystem, compatibility and PHP requirement from `require`: `yiisoft/yii2` makes it `yii2`; otherwise any Yii3
 * `yiisoft/*` package makes it `yii3`; otherwise it is `php`. Every compatibility entry cites `evidenceUrl`.
 *
 * @param {Record<string, string>} require The `require` section of composer.json.
 * @param {string} evidenceUrl composer.json at the pinned commit.
 * @returns {{ ecosystems: string[], compatibility: { ecosystem: string, constraint: string, evidence: string }[], php: string }}
 */
export function deriveEcosystems(require, evidenceUrl) {
  requireObject(require);
  const php = phpOf(require);
  const ecosystem = Object.hasOwn(require, "yiisoft/yii2")
    ? "yii2"
    : yii3Requirements(require).length > 0
      ? "yii3"
      : "php";
  return {
    ecosystems: [ecosystem],
    compatibility: [
      {
        ecosystem,
        constraint: ecosystemConstraint(ecosystem, require),
        evidence: evidenceUrl,
      },
    ],
    php,
  };
}

/** An HTTPS URL without credentials, or `null`. */
function httpsUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

const comparable = (url) =>
  `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "").replace(/\.git$/, "")}`.toLowerCase();

/**
 * Documentation URL of a new record: an HTTPS `support.docs` first; then `homepage` when it is not the repository,
 * not on github.com or packagist.org and not a project-wide landing page (`https://www.yiiframework.com/`); else the
 * README at the pinned commit; else the repository.
 *
 * @param {Record<string, any>} composer composer.json at the commit.
 * @param {Record<string, any> | null} packagist The pinned p2 version (fallback for `support` and `homepage`).
 * @param {string} repository Normalised repository URL.
 * @param {string} commit Pinned commit.
 * @param {string | null} readmePath README path at the commit, or `null` when there is none.
 * @returns {{ url: string, source: "support.docs" | "homepage" | "readme" | "repository" }}
 */
export function deriveDocsUrl(
  composer,
  packagist,
  repository,
  commit,
  readmePath,
) {
  const docs = httpsUrl(composer?.support?.docs ?? packagist?.support?.docs);
  if (docs) return { url: docs.href, source: "support.docs" };
  const homepage = httpsUrl(composer?.homepage ?? packagist?.homepage);
  if (homepage) {
    const host = homepage.hostname.replace(/^www\./, "");
    const repo = comparable(new URL(repository));
    const page = comparable(homepage);
    const umbrella =
      UMBRELLA_HOSTS.has(host) && homepage.pathname.replace(/\/+$/, "") === "";
    if (
      page !== repo &&
      !page.startsWith(`${repo}/`) &&
      host !== "github.com" &&
      host !== "packagist.org" &&
      !umbrella
    )
      return { url: homepage.href, source: "homepage" };
  }
  if (readmePath)
    return { url: blobUrl(repository, commit, readmePath), source: "readme" };
  return { url: repository, source: "repository" };
}

/**
 * Maintainer link: the first author whose homepage is a GitHub profile (`{ name, url: https://github.com/<user> }`),
 * else the repository owner on its host.
 *
 * @param {Record<string, any>} composer composer.json at the commit.
 * @param {string} repository Normalised repository URL.
 * @returns {{ name: string, url: string, source: "author" | "owner" }}
 */
export function deriveMaintainer(composer, repository) {
  const authors = Array.isArray(composer?.authors) ? composer.authors : [];
  for (const author of authors) {
    const match =
      typeof author?.homepage === "string" &&
      /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/?$/.exec(
        author.homepage.trim(),
      );
    if (match) {
      const name =
        typeof author.name === "string" && author.name.trim() !== ""
          ? author.name.trim()
          : match[1];
      return { name, url: `https://github.com/${match[1]}`, source: "author" };
    }
  }
  const parsed = new URL(repository);
  const owner = parsed.pathname.split("/").filter(Boolean)[0];
  return { name: owner, url: `${parsed.origin}/${owner}`, source: "owner" };
}

/**
 * Family and relationship: a maintained vendor is its own family with `maintained` (or `contributed` when given);
 * any other vendor is `community` with `community` (or `contributed`). `maintained` for a community vendor throws.
 *
 * @param {string} vendor
 * @param {string} [relationship] `community`, `contributed` or `maintained` from the command line.
 * @returns {{ family: string, relationship: string }}
 */
export function deriveFamily(vendor, relationship) {
  if (
    relationship !== undefined &&
    !["community", "contributed", "maintained"].includes(relationship)
  )
    throw new Error(
      `unknown relationship ${relationship}; use community, contributed or maintained`,
    );
  if (MAINTAINED_VENDORS.includes(vendor))
    return {
      family: vendor,
      relationship:
        relationship === "contributed" ? "contributed" : "maintained",
    };
  if (relationship === "maintained")
    throw new Error(
      `${vendor} is not a maintained collection; use community or contributed`,
    );
  return {
    family: "community",
    relationship: relationship === "contributed" ? "contributed" : "community",
  };
}

/**
 * Record kind from the Composer `type`: `yii2-extension` is an extension, `project` a template,
 * `phpstan-extension` and `composer-plugin` tools, anything else a library.
 *
 * @param {unknown} type
 */
export function deriveKind(type) {
  if (type === "yii2-extension") return "extension";
  if (type === "project") return "template";
  if (type === "phpstan-extension" || type === "composer-plugin") return "tool";
  return "library";
}

/**
 * Display name guessed from the package name: a `yii2-`, `yii3-` or `yii-` prefix is dropped and the words are
 * separated by spaces with the first one capitalised (`yiisoft/yii2-queue` becomes `Queue`).
 *
 * @param {string} id vendor/package
 */
export function humanName(id) {
  const name = String(id).split("/").pop() ?? "";
  const words = (name.replace(/^yii[23]?-(?=.)/, "") || name)
    .split(/[-_.]+/)
    .filter(Boolean);
  if (words.length === 0) return name;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

/** `true` for empty or placeholder text such as `"_____"`, `"TODO"` or `"..."`. */
export function isPlaceholder(value) {
  return (
    typeof value !== "string" ||
    /^[\s_.\-*#]*$/.test(value) ||
    /^(?:todo|tbd|description|package description)\.?$/i.test(value.trim())
  );
}

/**
 * Summary from a composer description: one line, single spaces, ending with a full stop.
 *
 * @param {string} description
 */
export function summaryFrom(description) {
  let summary = String(description).replace(/\s+/g, " ").trim();
  if (summary !== "" && !/[.!?]$/.test(summary)) summary += ".";
  return summary;
}

/**
 * SPDX license text of a composer `license` (string or array; several licenses are joined with ` OR `), or `null`.
 *
 * @param {unknown} license
 */
export function licenseFrom(license) {
  const list = (Array.isArray(license) ? license : [license]).filter(
    (value) => typeof value === "string" && value.trim() !== "",
  );
  return list.length === 0
    ? null
    : list.map((value) => value.trim()).join(" OR ");
}

/**
 * Stats of a `packages/<id>.json` response, or `null` when a figure is missing.
 *
 * @param {Record<string, any> | null} info The `package` object.
 * @param {string} fetchedAt YYYY-MM-DD.
 */
export function statsFrom(info, fetchedAt) {
  const stats = {
    downloadsMonthly: info?.downloads?.monthly,
    downloadsTotal: info?.downloads?.total,
    favers: info?.favers,
    fetchedAt,
  };
  for (const key of ["downloadsMonthly", "downloadsTotal", "favers"]) {
    if (!Number.isSafeInteger(stats[key]) || stats[key] < 0) return null;
  }
  return stats;
}

/**
 * A record with the catalog key order; `stats` is left out when absent and unknown keys are dropped.
 *
 * @param {Record<string, any>} inputs
 */
export function buildRecord(inputs) {
  const record = {};
  for (const key of RECORD_KEYS) {
    if (inputs[key] === undefined) {
      if (key === "stats") continue;
      throw new Error(`record field ${key} is missing`);
    }
    record[key] = inputs[key];
  }
  record.compatibility = record.compatibility.map((item) => ({
    ecosystem: item.ecosystem,
    constraint: item.constraint,
    evidence: item.evidence,
  }));
  record.maintainer = {
    name: record.maintainer.name,
    url: record.maintainer.url,
  };
  record.provenance = {
    ref: record.provenance.ref,
    commit: record.provenance.commit,
    reviewedAt: record.provenance.reviewedAt,
    url: record.provenance.url,
    kind: record.provenance.kind,
  };
  if (record.stats)
    record.stats = {
      downloadsMonthly: record.stats.downloadsMonthly,
      downloadsTotal: record.stats.downloadsTotal,
      favers: record.stats.favers,
      fetchedAt: record.stats.fetchedAt,
    };
  return record;
}

/**
 * Moves a URL that points at a file of `from.repository` at `from.commit` to the same path of `to.repository` at
 * `to.commit`; other URLs are returned unchanged with `path: null`.
 */
function moveUrl(url, from, to) {
  const path = blobPath(url, from.repository, from.commit);
  if (path === null) return { url, path: null };
  return { url: blobUrl(to.repository, to.commit, path), path };
}

/**
 * `--update` merge: keeps the curated fields (`CURATED_KEYS`) and a local `docsUrl` of `existing`; re-derives `php`
 * and the compatibility of the kept ecosystems from `require` (throws when a kept ecosystem cannot be derived); moves
 * `relationshipEvidence` and an external `docsUrl` that point at the old commit to the same path at the new commit;
 * takes repository, license, provenance and stats from `generated`.
 *
 * @param {Record<string, any>} existing The current record.
 * @param {Record<string, any>} generated The freshly derived record.
 * @param {Record<string, string>} require The `require` section of composer.json at the new commit.
 * @returns {{ record: Record<string, any>, changes: string[], moves: { field: string, from: string, to: string, path: string }[] }}
 */
export function mergeCurated(existing, generated, require) {
  const merged = { ...generated };
  for (const key of CURATED_KEYS) merged[key] = structuredClone(existing[key]);
  const changes = [];
  const moves = [];
  const evidence = generated.provenance.url;
  merged.php = phpOf(requireObject(require));
  merged.compatibility = existing.ecosystems.map((ecosystem) => {
    let constraint;
    try {
      constraint = ecosystemConstraint(ecosystem, require);
    } catch (error) {
      throw new Error(
        `the kept ecosystem ${ecosystem} cannot be derived at ${generated.provenance.ref}: ${error.message}`,
      );
    }
    const before = existing.compatibility.find(
      (item) => item.ecosystem === ecosystem,
    );
    if (before?.constraint !== constraint)
      changes.push(
        `${ecosystem} constraint: ${before?.constraint ?? "(none)"} -> ${constraint}`,
      );
    return { ecosystem, constraint, evidence };
  });
  if (existing.php !== merged.php)
    changes.push(`php: ${existing.php} -> ${merged.php}`);
  const from = {
    repository: existing.repository,
    commit: existing.provenance.commit,
  };
  const to = {
    repository: generated.repository,
    commit: generated.provenance.commit,
  };
  for (const field of ["relationshipEvidence", "docsUrl"]) {
    if (field === "docsUrl" && existing.docsUrl.startsWith("/")) {
      merged.docsUrl = existing.docsUrl;
      continue;
    }
    const moved = moveUrl(existing[field], from, to);
    merged[field] = moved.url;
    if (moved.path !== null && moved.url !== existing[field])
      moves.push({
        field,
        from: existing[field],
        to: moved.url,
        path: moved.path,
      });
  }
  if (existing.repository !== merged.repository)
    changes.push(`repository: ${existing.repository} -> ${merged.repository}`);
  if (existing.license !== merged.license)
    changes.push(`license: ${existing.license} -> ${merged.license}`);
  return { record: buildRecord(merged), changes, moves };
}

const INDENT = "    ";
const WIDTH = 80;

const isPrimitive = (value) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

function printValue(value, indent, column, suffix) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = indent + INDENT;
    if (value.every(isPrimitive)) {
      const flat = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
      if (column + flat.length + suffix.length <= WIDTH) return flat;
    }
    const lines = value.map((item, index) => {
      const comma = index < value.length - 1 ? "," : "";
      return `${inner}${printValue(item, inner, inner.length, comma)}${comma}`;
    });
    return `[\n${lines.join("\n")}\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const inner = indent + INDENT;
    const lines = entries.map(([key, item], index) => {
      const comma = index < entries.length - 1 ? "," : "";
      const head = `${inner}${JSON.stringify(key)}: `;
      return `${head}${printValue(item, inner, head.length, comma)}${comma}`;
    });
    return `{\n${lines.join("\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/**
 * JSON text of a record as Prettier 3.8.4 formats the catalog files (`.prettierrc.json`: 4 spaces, 80 columns):
 * objects expanded, arrays of scalars on one line when they fit, otherwise one item per line; final newline.
 *
 * @param {Record<string, unknown>} record
 */
export function formatRecord(record) {
  return `${printValue(record, "", 0, "")}\n`;
}

#!/usr/bin/env node
// Imports a Composer package from its public Packagist metadata into `src/data/catalog/<vendor>--<package>.json`.
//
// The revision is the newest stable tag (a `release`), or the default branch when no tag exists (a `source`
// revision). Fields come from composer.json at that commit: ecosystems and constraints from `require`, kind from
// `type`, tags from `keywords` (normalised, unless `--tags` is given), the documentation URL from `support.docs`, a
// documentation `homepage` or the README at the commit, and statistics from the Packagist package JSON. Packages
// that are not on Packagist, abandoned packages and placeholder metadata are refused. The record is validated with
// the other records before it is written; the report lists the chosen revision, the derived fields and what a
// reviewer should check.
//
// With `--update` the curated fields of the existing record are kept (name, summary, family, topic, tags,
// relationship, kind, maintainer, ecosystems and a local `docsUrl`); constraints are re-derived for the kept
// ecosystems, evidence and documentation links at the old commit move to the new commit, and provenance and
// statistics are replaced. `--topic`, `--tags` and `--relationship` override the kept values.
//
// Nothing is installed or executed: the importer only reads JSON and checks that files exist.
//
// Usage: node scripts/catalog-import.mjs <vendor/package> [--topic=<id>] [--relationship=<community|contributed>]
//   [--tags=a,b] [--update] [--dry-run] [--date=YYYY-MM-DD] [--allow-prerelease]
// Exit status: 0 on success, 1 on a refusal or validation error (one problem per line on stderr).

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getTopic,
  normalizeTags,
  topics,
  validateCatalog,
} from "../src/lib/catalog.mjs";
import {
  blobUrl,
  buildRecord,
  chooseRevision,
  deriveDocsUrl,
  deriveEcosystems,
  deriveFamily,
  deriveKind,
  deriveMaintainer,
  expandVersions,
  formatRecord,
  humanName,
  isPlaceholder,
  licenseFrom,
  mergeCurated,
  normalizeRepository,
  statsFrom,
  summaryFrom,
} from "./lib/catalog-import.mjs";
import { createClient } from "./lib/packagist.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Where the records live. */
export const CATALOG_DIR = path.join(ROOT, "src/data/catalog");

const PACKAGE_ID =
  /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** A refusal or validation failure; `problems` holds one line per problem. */
export class ImportError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [problems];
    super(list.join("\n"));
    this.problems = list;
  }
}

/** Today's date in UTC as YYYY-MM-DD. */
export const todayUtc = () => new Date().toISOString().slice(0, 10);

const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

/** File name of a record: `<vendor>--<package>.json`. */
export const recordFileName = (id) => `${id.replace("/", "--")}.json`;

/**
 * Parses the command line into import options; throws `ImportError` on unknown or malformed flags.
 *
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const options = {
    update: false,
    dryRun: false,
    allowPrerelease: false,
  };
  const positional = [];
  for (const arg of argv) {
    const [flag, ...rest] = arg.split("=");
    const value = rest.join("=");
    if (arg === "--update") options.update = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--allow-prerelease") options.allowPrerelease = true;
    else if (flag === "--topic" && value) options.topic = value;
    else if (flag === "--relationship" && value) options.relationship = value;
    else if (flag === "--date" && value) options.date = value;
    else if (flag === "--tags" && value)
      options.tags = value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    else if (arg.startsWith("-"))
      throw new ImportError(`unknown or empty option ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 1)
    throw new ImportError(
      "usage: node scripts/catalog-import.mjs <vendor/package> [--topic=<id>] [--relationship=<r>] [--tags=a,b] [--update] [--dry-run] [--date=YYYY-MM-DD]",
    );
  options.id = positional[0];
  return options;
}

/** All records of `catalogDir` except `skip`, parsed. */
function otherRecords(catalogDir, skip) {
  return readdirSync(catalogDir)
    .filter((name) => name.endsWith(".json") && name !== skip)
    .sort()
    .map((name) =>
      JSON.parse(readFileSync(path.join(catalogDir, name), "utf8")),
    );
}

/** Runs `fn` and turns any error into an `ImportError` prefixed with the package id. */
function attempt(id, fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError(`${id}: ${error.message}`);
  }
}

/** Whether a URL names a branch (not a 40-hex commit) after `/blob/` or `/tree/`. */
const pointsAtBranch = (url) =>
  /\/(?:-\/)?(?:blob|tree|src)\/(?![a-f0-9]{40}(?:\/|$))[^/]+/.test(
    new URL(url).pathname,
  );

const topicIds = () => topics.map((topic) => topic.id).join(", ");

/**
 * Derives (and with `--update` merges) the record of one package. Throws `ImportError` on any refusal.
 *
 * @param {{ id: string, topic?: string, relationship?: string, tags?: string[], update?: boolean, date?: string,
 *   allowPrerelease?: boolean }} options
 * @param {{ client: ReturnType<typeof createClient>, catalogDir?: string, today?: string }} context
 * @returns {Promise<{ record: Record<string, any>, file: string, existing: Record<string, any> | null,
 *   revision: { kind: string, ref: string, commit: string, prerelease?: true }, tagCount: number,
 *   derived: string[], review: string[], changes: string[] }>}
 */
export async function importPackage(options, context) {
  const { id, update = false, allowPrerelease = false } = options;
  const { client, catalogDir = CATALOG_DIR, today = todayUtc() } = context;
  const date = options.date ?? today;
  if (typeof id !== "string" || !PACKAGE_ID.test(id))
    throw new ImportError(
      `${id}: expected a lowercase vendor/package Composer name`,
    );
  if (!isDate(date))
    throw new ImportError(`--date=${date}: expected a valid YYYY-MM-DD date`);
  const [vendor] = id.split("/");
  const fileName = recordFileName(id);
  const file = path.join(catalogDir, fileName);
  const existing = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;
  if (existing && !update)
    throw new ImportError(
      `${id} is already in the catalog (${fileName}); use --update to refresh it`,
    );
  if (!existing && update)
    throw new ImportError(
      `${id} has no catalog record to update; import it without --update`,
    );
  const topic = options.topic ?? existing?.topic;
  if (topic === undefined)
    throw new ImportError(
      `--topic is required for a new record; one of: ${topicIds()}`,
    );
  if (getTopic(topic) === undefined)
    throw new ImportError(`unknown topic ${topic}; one of: ${topicIds()}`);

  const notListed = `${id} is not on Packagist; add the record manually, see /contribute/`;
  const tagList = await client.tags(id);
  if (tagList === null) throw new ImportError(notListed);
  const info = await client.info(id);
  if (info === null) throw new ImportError(notListed);
  const tags = attempt(id, () => expandVersions(tagList));
  // Branches matter only when no tag exists (the default branch is then pinned).
  const branchList = tags.length > 0 ? [] : await client.branches(id);
  const devVersions = attempt(id, () => expandVersions(branchList ?? []));
  const abandoned =
    info.abandoned ??
    tags.find((meta) => meta.abandoned !== undefined)?.abandoned ??
    devVersions.find((meta) => meta.abandoned !== undefined)?.abandoned;
  if (abandoned !== undefined && abandoned !== false)
    throw new ImportError(
      typeof abandoned === "string" && abandoned !== ""
        ? `${id} is abandoned on Packagist; it suggests ${abandoned} instead`
        : `${id} is abandoned on Packagist without a suggested replacement`,
    );
  const revision = attempt(id, () =>
    chooseRevision(tags, devVersions, { allowPrerelease }),
  );
  const { commit, meta } = revision;
  const repository = attempt(id, () =>
    normalizeRepository(info.repository || meta.source?.url),
  );
  const composer = await client.composerJson(repository, commit);
  if (composer === null || typeof composer !== "object")
    throw new ImportError(
      `${id}: no composer.json in ${repository} at ${commit}`,
    );
  if (String(composer.name).toLowerCase() !== id)
    throw new ImportError(
      `${id}: composer.json at ${commit} names ${composer.name}, not ${id}`,
    );
  const description = composer.description ?? meta.description;
  if (isPlaceholder(description))
    throw new ImportError(
      `${id}: composer.json has an empty or placeholder description; add the record manually, see /contribute/`,
    );
  const evidence = attempt(id, () =>
    blobUrl(repository, commit, "composer.json"),
  );
  const derivedEcosystems = attempt(id, () =>
    deriveEcosystems(composer.require, evidence),
  );
  const license = licenseFrom(composer.license ?? meta.license);
  if (license === null)
    throw new ImportError(`${id}: composer.json declares no license`);
  const stats = statsFrom(info, date);
  const { family, relationship } = attempt(id, () =>
    deriveFamily(vendor, options.relationship ?? existing?.relationship),
  );
  const kind = deriveKind(composer.type ?? meta.type);
  const keywords = composer.keywords ?? meta.keywords;
  const tagValues = options.tags ?? normalizeTags(keywords, { vendor, topic });
  if (tagValues.length === 0)
    throw new ImportError(
      `${id}: no usable keywords for tags; pass --tags=<tag>,<tag>`,
    );
  let docs = attempt(id, () =>
    deriveDocsUrl(composer, meta, repository, commit, null),
  );
  if (docs.source === "repository") {
    const readme = await client.readmePath(repository, commit);
    docs = attempt(id, () =>
      deriveDocsUrl(composer, meta, repository, commit, readme),
    );
  }
  const maintainer = deriveMaintainer(composer, repository);
  const generated = attempt(id, () =>
    buildRecord({
      id,
      name: humanName(id),
      summary: summaryFrom(description),
      family,
      topic,
      tags: tagValues,
      ...derivedEcosystems,
      kind,
      docsUrl: docs.url,
      repository,
      license,
      maintainer,
      relationship,
      relationshipEvidence: evidence,
      provenance: {
        ref: revision.ref,
        commit,
        reviewedAt: date,
        url: evidence,
        kind: revision.kind,
      },
      stats: stats ?? undefined,
    }),
  );

  const review = [];
  const changes = [];
  let record = generated;
  if (revision.prerelease)
    review.push(
      `revision: ${revision.ref} is a pre-release; no stable tag is published`,
    );
  if (revision.kind === "source")
    review.push(
      `revision: no tag is published; the default branch ${revision.ref} is pinned`,
    );
  if (stats === null)
    review.push(
      "stats: Packagist returned no download or favourite figures; stats are left out",
    );
  if (existing) {
    const merged = attempt(id, () =>
      mergeCurated(existing, generated, composer.require),
    );
    record = merged.record;
    if (options.topic !== undefined) record.topic = options.topic;
    if (options.tags !== undefined) record.tags = options.tags;
    if (options.relationship !== undefined) {
      record.family = family;
      record.relationship = relationship;
    }
    if (stats === null) delete record.stats;
    changes.push(...merged.changes);
    for (const move of merged.moves) {
      if (!(await client.exists(repository, commit, move.path)))
        throw new ImportError(
          `${id}: ${move.field} names ${move.path}, which does not exist at ${revision.ref}; fix the record by hand`,
        );
      changes.push(`${move.field} moved to ${revision.ref}: ${move.path}`);
    }
    review.push(...merged.changes.map((change) => `changed ${change}`));
  } else {
    review.push(
      `name: "${record.name}" was guessed from the package name`,
      `summary: ${record.summary.length} characters from the composer.json description${record.summary.length > 160 ? " (long; shorten it)" : ""}; rewrite it for readers if needed`,
      `kind: ${kind}, guessed from the composer type ${JSON.stringify(composer.type ?? meta.type ?? null)}`,
    );
    const docsNotes = {
      "support.docs": "support.docs of composer.json",
      homepage: "the composer.json homepage; check that it is documentation",
      readme:
        "the README at the pinned commit (no support.docs or documentation homepage)",
      repository: "the repository (no support.docs, homepage or README found)",
    };
    review.push(
      `docsUrl: ${docsNotes[docs.source]}${pointsAtBranch(docs.url) ? "; it points at a branch, not the pinned commit" : ""}`,
    );
    if (options.tags === undefined)
      review.push(
        `tags: normalised from the composer keywords ${JSON.stringify(keywords ?? [])}; curate them`,
      );
    if (maintainer.source === "owner")
      review.push(
        "maintainer: no author has a GitHub profile homepage; the repository owner is used",
      );
    if (relationship !== "community")
      review.push(
        `relationshipEvidence: composer.json at the commit; link evidence of the ${relationship} relationship if it does not show it`,
      );
  }

  const others = otherRecords(catalogDir, fileName);
  try {
    validateCatalog([...others, record]);
  } catch (error) {
    throw new ImportError(`${id}: ${error.message}`);
  }

  const derived = [
    `kind: ${record.kind}`,
    `family: ${record.family}, relationship: ${record.relationship}`,
    `topic: ${record.topic}`,
    `tags: ${record.tags.join(", ")}`,
    ...record.compatibility.map(
      (item) => `${item.ecosystem} constraint: ${item.constraint}`,
    ),
    `php: ${record.php}`,
    `license: ${record.license}`,
    `docsUrl: ${record.docsUrl}`,
    `maintainer: ${record.maintainer.name} <${record.maintainer.url}>`,
    record.stats
      ? `stats: ${record.stats.downloadsMonthly} downloads/month, ${record.stats.downloadsTotal} in total, ${record.stats.favers} favers (${record.stats.fetchedAt})`
      : "stats: none",
  ];
  return {
    record,
    file,
    existing,
    revision: {
      kind: revision.kind,
      ref: revision.ref,
      commit,
      ...(revision.prerelease ? { prerelease: true } : {}),
    },
    tagCount: tags.length,
    derived,
    review,
    changes,
  };
}

/**
 * Report text of an import result.
 *
 * @param {Awaited<ReturnType<typeof importPackage>>} result
 */
export function formatReport(result) {
  const { record, revision, tagCount } = result;
  const lines = [
    `${record.id}: ${revision.kind} ${revision.ref} (${revision.commit})${revision.kind === "release" ? `, newest stable of ${tagCount} tag(s)` : ""}`,
    "Derived:",
    ...result.derived.map((line) => `- ${line}`),
    "Review:",
    ...(result.review.length > 0
      ? result.review.map((line) => `- ${line}`)
      : ["- nothing flagged"]),
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Command-line entry point; returns the exit status.
 *
 * @param {string[]} argv
 * @param {{ client?: ReturnType<typeof createClient>, catalogDir?: string, today?: string,
 *   stdout?: { write(text: string): unknown }, stderr?: { write(text: string): unknown } }} [context]
 */
export async function run(argv, context = {}) {
  const {
    client = createClient(),
    catalogDir = CATALOG_DIR,
    today = todayUtc(),
    stdout = process.stdout,
    stderr = process.stderr,
  } = context;
  try {
    const options = parseArgs(argv);
    const result = await importPackage(options, { client, catalogDir, today });
    const text = formatRecord(result.record);
    if (options.dryRun) {
      stdout.write(text);
      stdout.write(formatReport(result));
      stdout.write("Dry run: nothing written.\n");
    } else {
      writeFileSync(result.file, text);
      stdout.write(formatReport(result));
      stdout.write(
        `Wrote ${path.relative(ROOT, result.file) || result.file}.\n`,
      );
    }
    return 0;
  } catch (error) {
    const problems =
      error instanceof ImportError
        ? error.problems
        : [String(error?.message ?? error)];
    for (const problem of problems)
      stderr.write(`[catalog-import] ${problem}\n`);
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await run(process.argv.slice(2));
}

#!/usr/bin/env node
// Refreshes the catalog records from Packagist, one package at a time.
//
// For every record of `src/data/catalog/`:
// - not on Packagist: skipped and listed as a manual record;
// - the newest stable tag differs from `provenance.ref` (or the record pins a `source` revision and a stable tag now
//   exists): re-imported with `catalog-import.mjs --update` semantics (curated fields kept, new provenance, new
//   `reviewedAt`, new stats);
// - otherwise, stats missing or at least `--stats-max-age` days old (default 7): only `stats` is replaced;
// - otherwise left alone.
// A package that became abandoned, or that cannot be re-imported, is reported as failed and left unchanged.
//
// The Markdown summary (a table of package, before, after and what changed) goes to stdout and, with
// `--summary=<file>`, to that file. `--dry-run` writes no record.
//
// Usage: node scripts/catalog-refresh.mjs [--dry-run] [--stats-max-age=<days>] [--summary=<file>]
// Exit status: 0 when nothing failed, and also when some records failed but at least one other record was
// refreshed (written, or reported as such with `--dry-run`): the summary then starts with a "Failed" section, so
// the refresh pull request still opens and shows the failures. 1 when records failed and none was refreshed.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateCatalog } from "../src/lib/catalog.mjs";
import {
  CATALOG_DIR,
  ImportError,
  importPackage,
  todayUtc,
} from "./catalog-import.mjs";
import {
  buildRecord,
  expandVersions,
  formatRecord,
  parseStability,
  statsFrom,
} from "./lib/catalog-import.mjs";
import { createClient } from "./lib/packagist.mjs";

const DAY = 86_400_000;

/**
 * Parses the command line.
 *
 * @param {string[]} argv
 * @returns {{ dryRun: boolean, statsMaxAge: number, summary: string | null }}
 */
export function parseArgs(argv) {
  const options = { dryRun: false, statsMaxAge: 7, summary: null };
  for (const arg of argv) {
    const [flag, ...rest] = arg.split("=");
    const value = rest.join("=");
    if (arg === "--dry-run") options.dryRun = true;
    else if (flag === "--stats-max-age" && /^\d+$/.test(value))
      options.statsMaxAge = Number(value);
    else if (flag === "--summary" && value) options.summary = value;
    else throw new Error(`unknown or malformed option ${arg}`);
  }
  return options;
}

const revisionText = (provenance) => `${provenance.ref} (${provenance.kind})`;

/** A Markdown table cell: one line, no backticks, pipes escaped. */
const cell = (value) =>
  String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/`/g, "")
    .replace(/\|/g, "\\|");

/**
 * Refreshes every record of `catalogDir` and returns what happened; records are written unless `dryRun`.
 *
 * @param {{ client: ReturnType<typeof createClient>, catalogDir?: string, today?: string, statsMaxAge?: number,
 *   dryRun?: boolean }} context
 * @returns {Promise<{ rows: { id: string, before: string, after: string, changes: string[] }[], manual: string[],
 *   problems: { id: string, message: string }[] }>}
 */
export async function refreshCatalog({
  client,
  catalogDir = CATALOG_DIR,
  today = todayUtc(),
  statsMaxAge = 7,
  dryRun = false,
}) {
  const rows = [];
  const manual = [];
  const problems = [];
  const files = readdirSync(catalogDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const name of files) {
    const file = path.join(catalogDir, name);
    const record = JSON.parse(readFileSync(file, "utf8"));
    const { id } = record;
    try {
      const tagList = await client.tags(id);
      if (tagList === null) {
        manual.push(id);
        continue;
      }
      const tags = expandVersions(tagList);
      const abandoned = tags.find(
        (meta) => meta.abandoned !== undefined,
      )?.abandoned;
      if (abandoned !== undefined && abandoned !== false)
        throw new Error(
          `abandoned on Packagist${typeof abandoned === "string" && abandoned ? `; it suggests ${abandoned}` : ""}; review the record by hand`,
        );
      const newest = tags.find(
        (meta) => parseStability(meta.version_normalized) === "stable",
      );
      const newRevision =
        newest !== undefined &&
        (record.provenance.kind === "source" ||
          newest.version !== record.provenance.ref);
      const age = record.stats
        ? (Date.parse(today) - Date.parse(record.stats.fetchedAt)) / DAY
        : Infinity;
      if (newRevision) {
        const result = await importPackage(
          { id, update: true, date: today },
          { client, catalogDir, today },
        );
        if (!dryRun) writeFileSync(file, formatRecord(result.record));
        rows.push({
          id,
          before: revisionText(record.provenance),
          after: revisionText(result.record.provenance),
          changes: [
            "revision",
            ...result.changes,
            result.record.stats ? "stats" : "stats removed",
          ],
        });
      } else if (age >= statsMaxAge) {
        const info = await client.info(id);
        if (info === null)
          throw new Error("Packagist returned no package JSON");
        if (info.abandoned !== undefined && info.abandoned !== false)
          throw new Error(
            `abandoned on Packagist${typeof info.abandoned === "string" && info.abandoned ? `; it suggests ${info.abandoned}` : ""}; review the record by hand`,
          );
        const stats = statsFrom(info, today);
        if (stats === null)
          throw new Error(
            "Packagist returned no download or favourite figures",
          );
        const updated = buildRecord({ ...record, stats });
        validateCatalog([updated]);
        if (!dryRun) writeFileSync(file, formatRecord(updated));
        rows.push({
          id,
          before: revisionText(record.provenance),
          after: revisionText(record.provenance),
          changes: [record.stats ? "stats" : "stats added"],
        });
      }
    } catch (error) {
      problems.push({
        id,
        message:
          error instanceof ImportError
            ? error.problems.join("; ")
            : error.message,
      });
    }
  }
  return { rows, manual, problems };
}

/**
 * Markdown summary of a refresh. Failed records come first, in a "Failed" section with one line per package, then
 * the table of refreshed records and the manual records.
 *
 * @param {Awaited<ReturnType<typeof refreshCatalog>>} result
 * @param {{ today: string, dryRun?: boolean }} options
 */
export function formatSummary(
  { rows, manual, problems },
  { today, dryRun = false },
) {
  const lines = [];
  if (problems.length > 0)
    lines.push(
      `## Failed: ${problems.length} record(s) left unchanged`,
      "",
      ...problems.map(
        (problem) => `- \`${problem.id}\`: ${cell(problem.message)}`,
      ),
      "",
    );
  lines.push(`## Catalog refresh, ${today}${dryRun ? " (dry run)" : ""}`, "");
  if (rows.length === 0) {
    lines.push("No record needed a change.", "");
  } else {
    lines.push(
      "| Package | Before | After | Changes |",
      "| --- | --- | --- | --- |",
      ...rows.map(
        (row) =>
          `| \`${row.id}\` | ${cell(row.before)} | ${cell(row.after)} | ${cell(row.changes.join("; "))} |`,
      ),
      "",
    );
  }
  if (manual.length > 0)
    lines.push(
      `Not on Packagist, kept as manual records: ${manual.map((id) => `\`${id}\``).join(", ")}.`,
      "",
    );
  return lines.join("\n");
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
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`[catalog-refresh] ${error.message}\n`);
    return 1;
  }
  let result;
  try {
    result = await refreshCatalog({
      client,
      catalogDir,
      today,
      statsMaxAge: options.statsMaxAge,
      dryRun: options.dryRun,
    });
  } catch (error) {
    stderr.write(`[catalog-refresh] ${error.message}\n`);
    return 1;
  }
  const summary = formatSummary(result, { today, dryRun: options.dryRun });
  stdout.write(summary);
  if (options.summary !== null) writeFileSync(options.summary, summary);
  for (const problem of result.problems)
    stderr.write(`[catalog-refresh] ${problem.id}: ${problem.message}\n`);
  // Failures alone fail the job; next to refreshed records they are listed in the pull request body instead.
  return result.problems.length > 0 && result.rows.length === 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await run(process.argv.slice(2));
}

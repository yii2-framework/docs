#!/usr/bin/env node
// Checks the package catalog without building the site: every record of `src/data/catalog/` is validated on its own
// (closed schema, topic, tag invariants) and then together (duplicate ids), its file name must be
// `<vendor>--<package>.json` of its id, and the Topic dropdown of the issue forms (`catalog-package.yml`, and
// `package.yml` when it has one) must list the topic titles of `src/data/catalog-topics.json` in order.
//
// It uses Node.js built-ins and `src/lib/*.mjs` only, so CI can run it without installing dependencies.
//
// Usage: node scripts/catalog-check.mjs
// Exit status: 0 when the catalog is valid, 1 otherwise (one problem per line on stderr).

import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * Loads `src/lib/catalog.mjs` for its validators without validating the repository records on import: the module's
 * own record directory is pointed at an empty temporary one (`__PORTAL_CATALOG_SOURCE__`), so one broken record
 * cannot hide the others. Topics and records are then validated explicitly.
 */
async function loadValidators() {
  const scratch = mkdtempSync(path.join(tmpdir(), "catalog-check-"));
  try {
    mkdirSync(path.join(scratch, "catalog"));
    writeFileSync(
      path.join(scratch, "catalog-topics.json"),
      JSON.stringify({
        topics: [
          { id: "placeholder", title: "Placeholder", summary: "Placeholder." },
        ],
      }),
    );
    globalThis.__PORTAL_CATALOG_SOURCE__ = pathToFileURL(
      `${path.join(scratch, "catalog")}/`,
    ).href;
    return await import("../src/lib/catalog.mjs");
  } finally {
    delete globalThis.__PORTAL_CATALOG_SOURCE__;
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Options of the dropdown with `id: <fieldId>` in an issue form, read line by line (no YAML dependency), or `null`
 * when the form has no such dropdown.
 *
 * @param {string} source Issue form YAML.
 * @param {string} fieldId
 * @returns {string[] | null}
 */
export function dropdownOptions(source, fieldId) {
  const lines = source.split(/\r?\n/);
  const indentOf = (line) => line.length - line.trimStart().length;
  const idIndex = lines.findIndex((line) => line.trim() === `id: ${fieldId}`);
  if (idIndex === -1) return null;
  const idIndent = indentOf(lines[idIndex]);
  let type = null;
  for (let index = idIndex - 1; index >= 0; index--) {
    const match = /^(\s*)-\s+type:\s*(\S+)\s*$/.exec(lines[index]);
    if (match && match[1].length + 2 === idIndent) {
      type = match[2];
      break;
    }
  }
  if (type !== "dropdown") return null;
  let optionsIndent = -1;
  const options = [];
  for (let index = idIndex + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const indent = indentOf(line);
    if (indent < idIndent || /^\s*-\s+type:/.test(line)) break;
    if (optionsIndent === -1) {
      if (line.trim() === "options:") optionsIndent = indent;
      continue;
    }
    if (indent <= optionsIndent) break;
    const item = /^\s*-\s+(.*?)\s*$/.exec(line);
    if (item) options.push(item[1].replace(/^(["'])(.*)\1$/, "$2"));
  }
  return optionsIndent === -1 ? null : options;
}

/**
 * Runs every check and returns the problems, one line each.
 *
 * @param {{ root?: string }} [options] Repository root (tests pass a temporary copy).
 * @returns {Promise<{ problems: string[], records: number, topics: number }>}
 */
export async function checkCatalog({ root = ROOT } = {}) {
  const { validateCatalog, validateTopics } = await loadValidators();
  const problems = [];
  const message = (error) =>
    error instanceof Error ? error.message : String(error);

  let topics = null;
  const topicsFile = path.join(root, "src/data/catalog-topics.json");
  try {
    topics = validateTopics(JSON.parse(readFileSync(topicsFile, "utf8")));
  } catch (error) {
    problems.push(`src/data/catalog-topics.json: ${message(error)}`);
  }

  const catalogDir = path.join(root, "src/data/catalog");
  const records = [];
  const files = new Map();
  let allValid = true;
  for (const name of readdirSync(catalogDir)
    .filter((file) => file.endsWith(".json"))
    .sort()) {
    const where = `src/data/catalog/${name}`;
    const file = path.join(catalogDir, name);
    if (lstatSync(file).isSymbolicLink()) {
      problems.push(`${where}: records must not be symlinks`);
      allValid = false;
      continue;
    }
    let record;
    try {
      record = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      problems.push(`${where}: invalid JSON (${message(error)})`);
      allValid = false;
      continue;
    }
    if (typeof record?.id === "string") {
      const expected = `${record.id.replace("/", "--")}.json`;
      if (expected !== name)
        problems.push(
          `${where}: the file of ${record.id} must be named ${expected}`,
        );
    }
    if (topics !== null) {
      try {
        validateCatalog([record], topics);
      } catch (error) {
        problems.push(`${where}: ${message(error)}`);
        allValid = false;
      }
    }
    records.push(record);
    if (typeof record?.id === "string")
      (files.get(record.id) ?? files.set(record.id, []).get(record.id)).push(
        name,
      );
  }
  for (const [id, names] of files) {
    if (names.length > 1) {
      problems.push(
        `src/data/catalog: ${id} is defined by ${names.join(" and ")}`,
      );
      allValid = false;
    }
  }
  if (topics !== null && allValid) {
    try {
      validateCatalog(records, topics);
    } catch (error) {
      problems.push(`src/data/catalog: ${message(error)}`);
    }
  }

  if (topics !== null) {
    const titles = topics.map((topic) => topic.title);
    for (const [form, required] of [
      ["catalog-package.yml", true],
      ["package.yml", false],
    ]) {
      const where = `.github/ISSUE_TEMPLATE/${form}`;
      const file = path.join(root, where);
      if (!existsSync(file)) {
        if (required) problems.push(`${where}: missing`);
        continue;
      }
      const options = dropdownOptions(readFileSync(file, "utf8"), "topic");
      if (options === null) {
        if (required) problems.push(`${where}: no Topic dropdown (id: topic)`);
        continue;
      }
      if (JSON.stringify(options) !== JSON.stringify(titles))
        problems.push(
          `${where}: the Topic options must be the topic titles in order: ${titles.join(" | ")} (found: ${options.join(" | ")})`,
        );
    }
  }
  return { problems, records: records.length, topics: topics?.length ?? 0 };
}

/**
 * Command-line entry point; returns the exit status.
 *
 * @param {{ root?: string, stdout?: { write(text: string): unknown }, stderr?: { write(text: string): unknown } }} [context]
 */
export async function run({
  root = ROOT,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const result = await checkCatalog({ root });
    for (const problem of result.problems)
      stderr.write(`[catalog-check] ${problem}\n`);
    if (result.problems.length > 0) return 1;
    stdout.write(
      `[catalog-check] ${result.records} records and ${result.topics} topics are valid.\n`,
    );
    return 0;
  } catch (error) {
    stderr.write(
      `[catalog-check] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await run();
}

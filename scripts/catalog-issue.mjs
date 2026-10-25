// Reads the body of an "Add a package from Packagist" issue (`.github/ISSUE_TEMPLATE/catalog-package.yml`) from the
// `ISSUE_BODY` environment variable and writes the validated fields as `name=value` lines to `$GITHUB_OUTPUT`
// (standard output when it is unset). The body is untrusted: it is parsed as text only, never evaluated, never passed
// to a shell, and no submitted value is echoed in an error message. Exits 1 with one line per problem on stderr.
//
// Usage: ISSUE_BODY="$(gh issue view 1 --json body --jq .body)" node scripts/catalog-issue.mjs
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Topic file read by default; it maps each Topic option (the title) to its id. */
export const TOPICS_FILE = new URL(
  "../src/data/catalog-topics.json",
  import.meta.url,
);

/** Field labels of the form, in the order GitHub renders them as `### <label>` headings. Notes stays last. */
export const FORM_LABELS = Object.freeze({
  package: "Composer package name",
  topic: "Topic",
  relationship: "Site curator's role in the package",
  policy: "Proposal policy",
  notes: "Notes",
});

/**
 * Relationship dropdown options and the record value each one selects. `maintained` is not offered: the importer
 * sets it for the maintained collections.
 */
export const RELATIONSHIP_OPTIONS = Object.freeze({
  "Independent community project": "community",
  "The site curator contributes to it": "contributed",
});

/** Required policy checkboxes, in form order; each must be rendered as checked (`- [X] <label>`). */
export const POLICY_LABELS = Object.freeze([
  "I have read the proposal policy above and searched the package directory for an existing listing.",
  "I understand that human review of a catalog data pull request is required before publication.",
]);

/** Same pattern as the record `id` in `src/lib/catalog.mjs`: no leading dash, spaces, `..` or upper case. */
export const PACKAGE_PATTERN =
  /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

const NO_RESPONSE = "_No response_";
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reads the topic file and returns its `{ id, title }` pairs in display order.
 *
 * @param {URL | string} [file] Path of `catalog-topics.json`.
 * @returns {{ id: string, title: string }[]}
 */
export function loadTopics(file = TOPICS_FILE) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason =
      error?.code === "ENOENT" ? "is missing" : "is not readable JSON";
    throw new Error(
      `src/data/catalog-topics.json ${reason}; it maps each Topic option to its id`,
    );
  }
  if (!Array.isArray(data?.topics) || data.topics.length === 0) {
    throw new Error("src/data/catalog-topics.json has no topics");
  }
  return data.topics.map((topic, index) => {
    if (
      typeof topic?.id !== "string" ||
      !slug.test(topic.id) ||
      typeof topic.title !== "string" ||
      topic.title === ""
    ) {
      throw new Error(
        `src/data/catalog-topics.json topic ${index} needs a slug id and a title`,
      );
    }
    return { id: topic.id, title: topic.title };
  });
}

/**
 * Splits the body into its sections, strictly: the sections must be exactly the form labels, in form order, with
 * nothing before the first one. Everything after the Notes heading belongs to Notes and is never parsed, so a
 * heading typed inside Notes cannot replace a field.
 *
 * @param {string} body
 * @returns {Map<string, string[]>} Lines of each section except Notes, keyed by label.
 */
function sections(body) {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const labels = Object.values(FORM_LABELS);
  const result = new Map();
  let index = 0;

  for (const label of labels) {
    while (index < lines.length && lines[index].trim() === "") index++;
    if (index >= lines.length || lines[index].trimEnd() !== `### ${label}`) {
      throw new Error(
        `the body must contain the form section "${label}" at its place; edit the issue so it matches the form`,
      );
    }
    index++;
    if (label === FORM_LABELS.notes) break;
    const block = [];
    while (index < lines.length && !lines[index].startsWith("### ")) {
      block.push(lines[index++]);
    }
    result.set(label, block);
  }
  return result;
}

/** Value of a single-line field, or `undefined` when empty, `_No response_` or spread over several lines. */
function singleLine(block) {
  const value = block.join("\n").trim();
  return value === "" || value === NO_RESPONSE || value.includes("\n")
    ? undefined
    : value;
}

/**
 * Parses and validates an issue form body.
 *
 * @param {unknown} body Issue body as GitHub renders it for the form.
 * @param {ReadonlyArray<{ id: string, title: string }>} topics Topic ids and titles (`loadTopics()`).
 * @returns {{ package: string, topic: string, relationship: string, branch: string }}
 * @throws {Error} With one line per problem.
 */
export function parseIssueBody(body, topics) {
  if (typeof body !== "string" || body.trim() === "") {
    throw new Error("the issue body is empty");
  }
  const found = sections(body);
  const problems = [];

  const pkg = singleLine(found.get(FORM_LABELS.package));
  if (pkg === undefined || !PACKAGE_PATTERN.test(pkg)) {
    problems.push(
      `"${FORM_LABELS.package}" must be one lowercase vendor/package name`,
    );
  }

  const title = singleLine(found.get(FORM_LABELS.topic));
  const topic = topics.find((candidate) => candidate.title === title);
  if (topic === undefined) {
    problems.push(`"${FORM_LABELS.topic}" must be one of the form's options`);
  }

  const option = singleLine(found.get(FORM_LABELS.relationship));
  const relationship = Object.hasOwn(RELATIONSHIP_OPTIONS, option ?? "")
    ? RELATIONSHIP_OPTIONS[option]
    : undefined;
  if (relationship === undefined) {
    problems.push(
      `"${FORM_LABELS.relationship}" must be one of the form's options`,
    );
  }

  const boxes = found
    .get(FORM_LABELS.policy)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const checked =
    boxes.length === POLICY_LABELS.length &&
    POLICY_LABELS.every((label, i) =>
      [`- [X] ${label}`, `- [x] ${label}`].includes(boxes[i]),
    );
  if (!checked) {
    problems.push(`every "${FORM_LABELS.policy}" box must be checked`);
  }

  if (problems.length > 0) throw new Error(problems.join("\n"));
  return {
    package: pkg,
    topic: topic.id,
    relationship,
    branch: `catalog/${pkg.replace(/[/.]/g, "-")}`,
  };
}

/** `name=value` lines for `$GITHUB_OUTPUT`; every value is validated and has no line break. */
export function outputLines(result) {
  return Object.entries(result)
    .map(([name, value]) => `${name}=${value}\n`)
    .join("");
}

function main() {
  try {
    const result = parseIssueBody(process.env.ISSUE_BODY, loadTopics());
    const lines = outputLines(result);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, lines);
    } else {
      process.stdout.write(lines);
    }
    console.log(
      `Issue form accepted: ${result.package}, topic ${result.topic}, relationship ${result.relationship}.`,
    );
  } catch (error) {
    for (const line of String(error.message).split("\n")) {
      console.error(`catalog-issue: ${line}`);
    }
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}

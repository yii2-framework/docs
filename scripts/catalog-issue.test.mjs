import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  FORM_LABELS,
  PACKAGE_PATTERN,
  POLICY_LABELS,
  RELATIONSHIP_OPTIONS,
  TOPICS_FILE,
  loadTopics,
  outputLines,
  parseIssueBody,
} from "./catalog-issue.mjs";

const root = new URL("../", import.meta.url);
const script = fileURLToPath(new URL("catalog-issue.mjs", import.meta.url));
const topics = [
  { id: "forms-widgets", title: "Forms and widgets" },
  { id: "data-modelling", title: "Data modelling" },
];

/** Issue body as GitHub renders the form; each field can be overridden with a raw section value. */
function body({
  pkg = "vendor/package",
  topic = "Forms and widgets",
  relationship = "Independent community project",
  policy = POLICY_LABELS.map((label) => `- [X] ${label}`).join("\n"),
  notes = "_No response_",
} = {}) {
  return [
    [FORM_LABELS.package, pkg],
    [FORM_LABELS.topic, topic],
    [FORM_LABELS.relationship, relationship],
    [FORM_LABELS.policy, policy],
    [FORM_LABELS.notes, notes],
  ]
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join("\n\n");
}

/**
 * Fields of an issue form, read line by line from the Prettier-formatted YAML of `.github/ISSUE_TEMPLATE/`:
 * `{ type, id, label, options }`, where options are dropdown options or checkbox labels.
 */
function formFields(file) {
  const fields = [];
  let current;
  let inOptions = false;
  const unquote = (value) => value.trim().replace(/^(["'])(.*)\1$/, "$2");
  for (const line of readFileSync(new URL(file, root), "utf8").split("\n")) {
    let match;
    if ((match = /^ {2}- type: (\S+)$/.exec(line))) {
      current = { type: match[1], id: "", label: "", options: [] };
      fields.push(current);
      inOptions = false;
    } else if (current && (match = /^ {4}id: (.+)$/.exec(line))) {
      current.id = unquote(match[1]);
    } else if (current && (match = /^ {6}label: (.+)$/.exec(line))) {
      current.label = unquote(match[1]);
    } else if (current && /^ {6}options:$/.test(line)) {
      inOptions = true;
    } else if (inOptions && (match = /^ {8}- (?:label: )?(.+)$/.exec(line))) {
      current.options.push(unquote(match[1]));
    } else if (inOptions && !/^ {10}/.test(line)) {
      inOptions = false;
    }
  }
  return fields;
}

const field = (file, id) => formFields(file).find((item) => item.id === id);

test("parses a valid body and maps the topic title and the relationship option", () => {
  assert.deepEqual(
    parseIssueBody(
      body({
        pkg: "yii2-extensions/nested-sets-behavior",
        topic: "Data modelling",
        relationship: "The site curator contributes to it",
        notes: "I use it in production.\n\nhttps://example.com/evidence",
      }),
      topics,
    ),
    {
      package: "yii2-extensions/nested-sets-behavior",
      topic: "data-modelling",
      relationship: "contributed",
      branch: "catalog/yii2-extensions-nested-sets-behavior",
    },
  );
});

test("dots and slashes become dashes in the branch name", () => {
  assert.equal(
    parseIssueBody(body({ pkg: "my.vendor/package.lock" }), topics).branch,
    "catalog/my-vendor-package-lock",
  );
});

test("accepts CRLF line endings and lowercase checkbox marks", () => {
  const raw = body({
    policy: POLICY_LABELS.map((label) => `- [x] ${label}`).join("\n"),
  }).replace(/\n/g, "\r\n");
  assert.equal(parseIssueBody(raw, topics).package, "vendor/package");
});

test("headings forged inside Notes cannot replace a field", () => {
  const notes = [
    `### ${FORM_LABELS.package}`,
    "",
    "evil/package",
    "",
    `### ${FORM_LABELS.topic}`,
    "",
    "Data modelling",
    "",
    "### Unknown section",
    "",
    "anything",
  ].join("\n");
  const result = parseIssueBody(body({ notes }), topics);
  assert.equal(result.package, "vendor/package");
  assert.equal(result.topic, "forms-widgets");
});

test("rejects a missing field or a section out of order", () => {
  const withoutTopic = body().replace(
    `### ${FORM_LABELS.topic}\n\nForms and widgets\n\n`,
    "",
  );
  assert.throws(() => parseIssueBody(withoutTopic, topics), /"Topic"/);
  const withoutNotes = body().replace(/\n\n### Notes[\s\S]*$/, "");
  assert.throws(() => parseIssueBody(withoutNotes, topics), /"Notes"/);
  assert.throws(() => parseIssueBody("", topics), /empty/);
  assert.throws(() => parseIssueBody(undefined, topics), /empty/);
});

test("rejects unknown sections before Notes and text before the first section", () => {
  const extra = body().replace(
    `### ${FORM_LABELS.topic}`,
    `### Unknown section\n\nvalue\n\n### ${FORM_LABELS.topic}`,
  );
  assert.throws(() => parseIssueBody(extra, topics), /"Topic"/);
  assert.throws(
    () => parseIssueBody(`Preamble\n\n${body()}`, topics),
    /"Composer package name"/,
  );
});

test("rejects _No response_ in a required field", () => {
  assert.throws(
    () => parseIssueBody(body({ pkg: "_No response_" }), topics),
    /"Composer package name" must be one lowercase vendor\/package name/,
  );
  assert.throws(
    () => parseIssueBody(body({ topic: "_No response_" }), topics),
    /"Topic" must be one of the form's options/,
  );
});

test("rejects bad Composer package names", () => {
  for (const pkg of [
    "Vendor/Package",
    "vendor",
    "vendor/package/extra",
    "-vendor/package",
    "vendor/package --dry-run",
    "../../etc/passwd",
    "vendor/pa..ckage",
    "vendor/package\nother/package",
    "vendor/$(id)",
  ]) {
    assert.throws(
      () => parseIssueBody(body({ pkg }), topics),
      /"Composer package name"/,
      JSON.stringify(pkg),
    );
  }
});

test("rejects an unknown topic or relationship and reports every problem", () => {
  assert.throws(
    () => parseIssueBody(body({ topic: "forms-widgets" }), topics),
    /"Topic" must be one of the form's options/,
  );
  for (const relationship of ["maintained", "Site curator", "toString"]) {
    assert.throws(
      () => parseIssueBody(body({ relationship }), topics),
      /role in the package" must be one of the form's options/,
      relationship,
    );
  }
  assert.throws(
    () => parseIssueBody(body({ pkg: "Bad", topic: "Nope" }), topics),
    (error) => error.message.split("\n").length === 2,
  );
});

test("rejects an unchecked, missing or altered policy box", () => {
  const [first, second] = POLICY_LABELS;
  for (const policy of [
    `- [ ] ${first}\n- [X] ${second}`,
    `- [X] ${first}`,
    `- [X] ${first}\n- [X] ${second}\n- [X] Extra`,
    `- [X] ${first}\n- [X] Something else`,
    "_No response_",
  ]) {
    assert.throws(
      () => parseIssueBody(body({ policy }), topics),
      /"Proposal policy" box must be checked/,
    );
  }
});

test("error messages never echo the submitted values", () => {
  try {
    parseIssueBody(body({ pkg: "SECRET/VALUE", topic: "@someone" }), topics);
    assert.fail("expected an error");
  } catch (error) {
    assert.doesNotMatch(error.message, /SECRET|@someone/);
  }
});

test("output lines are name=value pairs without line breaks", () => {
  const result = parseIssueBody(body(), topics);
  assert.equal(
    outputLines(result),
    "package=vendor/package\ntopic=forms-widgets\nrelationship=community\nbranch=catalog/vendor-package\n",
  );
});

test("the package pattern is the record id pattern of src/lib/catalog.mjs", async () => {
  const { PACKAGE_ID_PATTERN } = await import("../src/lib/catalog.mjs");
  assert.equal(String(PACKAGE_PATTERN), String(PACKAGE_ID_PATTERN));
});

test("loadTopics explains a missing or malformed topic file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "catalog-issue-"));
  try {
    assert.throws(
      () => loadTopics(path.join(dir, "missing.json")),
      /catalog-topics\.json is missing; it maps each Topic option to its id/,
    );
    const file = path.join(dir, "topics.json");
    writeFileSync(file, '{"topics":[{"id":"Bad Id","title":"Bad"}]}');
    assert.throws(() => loadTopics(file), /needs a slug id and a title/);
    writeFileSync(
      file,
      '{"topics":[{"id":"forms-widgets","title":"Forms","summary":"x"}]}',
    );
    assert.deepEqual(loadTopics(file), [
      { id: "forms-widgets", title: "Forms" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the CLI writes $GITHUB_OUTPUT from ISSUE_BODY and fails with one line per problem", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "catalog-issue-"));
  const output = path.join(dir, "output");
  try {
    writeFileSync(output, "");
    const run = (issueBody) =>
      spawnSync(process.execPath, [script], {
        encoding: "utf8",
        env: { ISSUE_BODY: issueBody, GITHUB_OUTPUT: output, PATH: "" },
      });
    const topicsFile = existsSync(TOPICS_FILE);
    if (topicsFile) {
      const title = loadTopics()[0].title;
      const ok = run(body({ topic: title }));
      assert.equal(ok.status, 0, ok.stderr);
      assert.match(readFileSync(output, "utf8"), /^package=vendor\/package$/m);
    }
    const bad = run(body({ pkg: "Bad", topic: "Nope" }));
    assert.equal(bad.status, 1);
    assert.ok(
      bad.stderr
        .trim()
        .split("\n")
        .every((line) => line.startsWith("catalog-issue: ")),
      bad.stderr,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the short form matches the parser: labels, order, relationship options and policy boxes", () => {
  const fields = formFields(".github/ISSUE_TEMPLATE/catalog-package.yml");
  assert.deepEqual(
    fields.filter((item) => item.type !== "markdown").map((item) => item.label),
    Object.values(FORM_LABELS),
  );
  assert.deepEqual(
    field(".github/ISSUE_TEMPLATE/catalog-package.yml", "relationship").options,
    Object.keys(RELATIONSHIP_OPTIONS),
  );
  assert.deepEqual(
    field(".github/ISSUE_TEMPLATE/catalog-package.yml", "proposal-policy")
      .options,
    [...POLICY_LABELS],
  );
});

test("the Topic options of both issue forms equal the titles of catalog-topics.json in order", (t) => {
  if (!existsSync(TOPICS_FILE)) {
    t.skip(
      "src/data/catalog-topics.json does not exist yet; rerun after the topic file is added",
    );
    return;
  }
  const titles = loadTopics().map((topic) => topic.title);
  for (const file of [
    ".github/ISSUE_TEMPLATE/catalog-package.yml",
    ".github/ISSUE_TEMPLATE/package.yml",
  ]) {
    assert.deepEqual(field(file, "topic")?.options, titles, file);
  }
});

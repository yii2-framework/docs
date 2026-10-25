import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkCatalog, dropdownOptions, run } from "./catalog-check.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const temporary = [];

after(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

/** A temporary repository root with copies of the files the check reads. */
function rootCopy() {
  const root = mkdtempSync(path.join(tmpdir(), "catalog-check-test-"));
  temporary.push(root);
  mkdirSync(path.join(root, "src/data"), { recursive: true });
  mkdirSync(path.join(root, ".github"), { recursive: true });
  cpSync(
    path.join(ROOT, "src/data/catalog"),
    path.join(root, "src/data/catalog"),
    {
      recursive: true,
    },
  );
  cpSync(
    path.join(ROOT, "src/data/catalog-topics.json"),
    path.join(root, "src/data/catalog-topics.json"),
  );
  cpSync(
    path.join(ROOT, ".github/ISSUE_TEMPLATE"),
    path.join(root, ".github/ISSUE_TEMPLATE"),
    { recursive: true },
  );
  return root;
}

const recordPath = (root, name) => path.join(root, "src/data/catalog", name);
const editRecord = (root, name, change) => {
  const file = recordPath(root, name);
  const record = JSON.parse(readFileSync(file, "utf8"));
  change(record);
  writeFileSync(file, `${JSON.stringify(record, null, 4)}\n`);
};

test("the repository catalog, topics and issue forms pass", async () => {
  const result = await checkCatalog();
  assert.deepEqual(result.problems, []);
  assert.ok(result.records > 0);
  assert.equal(result.topics, 10);
});

test("reports every broken record on its own line, not only the first", async () => {
  const root = rootCopy();
  editRecord(root, "php-forge--vite.json", (record) => {
    record.tags = ["php", "vite"];
  });
  editRecord(root, "ui-awesome--html.json", (record) => {
    record.topic = "missing-topic";
  });
  writeFileSync(recordPath(root, "yiisoft--bootstrap5.json"), "{ not json");
  const { problems } = await checkCatalog({ root });
  assert.deepEqual(problems.length, 3, problems.join("\n"));
  assert.match(
    problems[0],
    /^src\/data\/catalog\/php-forge--vite\.json: .*tag php is on the stop list/,
  );
  assert.match(
    problems[1],
    /^src\/data\/catalog\/ui-awesome--html\.json: .*unknown topic/,
  );
  assert.match(
    problems[2],
    /^src\/data\/catalog\/yiisoft--bootstrap5\.json: invalid JSON/,
  );
});

test("checks file names against the record id and duplicate ids across files", async () => {
  const root = rootCopy();
  cpSync(
    recordPath(root, "php-forge--vite.json"),
    recordPath(root, "php-forge--vite-copy.json"),
  );
  const { problems } = await checkCatalog({ root });
  assert.deepEqual(problems, [
    "src/data/catalog/php-forge--vite-copy.json: the file of php-forge/vite must be named php-forge--vite.json",
    "src/data/catalog: php-forge/vite is defined by php-forge--vite-copy.json and php-forge--vite.json",
  ]);
});

test("the Topic dropdown of the issue forms must list the topic titles in order", async () => {
  const root = rootCopy();
  const form = path.join(root, ".github/ISSUE_TEMPLATE/catalog-package.yml");
  const source = readFileSync(form, "utf8");
  writeFileSync(
    form,
    source.replace(
      "        - Forms and widgets\n        - Routing, languages and frontend\n",
      "        - Routing, languages and frontend\n        - Forms and widgets\n",
    ),
  );
  let result = await checkCatalog({ root });
  assert.equal(result.problems.length, 1);
  assert.match(
    result.problems[0],
    /^\.github\/ISSUE_TEMPLATE\/catalog-package\.yml: the Topic options must be the topic titles in order: Forms and widgets \| Routing/,
  );
  renameSync(form, `${form}.bak`);
  result = await checkCatalog({ root });
  assert.deepEqual(result.problems, [
    ".github/ISSUE_TEMPLATE/catalog-package.yml: missing",
  ]);
});

test("a broken topic file is reported without validating records against it", async () => {
  const root = rootCopy();
  writeFileSync(
    path.join(root, "src/data/catalog-topics.json"),
    '{ "topics": [] }\n',
  );
  const { problems } = await checkCatalog({ root });
  assert.deepEqual(problems, [
    "src/data/catalog-topics.json: Catalog topics: must be a non-empty array",
  ]);
});

test("dropdownOptions reads the options of one dropdown field", () => {
  const form = [
    "body:",
    "  - type: input",
    "    id: name",
    "    attributes:",
    "      label: Name",
    "  - type: dropdown",
    "    id: topic",
    "    attributes:",
    "      label: Topic",
    "      options:",
    "        - Forms and widgets",
    '        - "Quoted, title"',
    "    validations:",
    "      required: true",
    "  - type: dropdown",
    "    id: other",
    "    attributes:",
    "      options:",
    "        - Other",
  ].join("\n");
  assert.deepEqual(dropdownOptions(form, "topic"), [
    "Forms and widgets",
    "Quoted, title",
  ]);
  assert.deepEqual(dropdownOptions(form, "other"), ["Other"]);
  assert.equal(
    dropdownOptions(form, "name"),
    null,
    "an input is not a dropdown",
  );
  assert.equal(dropdownOptions(form, "missing"), null);
});

test("run prints one line per problem and exits with status 1", async () => {
  const root = rootCopy();
  editRecord(root, "php-forge--vite.json", (record) => {
    record.tags = ["Vite"];
  });
  let out = "";
  let err = "";
  const status = await run({
    root,
    stdout: { write: (text) => (out += text) },
    stderr: { write: (text) => (err += text) },
  });
  assert.equal(status, 1);
  assert.equal(out, "");
  assert.equal(err.trim().split("\n").length, 1);
  assert.match(
    err,
    /^\[catalog-check\] src\/data\/catalog\/php-forge--vite\.json: /,
  );
  out = "";
  assert.equal(
    await run({
      stdout: { write: (text) => (out += text) },
      stderr: { write: () => {} },
    }),
    0,
  );
  assert.match(out, /records and 10 topics are valid/);
});

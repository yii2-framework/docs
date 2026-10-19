import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const work = mkdtempSync(path.join(tmpdir(), "sync-common-skills-"));
after(() => rmSync(work, { recursive: true, force: true }));
const scriptRoot = fileURLToPath(new URL("./", import.meta.url));
const skill = "yii2-example";
const body =
  "---\nname: yii2-example\ndescription: Test a common workflow.\n---\n\n# Example\n\nUse the pinned workflow and [resource](references/example.md).\n";
const resource = "# Example resource\n\nKeep the complete portable resource.\n";
const write = (root, relative, content) => {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
};
const json = (root, relative, value) =>
  write(root, relative, JSON.stringify(value));
const origin = path.join(work, "origin");
write(origin, `skills/${skill}/SKILL.md`, body);
write(origin, `skills/${skill}/references/example.md`, resource);
write(origin, "README.md", "# Common package\n");
const git = (...args) =>
  execFileSync("git", args, { cwd: origin, encoding: "utf8" }).trim();
git("init", "--quiet");
git("add", ".");
git(
  "-c",
  "user.name=Fixture",
  "-c",
  "user.email=fixture@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "core.hooksPath=/dev/null",
  "commit",
  "--quiet",
  "-m",
  "test: create common skill fixture",
);
const ref = git("rev-parse", "HEAD");
// Cloning must use the committed revision, not this changed source working tree.
write(origin, `skills/${skill}/SKILL.md`, "Uncommitted owner changes.\n");
const manifest = {
  name: "common",
  repo: pathToFileURL(origin).href,
  ref,
  skillsDir: "skills",
};

function fixture(id) {
  const root = path.join(work, id, "yii2-framework/docs");
  mkdirSync(root, { recursive: true });
  cpSync(scriptRoot, path.join(root, "scripts"), { recursive: true });
  json(root, "framework-skills.json", manifest);
  json(root, "skills/navigation.json", [
    { name: skill, label: "Example", after: "guide/example" },
  ]);
  json(root, "packages.json", [
    {
      type: "tool",
      name: "local-tool",
      title: "Local tool",
      repo: manifest.repo,
      ref,
      localPath: "./local-tool",
      docsDir: "docs",
    },
  ]);
  write(
    root,
    "local-tool/README.md",
    "# Local tool\n\nUse the local tool source.\n",
  );
  // An adjacent checkout at the old manifest path must not override the pin.
  write(root, "../../yii2-extensions/skill/README.md", "# Adjacent checkout\n");
  write(
    root,
    `../../yii2-extensions/skill/skills/${skill}/SKILL.md`,
    "Adjacent workflow.\n",
  );
  return root;
}
const run = (root, args = []) =>
  spawnSync(
    process.execPath,
    ["scripts/sync.mjs", "--local", "--strict", ...args],
    { cwd: root, encoding: "utf8", env: { ...process.env, SYNC_LOCAL: "1" } },
  );

test("local sync clones the pinned common package without localPath or legacy bundles", () => {
  const root = fixture("remote-common");
  assert.deepEqual(readdirSync(path.join(root, "skills")), ["navigation.json"]);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const sources = JSON.parse(
    readFileSync(path.join(root, ".cache/sources.json"), "utf8"),
  );
  assert.equal(sources.commonSkills.commit, ref);
  assert.ok(sources.commonSkills.source.startsWith(`${manifest.repo}@${ref}`));
  assert.equal(
    sources.commonSkills.dir,
    path.join(root, ".cache/packages/common"),
  );
  assert.match(
    sources.packages["local-tool"].source,
    /local-tool \(working tree\)/,
  );
  for (const target of [".cache/skills", "public/skills"]) {
    const index = JSON.parse(
      readFileSync(path.join(root, target, "index.json"), "utf8"),
    );
    const entry = index.skills[skill];
    assert.deepEqual(Object.keys(index.skills), [skill]);
    assert.equal(entry.package, "yii2-extensions/skill");
    assert.equal(entry.commit, ref);
    for (const [file, expected] of [
      ["SKILL.md", body],
      ["references/example.md", resource],
    ]) {
      assert.equal(
        readFileSync(path.join(root, target, skill, file), "utf8"),
        expected,
      );
      assert.equal(
        entry.files[file],
        createHash("sha256").update(expected).digest("hex"),
      );
    }
  }
  const page = readFileSync(
    path.join(root, `src/content/docs/guide/skills/${skill}.md`),
    "utf8",
  );
  assert.match(page, /Use the pinned workflow/);
  assert.match(page, /\/docs\/skills\/yii2-example\/references\/example.md/);
  assert.ok(
    page.includes(`${manifest.repo}/edit/${ref}/skills/${skill}/SKILL.md`),
  );
  assert.doesNotMatch(page, /Adjacent workflow|Uncommitted owner changes/);
  assert.equal(existsSync(path.join(root, "skills", skill)), false);
});

test("a missing common manifest fails even when a legacy bundle exists", () => {
  const root = fixture("missing-manifest");
  rmSync(path.join(root, "framework-skills.json"));
  write(root, `skills/${skill}/SKILL.md`, body);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /framework-skills\.json/);
  assert.equal(existsSync(path.join(root, "public/skills")), false);
});

test("a supplied invalid localPath is rejected before synchronization", () => {
  const root = fixture("invalid-local-path");
  for (const localPath of ["", " ", null, 5]) {
    json(root, "framework-skills.json", { ...manifest, localPath });
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /localPath must be a non-empty string/);
    assert.equal(existsSync(path.join(root, "public/skills")), false);
  }
});

test("explicit custom manifests remain isolated from the common package", () => {
  const root = fixture("custom-manifest");
  rmSync(path.join(root, "framework-skills.json"));
  const result = run(root, ["--manifest=packages.json"]);
  assert.equal(result.status, 0, result.stderr);
  const sources = JSON.parse(
    readFileSync(path.join(root, ".cache/sources.json"), "utf8"),
  );
  assert.equal(sources.commonSkills, null);
  assert.ok(
    existsSync(
      path.join(root, "src/content/docs/development-tools/local-tool/index.md"),
    ),
  );
});

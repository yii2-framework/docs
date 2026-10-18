import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { syncFrameworkSkillPages } from "./sync.mjs";

const work = mkdtempSync(path.join(tmpdir(), "framework-skill-pages-"));
after(() => rmSync(work, { recursive: true, force: true }));
const entry = {
  name: "yii2-example",
  label: "Example workflow",
  after: "guide/example",
};

function fixture(id, navigation = [entry]) {
  const root = path.join(work, id);
  const folder = path.join(root, "skills", entry.name);
  mkdirSync(path.join(folder, "references"), { recursive: true });
  writeFileSync(
    path.join(root, "skills/navigation.json"),
    JSON.stringify(navigation),
  );
  const source =
    "---\nname: yii2-example\ndescription: An example skill.\n---\n\n# Example\n\nKeep this workflow unchanged.\n\nRead [conventions](references/conventions.md#scope).\n\n```md\n[Example only](not-a-resource.md)\n```\n";
  writeFileSync(path.join(folder, "SKILL.md"), source);
  writeFileSync(path.join(folder, "references/conventions.md"), "# Scope\n");
  return {
    root,
    folder,
    source,
    output: path.join(root, "src/content/docs/guide/skills"),
  };
}

test("renders the canonical body with working resource and installation links without changing the bundle", () => {
  const { root, folder, source, output } = fixture("render");
  assert.deepEqual(syncFrameworkSkillPages(root, [entry.name]), [entry.name]);
  const page = readFileSync(path.join(output, `${entry.name}.md`), "utf8");
  assert.match(page, /title: "Skill: Example workflow"/);
  assert.match(page, /Keep this workflow unchanged\./);
  assert.match(
    page,
    /\[conventions\]\(\/docs\/skills\/yii2-example\/references\/conventions.md#scope\)/,
  );
  assert.match(page, /\[Example only\]\(not-a-resource.md\)/);
  assert.match(
    page,
    /\.\.\/\.\.\/project\/ai-agents.md#install-the-relevant-skill/,
  );
  assert.match(page, /\.\.\/\.\.\/guide\/example.md/);
  assert.equal(readFileSync(path.join(folder, "SKILL.md"), "utf8"), source);
  writeFileSync(path.join(output, "removed-skill.md"), "stale page");
  syncFrameworkSkillPages(root, [entry.name]);
  assert.equal(existsSync(path.join(output, "removed-skill.md")), false);
  assert.equal(
    readFileSync(path.join(output, `${entry.name}.md`), "utf8"),
    page,
  );
});

test("requires one menu entry for every distributed framework skill", () => {
  for (const [id, navigation] of [
    ["missing", []],
    ["duplicate", [entry, entry]],
  ]) {
    const { root } = fixture(id, navigation);
    assert.throws(
      () => syncFrameworkSkillPages(root, [entry.name]),
      /exactly one navigation entry/,
    );
  }
});

test("rejects broken portable links instead of emitting a page with a missing resource", () => {
  const { root, folder } = fixture("missing-resource");
  rmSync(path.join(folder, "references/conventions.md"));
  assert.throws(
    () => syncFrameworkSkillPages(root, [entry.name]),
    /missing portable skill resource/,
  );
});

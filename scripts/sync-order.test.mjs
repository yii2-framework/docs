import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("sync preserves canonical order for mixed-case source names and the renamed index", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sync-order-"));
  try {
    cpSync(
      fileURLToPath(new URL("./", import.meta.url)),
      path.join(root, "scripts"),
      {
        recursive: true,
      },
    );
    const source = path.join(root, "extension");
    mkdirSync(path.join(source, "docs"), { recursive: true });
    writeFileSync(
      path.join(source, "composer.json"),
      '{"name":"example/demo"}\n',
    );
    writeFileSync(
      path.join(source, "README.md"),
      "# Demo\n\nAn example extension.\n",
    );
    for (const name of [
      "Index.MD",
      "Testing.md",
      "Installation.MD",
      "Extra.MD",
    ]) {
      writeFileSync(path.join(source, "docs", name), `# ${name}\n\nGuide.\n`);
    }
    writeFileSync(
      path.join(root, "packages.json"),
      JSON.stringify([
        {
          name: "demo",
          title: "Demo",
          repo: "https://github.com/example/demo",
          ref: "main",
          docsDir: "docs",
          srcDir: "src",
          namespace: "example",
          localPath: "./extension",
          packagist: "example/demo",
          order: ["index", "testing", "installation"],
        },
      ]),
    );
    const result = spawnSync(
      process.execPath,
      ["scripts/sync.mjs", "--local", "--strict", "--manifest=packages.json"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /does not exist/);
    for (const [name, order] of [
      ["index", 0],
      ["getting-started", 1],
      ["testing", 2],
      ["installation", 3],
      ["extra", 100],
    ]) {
      const page = readFileSync(
        path.join(root, `src/content/docs/extensions/demo/${name}.md`),
        "utf8",
      );
      assert.match(page, new RegExp(`order: ${order}\\n`), name);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
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

test("remote sync preserves HTTPS for lazy fetches during checkout and sparse checkout", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sync-remote-"));
  try {
    cpSync(
      fileURLToPath(new URL("./", import.meta.url)),
      path.join(root, "scripts"),
      {
        recursive: true,
      },
    );
    const bin = path.join(root, "bin");
    mkdirSync(bin);
    const git = path.join(bin, "git");
    const log = path.join(root, "git.jsonl");
    writeFileSync(
      git,
      `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");
if (args.includes("clone")) {
  const dir = path.join(args.at(-1), "framework");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "composer.json"), '{"name":"example/framework"}');
}
if (args.includes("rev-parse")) process.stdout.write("a".repeat(40) + "\\n");
`,
    );
    chmodSync(git, 0o755);
    writeFileSync(
      path.join(root, "packages.json"),
      JSON.stringify([
        {
          name: "framework",
          title: "Framework",
          type: "framework",
          repo: "https://github.com/example/framework",
          ref: "a".repeat(40),
          srcDir: "framework",
          namespace: "example",
          localPath: "./absent",
          packagist: "example/framework",
        },
      ]),
    );
    const result = spawnSync(
      process.execPath,
      ["scripts/sync.mjs", "--strict", "--manifest=packages.json"],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
    for (const command of ["clone", "fetch", "checkout", "sparse-checkout"]) {
      const call = calls.find((args) => args.includes(command));
      assert.ok(call, command);
      assert.deepEqual(
        call.slice(0, 2),
        [
          "-c",
          "url.https://github.com/example/framework/.insteadOf=https://github.com/example/framework/",
        ],
        command,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

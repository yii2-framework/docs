import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
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
import { fileURLToPath } from "node:url";
import { packageSection, validateManifest } from "./sync.mjs";

const root = mkdtempSync(path.join(tmpdir(), "sync-tools-"));
after(() => rmSync(root, { recursive: true, force: true }));
const scriptRoot = fileURLToPath(new URL("../", import.meta.url));
cpSync(path.join(scriptRoot, "scripts"), path.join(root, "scripts"), {
  recursive: true,
});
const write = (relative, contents) => {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
};
const extension = {
  name: "demo",
  title: "Demo",
  repo: "https://github.com/example/demo",
  ref: "main",
  docsDir: "docs",
  srcDir: "src",
  namespace: "example",
  localPath: "./extension",
  packagist: "example/demo",
};
const tool = {
  name: "docker",
  title: "Docker",
  type: "tool",
  repo: "https://github.com/example/docker-images",
  ref: "main",
  localPath: "./docker",
  docsDir: "docs",
  skillsDir: "skills",
  order: ["testing"],
};
write("extension/README.md", "# Demo\n\nAn example PHP extension.\n");
write("extension/composer.json", JSON.stringify({ name: extension.packagist }));
write(
  "docker/README.md",
  "# Docker\n\nA container environment. See [testing](docs/testing.md).\n",
);
write(
  "docker/docs/testing.md",
  "# Testing\n\nRead the [overview](../README.md) and run the [helper](../skills/docker-check/scripts/check.sh).\n",
);
const skill =
  "---\nname: docker-check\ndescription: Check a Docker fixture.\n---\n\nRun the bundled script.\n";
const helper = "#!/usr/bin/env bash\nexit 0\n";
write("docker/skills/docker-check/SKILL.md", skill);
write("docker/skills/docker-check/scripts/check.sh", helper);
write("packages.json", JSON.stringify([extension]));
write("tools.json", JSON.stringify([tool]));
const run = (args = []) =>
  spawnSync(
    process.execPath,
    ["scripts/sync.mjs", "--local", "--strict", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

test("a tool needs no Composer contract; package guards remain enforced", () => {
  assert.deepEqual(validateManifest([tool], "tools.json"), [tool]);
  const { docsDir, ...invalid } = tool;
  assert.equal(docsDir, "docs");
  assert.throws(() => validateManifest([invalid], "tools.json"), /docsDir/);
  assert.throws(
    () => validateManifest([{ ...tool, type: "package" }], "packages.json"),
    /srcDir/,
  );
  assert.ok(
    !packageSection(tool, tool.repo, tool.ref, true)
      .join("\n")
      .includes("packagist.org"),
  );
});

test("imports non-Composer guides separately and distributes complete byte-identical skills", () => {
  const result = run([
    "--manifest=packages.json",
    "--tools-manifest=tools.json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const page = readFileSync(
    path.join(root, "src/content/docs/development-tools/docker/index.md"),
    "utf8",
  );
  assert.match(page, /\[testing\]\(testing.md\)/);
  assert.doesNotMatch(page, /packagist.org|Composer package/);
  assert.ok(
    existsSync(path.join(root, "src/content/docs/extensions/demo/index.md")),
  );
  assert.ok(!existsSync(path.join(root, "src/content/docs/extensions/docker")));
  assert.ok(
    !existsSync(
      path.join(root, "src/content/docs/development-tools/docker/reference"),
    ),
  );
  const testing = readFileSync(
    path.join(root, "src/content/docs/development-tools/docker/testing.md"),
    "utf8",
  );
  assert.match(testing, /\[overview\]\(index.md\)/);
  assert.match(
    testing,
    /github.com\/example\/docker-images\/blob\/main\/skills\/docker-check\/scripts\/check.sh/,
  );
  for (const target of [".cache/skills", "public/skills"]) {
    assert.equal(
      readFileSync(path.join(root, target, "docker-check/SKILL.md"), "utf8"),
      skill,
    );
    assert.equal(
      readFileSync(
        path.join(root, target, "docker-check/scripts/check.sh"),
        "utf8",
      ),
      helper,
    );
    const entry = JSON.parse(
      readFileSync(path.join(root, target, "index.json"), "utf8"),
    ).skills["docker-check"];
    assert.equal(entry.package, "docker");
    assert.equal(entry.repo, tool.repo);
    assert.equal(
      entry.files["scripts/check.sh"],
      createHash("sha256").update(helper).digest("hex"),
    );
  }
  write(
    "src/content/docs/development-tools/docker/stale.md",
    "Removed upstream.\n",
  );
  assert.equal(
    run(["--manifest=packages.json", "--tools-manifest=tools.json"]).status,
    0,
  );
  assert.ok(
    !existsSync(
      path.join(root, "src/content/docs/development-tools/docker/stale.md"),
    ),
  );
});

test("custom manifests isolate callers from default tools unless explicitly requested", () => {
  const isolated = run(["--manifest=packages.json"]);
  assert.equal(isolated.status, 0, isolated.stderr);
  assert.ok(
    !existsSync(
      path.join(root, "src/content/docs/development-tools/docker/index.md"),
    ),
  );
  const included = run([
    "--manifest=packages.json",
    "--tools-manifest=tools.json",
  ]);
  assert.equal(included.status, 0, included.stderr);
  assert.ok(
    existsSync(
      path.join(root, "src/content/docs/development-tools/docker/index.md"),
    ),
  );
});

test("rejects extension entries in the tools manifest", () => {
  write("wrong-tools.json", JSON.stringify([extension]));
  const result = run(["--tools-manifest=wrong-tools.json"]);
  assert.notEqual(result.status, 0);
  assert.ok(!result.stdout.includes("[sync] demo:"));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  NAVIGATION,
  SITE_LOCALES,
  currentNavigation,
} from "../src/lib/navigation.mjs";

test("documentation areas, including translations, mark Documentation as current", () => {
  for (const path of [
    "/docs/documentation/",
    "/docs/guide/start-installation/",
    "/docs/api/yii/base/widget/",
    "/docs/extensions/filepond/",
    "/docs/development-tools/docker/testing/",
    "/docs/cookbook/",
    "/docs/project/ai-agents/",
    "/docs/internals/",
    "/docs/ecosystems/yii3/",
    "/docs/ja/guide/start-hello/",
    "/docs/pt-br/guide/",
  ]) {
    assert.equal(currentNavigation(path, "/docs/"), "documentation/", path);
  }
});

test("packages, projects and contribute pages mark their own item", () => {
  assert.equal(
    currentNavigation("/docs/packages/yii2-extensions/filepond/", "/docs/"),
    "packages/",
  );
  assert.equal(currentNavigation("/docs/packages/", "/docs"), "packages/");
  assert.equal(currentNavigation("/docs/projects/", "/docs/"), "projects/");
  assert.equal(currentNavigation("/docs/contribute/", "/docs/"), "contribute/");
  assert.equal(currentNavigation("/docs/contribute", "/docs/"), "contribute/");
});

test("other pages mark no item", () => {
  for (const path of [
    "/docs/",
    "/docs/about/",
    "/docs/ja/",
    "/docs/guidelines/",
    "/elsewhere/guide/",
  ]) {
    assert.equal(currentNavigation(path, "/docs/"), null, path);
  }
  assert.deepEqual(
    NAVIGATION.map(({ label }) => label),
    ["Packages", "Documentation", "Collections", "Contribute"],
  );
});

test("the locale list matches the locales of astro.config.mjs", () => {
  const config = readFileSync(
    new URL("../astro.config.mjs", import.meta.url),
    "utf8",
  );
  const block = /const locales = \{([\s\S]*?)\n\};/.exec(config)?.[1] ?? "";
  const keys = [...block.matchAll(/^\s+"?([a-z-]+)"?:/gm)]
    .map((match) => match[1])
    .filter((key) => key !== "root");

  assert.deepEqual([...SITE_LOCALES], keys);
});

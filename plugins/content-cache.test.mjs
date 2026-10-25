import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DATA_STORE_PATHS, dropContentCache } from "./content-cache.mjs";

const project = (files) => {
  const root = mkdtempSync(path.join(tmpdir(), "content-cache-"));

  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), "x");
  }

  return root;
};

test("removes the dev and build data stores and keeps everything else", () => {
  const kept = [
    ".astro/content.d.ts",
    ".astro/settings.json",
    "node_modules/.astro/hub.sha256",
    "node_modules/.astro/assets/image.webp",
  ];
  const root = project([
    ".astro/data-store.json",
    ".astro/data-store/0.json",
    "node_modules/.astro/data-store.json",
    "node_modules/.astro/data-store/0.json",
    ...kept,
  ]);

  try {
    dropContentCache(root);

    for (const location of DATA_STORE_PATHS) {
      assert.equal(existsSync(path.join(root, location)), false, location);
    }
    for (const file of kept) {
      assert.equal(existsSync(path.join(root, file)), true, file);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("tolerates a project without any data store", () => {
  const root = project([]);

  try {
    assert.doesNotThrow(() => dropContentCache(root));
    assert.doesNotThrow(() => dropContentCache(path.join(root, "missing")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

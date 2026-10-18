import assert from "node:assert/strict";
import { test } from "node:test";
import { isFrameworkDocumentation } from "../src/site-meta.mjs";

test("only framework documentation inherits the Yii2 version", () => {
  for (const id of [
    "guide",
    "guide/start-installation",
    "api/yii/base/component",
    "internals/overview",
  ]) {
    assert.equal(isFrameworkDocumentation(id), true, id);
  }
  assert.equal(
    isFrameworkDocumentation("es/guide/start-installation", "es"),
    true,
  );
  for (const id of [
    "index",
    "packages",
    "packages/yiisoft/bootstrap5",
    "ecosystems/yii3",
    "extensions/filepond",
    "projects",
    "about",
    "contribute",
  ]) {
    assert.equal(isFrameworkDocumentation(id), false, id);
  }
});

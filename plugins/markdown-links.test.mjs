import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAssetLink } from "./markdown-links.mjs";

const source = "extensions/debug/screenshots.md";
const assets = {
  "/src/content/docs/extensions/debug/images/home.png":
    "/docs/_astro/home.hash.png",
};

test("Markdown assets resolve from the source file, including nested index.md routes", () => {
  assert.equal(
    resolveAssetLink("./images/home.png", source, assets),
    "/docs/_astro/home.hash.png",
  );
  assert.equal(
    resolveAssetLink(
      "../images/home.png#preview",
      "extensions/debug/topic/page.md",
      assets,
    ),
    "/docs/_astro/home.hash.png#preview",
  );
});

test("Markdown asset rewriting preserves remote, absolute and missing resources", () => {
  for (const href of [
    "https://example.com/home.png",
    "//example.com/home.png",
    "/docs/home.png",
    "#image",
    "missing.png",
    "../../../../internal/private.png",
  ]) {
    assert.equal(resolveAssetLink(href, source, assets), null);
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { remarkHub } from "./remark-hub.mjs";

const generated = {
  extensions:
    "### Widgets\n\nForm widgets.\n\n- **[Demo](extensions/demo/index.md)**: Demo.\n\n" +
    "  [Install](extensions/demo/installation.md) | [Package entry](/docs/packages/vendor/demo/)",
  tools: "- **[Box](development-tools/box/index.md)**: Boxes.",
};

// The Markdown pipeline of the site (Astro's unified processor), with only this plugin.
const render = async (markdown) => {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [[remarkHub, { generate: (section) => generated[section] }]],
    syntaxHighlight: false,
  });

  return processor.render(markdown, {
    fileURL: pathToFileURL("/site/src/content/docs/documentation.md"),
  });
};

test("placeholders become the generated headings, lists and links", async () => {
  const { code, metadata } = await render(
    "## Extension guides\n\n<!-- hub:extensions -->\n\n## Tools\n\n<!-- hub:tools -->\n",
  );

  assert.ok(!code.includes("hub:"));
  assert.match(
    code,
    /<h3 class="documentation-hub-topic" id="widgets">Widgets<\/h3>/,
  );
  assert.match(
    code,
    /<li>\n<p><strong><a href="extensions\/demo\/index.md">Demo<\/a><\/strong>: Demo.<\/p>\n<p><a href="extensions\/demo\/installation.md">Install<\/a> \| <a href="\/docs\/packages\/vendor\/demo\/">Package entry<\/a><\/p>\n<\/li>/,
  );
  assert.ok(code.includes('<a href="development-tools/box/index.md">Box</a>'));
  assert.deepEqual(
    metadata.headings.map(({ depth, text }) => [depth, text]),
    [
      [2, "Extension guides"],
      [3, "Widgets"],
      [2, "Tools"],
    ],
  );
});

test("other HTML blocks and pages without placeholders are unchanged", async () => {
  const markdown = "Intro\n\n<!-- note -->\n\n<div>kept</div>\n";
  const plain = await createMarkdownProcessor({ syntaxHighlight: false });
  const expected = (
    await plain.render(markdown, {
      fileURL: pathToFileURL("/site/src/content/docs/documentation.md"),
    })
  ).code;

  assert.equal((await render(markdown)).code, expected);
  assert.ok(expected.includes("<!-- note -->"));
});

test("generated lists and topic headings carry their classes; other lists do not", async () => {
  const { code } = await render(
    "- original item\n\n<!-- hub:extensions -->\n\n<!-- hub:tools -->\n",
  );

  assert.match(code, /^<ul>\n<li>original item<\/li>\n<\/ul>/);
  assert.equal((code.match(/<ul class="documentation-hub">/g) ?? []).length, 2);
  assert.match(
    code,
    /<h3 class="documentation-hub-topic" id="widgets">Widgets<\/h3>/,
  );
  assert.equal((code.match(/<ul>/g) ?? []).length, 1);
});

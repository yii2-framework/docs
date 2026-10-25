import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HUB_PLACEHOLDERS, hubMarkdown } from "../src/lib/hub.mjs";
import { dropContentCache } from "./content-cache.mjs";

// Paths from the project root (the working directory of `astro build` and `astro dev`).
const ROOT = process.cwd();
const HUB_DIGEST = path.join(ROOT, "node_modules", ".astro", "hub.sha256");

/**
 * Replaces the hub placeholders of the Documentation hub (`<!-- hub:extensions -->`, `<!-- hub:tools -->`, each an
 * HTML block of its own) with the parsed Markdown of `hubMarkdown()` (src/lib/hub.mjs). The generated `###` headings
 * become part of the page, so they appear in its table of contents; the generated lists carry the class
 * `documentation-hub` and the topic headings `documentation-hub-topic`. Other HTML blocks and pages without placeholders
 * are left unchanged. The per-page Markdown (index.md) replaces the same placeholders in
 * plugins/llm-render-markdown.mjs.
 *
 * @this {import('unified').Processor}
 * @param {{ base?: string, generate?: (section: string) => string }} [options] `base`: the Astro `base` for the
 *   site-absolute links; `generate` replaces the generator (tests).
 */
export function remarkHub(options = {}) {
  const processor = this;
  const generate =
    options.generate ??
    ((section) => hubMarkdown(section, { base: options.base ?? "/" }));
  const sections = new Map(
    Object.entries(HUB_PLACEHOLDERS).map(([section, placeholder]) => [
      placeholder,
      section,
    ]),
  );
  // Style hooks for the generated block only: its lists and its topic headings.
  const mark = (node) => {
    const className =
      node.type === "list"
        ? "documentation-hub"
        : node.type === "heading" && node.depth === 3
          ? "documentation-hub-topic"
          : null;

    if (className !== null) {
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, className: [className] },
      };
    }

    return node;
  };
  const replace = (parent) => {
    if (!Array.isArray(parent.children)) {
      return;
    }

    parent.children = parent.children.flatMap((node) => {
      const section =
        node.type === "html" ? sections.get(node.value.trim()) : undefined;

      if (section === undefined) {
        replace(node);

        return [node];
      }

      return processor.parse(generate(section)).children.map(mark);
    });
  };

  return (tree) => {
    replace(tree);
  };
}

/**
 * Drops Astro's content cache when the generated hub changed since the last start, like
 * `invalidateContentCacheOnDemoChange()`: the content layer would otherwise reuse the rendered Documentation hub
 * after `packages.json`, `tools.json`, `src/data/documentation-topics.json`, the skill index or a synced guide's
 * frontmatter changed. The digest is taken of the generated Markdown itself, which covers exactly those inputs.
 *
 * @param {{ base?: string }} [options]
 */
export function invalidateContentCacheOnHubChange(options = {}) {
  const markdown = Object.keys(HUB_PLACEHOLDERS).map((section) =>
    hubMarkdown(section, { base: options.base ?? "/" }),
  );
  const digest = createHash("sha256")
    .update(JSON.stringify(markdown))
    .digest("hex");
  const previous = existsSync(HUB_DIGEST)
    ? readFileSync(HUB_DIGEST, "utf8").trim()
    : "none";

  if (previous !== digest) {
    dropContentCache(ROOT);
    mkdirSync(path.dirname(HUB_DIGEST), { recursive: true });
    writeFileSync(HUB_DIGEST, `${digest}\n`);
  }
}

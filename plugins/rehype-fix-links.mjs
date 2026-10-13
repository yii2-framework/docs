import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { pageUrl, resolveMarkdownLink } from './markdown-links.mjs';

const CONTENT_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));

/**
 * Resolves a relative Markdown link against the source file and returns the base-absolute page URL
 * (`/docs/guide/x/#a`), or `null` when the link is not a relative Markdown link.
 *
 * @param {string} href The link as written in the source.
 * @param {string} sourceRelative POSIX path of the source file relative to the content directory.
 * @param {string} base The Astro `base`, e.g. `/docs/`.
 * @returns {string | null}
 */
export function resolveMarkdownHref(href, sourceRelative, base) {
  const target = resolveMarkdownLink(href, sourceRelative);

  return target === null ? null : `${pageUrl(target.slug, base)}${target.hash}`;
}

/**
 * Rewrites relative `.md` links to base-absolute page URLs resolved against the source file's location.
 *
 * Pages are served as directories (`guide/a.md` at `/docs/guide/a/`), so a relative `b/` emitted for `b.md` would
 * resolve under the current page. Links in raw HTML (`<a href="x.md">`) are rewritten too, because this plugin runs
 * before `rehype-raw` parses them.
 *
 * @param {{ base?: string }} [options] `base` is the Astro `base` option (default `/`).
 */
export function rehypeFixLinks(options = {}) {
  const base = `${(options.base ?? '/').replace(/\/+$/, '')}/`;

  return (tree, file) => {
    if (!file.path) {
      return;
    }

    const sourceRelative = path.relative(CONTENT_DIR, file.path).split(path.sep).join('/');

    if (sourceRelative.startsWith('../') || path.isAbsolute(sourceRelative)) {
      return;
    }

    visit(tree, (node) => {
      if (node.type === 'element' && node.tagName === 'a' && typeof node.properties?.href === 'string') {
        const resolved = resolveMarkdownHref(node.properties.href, sourceRelative, base);

        if (resolved !== null) {
          node.properties.href = resolved;
        }
      } else if (node.type === 'raw' && node.value.includes('href=')) {
        node.value = node.value.replace(/(\shref=")([^"]*)(")/g, (all, open, href, close) => {
          const resolved = resolveMarkdownHref(href, sourceRelative, base);

          return resolved === null ? all : `${open}${resolved}${close}`;
        });
      }
    });
  };
}

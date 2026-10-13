import { slug as githubSlug } from 'github-slugger';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { visit } from 'unist-util-visit';

const CONTENT_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));

/**
 * Returns the site slug of a content file path relative to `src/content/docs`, using the rules of Astro's glob
 * loader that Starlight uses: extension removed, each segment slugified with `github-slugger`, trailing `/index`
 * dropped, and the root `index` mapped to the empty slug.
 *
 * @param {string} relativePath POSIX path relative to the content directory, e.g. `ja/guide/start-hello.md`.
 * @returns {string} The slug, e.g. `ja/guide/start-hello`.
 */
export function contentPathToSlug(relativePath) {
  const withoutExt = relativePath.replace(/\.mdx?$/, '');
  const slug = withoutExt.split('/').map((segment) => githubSlug(segment)).join('/').replace(/\/index$/, '');

  return slug === 'index' ? '' : slug;
}

/**
 * Resolves a relative Markdown link (`x.md`, `./x.md#a`, `../internals/x.md`) against the source file and returns
 * the base-absolute page URL (`/docs/guide/x/#a`), or `null` when the link is not a relative Markdown link.
 *
 * @param {string} href The link as written in the source.
 * @param {string} sourceRelative POSIX path of the source file relative to the content directory.
 * @param {string} base The Astro `base` with a trailing slash, e.g. `/docs/`.
 * @returns {string | null}
 */
export function resolveMarkdownHref(href, sourceRelative, base) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('#') || href.startsWith('/')) {
    return null;
  }

  const match = /^([^?#]+\.mdx?)(#.*)?$/.exec(href);

  if (!match) {
    return null;
  }

  const target = path.posix.normalize(path.posix.join(path.posix.dirname(sourceRelative), match[1]));

  if (target.startsWith('../')) {
    return null;
  }

  const slug = contentPathToSlug(target);

  return `${base}${slug === '' ? '' : `${slug}/`}${match[2] ?? ''}`;
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

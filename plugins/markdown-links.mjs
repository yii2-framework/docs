import { slug as githubSlug } from "github-slugger";
import path from "node:path";

/**
 * Returns the site slug of a content file path relative to `src/content/docs`, using the rules of Astro's glob
 * loader that Starlight uses: extension removed, each segment slugified with `github-slugger`, trailing `/index`
 * dropped, and the root `index` mapped to the empty slug.
 *
 * @param {string} relativePath POSIX path relative to the content directory, e.g. `ja/guide/start-hello.md`.
 * @returns {string} The slug, e.g. `ja/guide/start-hello`.
 */
export function contentPathToSlug(relativePath) {
  const withoutExt = relativePath.replace(/\.mdx?$/, "");
  const slug = withoutExt
    .split("/")
    .map((segment) => githubSlug(segment))
    .join("/")
    .replace(/\/index$/, "");

  return slug === "index" ? "" : slug;
}

/**
 * Resolves a relative Markdown link (`x.md`, `./x.md#a`, `../internals/x.md`) against the source file.
 *
 * @param {string} href The link as written in the source.
 * @param {string} sourceRelative POSIX path of the source file relative to the content directory.
 * @returns {{ slug: string, hash: string } | null} The target slug and the `#fragment` (or `''`), or `null` when the
 * link is not a relative Markdown link inside the content directory.
 */
export function resolveMarkdownLink(href, sourceRelative) {
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("//") ||
    href.startsWith("#") ||
    href.startsWith("/")
  ) {
    return null;
  }

  const match = /^([^?#]+\.mdx?)(#.*)?$/.exec(href);

  if (!match) {
    return null;
  }

  const target = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceRelative), match[1]),
  );

  if (target.startsWith("../")) {
    return null;
  }

  return { slug: contentPathToSlug(target), hash: match[2] ?? "" };
}

/**
 * Returns the HTML page URL of a slug under `base`: `/docs/guide/x/`, or `/docs/` for the root page.
 *
 * @param {string} slug
 * @param {string} base The Astro `base`, with or without a trailing slash.
 */
export function pageUrl(slug, base) {
  const prefix = `${base.replace(/\/+$/, "")}/`;

  return slug === "" ? prefix : `${prefix}${slug}/`;
}

/**
 * Returns the Markdown URL of a slug under `base`: `/docs/guide/x/index.md`, or `/docs/index.md` for the root page.
 *
 * @param {string} slug
 * @param {string} base The Astro `base`, with or without a trailing slash.
 */
export function markdownUrl(slug, base) {
  return `${pageUrl(slug, base)}index.md`;
}

/** Resolves a local content asset against its source file to the URL emitted by Vite. */
export function resolveAssetLink(href, sourceRelative, assets) {
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("/") ||
    href.startsWith("#")
  ) {
    return null;
  }

  const match = /^([^?#]+)([?#].*)?$/.exec(href);
  if (!match) return null;
  const source = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceRelative), match[1]),
  );
  const url = assets[`/src/content/docs/${source}`];

  return typeof url === "string" ? `${url}${match[2] ?? ""}` : null;
}

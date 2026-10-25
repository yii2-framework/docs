// Which main navigation item is current for a page. Shared by the header (src/components/portal/Header.astro) and
// its unit test; no Astro dependency.

/** Locale directories of the site (the keys of `locales` in astro.config.mjs, without `root`). */
export const SITE_LOCALES = Object.freeze([
  "ar",
  "de",
  "es",
  "fa",
  "fr",
  "id",
  "it",
  "ja",
  "pl",
  "pt-br",
  "ru",
  "sr-latn",
  "tr",
  "uk",
  "uz",
  "vi",
  "zh-cn",
]);

/** Main navigation items (`path` is relative to the base) and the page prefixes each one covers. */
export const NAVIGATION = Object.freeze([
  { label: "Packages", path: "packages/", prefixes: ["packages/"] },
  {
    label: "Documentation",
    path: "documentation/",
    prefixes: [
      "documentation/",
      "guide/",
      "api/",
      "extensions/",
      "development-tools/",
      "cookbook/",
      "project/",
      "internals/",
      "ecosystems/",
    ],
  },
  { label: "Collections", path: "projects/", prefixes: ["projects/"] },
  { label: "Contribute", path: "contribute/", prefixes: ["contribute/"] },
]);

/**
 * Returns the `path` of the navigation item that covers a page, or `null`. Locale-prefixed pages (`/docs/ja/guide/`)
 * belong to the same item as their English page.
 *
 * @param {string} pathname URL path of the page, for example `/docs/ja/guide/start-hello/`.
 * @param {string} base The Astro `base`, for example `/docs/`.
 */
export function currentNavigation(pathname, base = "/") {
  const root = base.replace(/\/?$/, "/");

  if (!pathname.startsWith(root)) {
    return null;
  }

  let page = pathname.slice(root.length);
  const locale = SITE_LOCALES.find((key) => page.startsWith(`${key}/`));

  if (locale !== undefined) {
    page = page.slice(locale.length + 1);
  }

  const target = page.endsWith("/") ? page : `${page}/`;

  return (
    NAVIGATION.find(({ prefixes }) =>
      prefixes.some((prefix) => target.startsWith(prefix)),
    )?.path ?? null
  );
}

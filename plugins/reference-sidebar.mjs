import { REFERENCE_ID } from './reference-id.mjs';
import { referenceTypeSlugs } from './reference-routes.mjs';

/**
 * Returns the namespace index pages of a reference tree (`api` or `extensions/<package>/reference`), sorted by slug:
 * the generated pages that are not type pages. Type pages stay out of the sidebar (about 540 links on every page).
 *
 * @param {Map<string, object>} pages English pages by slug ({@link englishPages}).
 * @param {string} root Slug of the tree root.
 * @returns {string[]}
 */
export function namespaceSlugs(pages, root) {
  const types = new Set(referenceTypeSlugs());

  return [...pages.keys()].filter((slug) => (slug === root || slug.startsWith(`${root}/`)) && !types.has(slug)).sort();
}

/**
 * Returns the collapsed "API reference" sidebar group (framework namespaces), or no group when the reference has not
 * been generated (`astro dev` without `tools/bin/reference`).
 *
 * @param {Map<string, object>} pages
 */
export function apiReferenceGroup(pages) {
  const slugs = namespaceSlugs(pages, 'api');

  if (slugs.length === 0) {
    console.warn('[reference] no generated API reference in src/content/docs/api (run tools/bin/reference); the '
      + 'sidebar omits it.');
    return [];
  }

  return [{ label: 'API reference', collapsed: true, items: slugs.map((slug) => ({ slug })) }];
}

/**
 * Returns the sidebar items of one extension package: its guide pages (sorted like `autogenerate`: `sidebar.order`,
 * then slug) and, when generated, a collapsed "Reference" sub-group with its namespace pages.
 *
 * @param {Map<string, { order?: number }>} pages
 * @param {string} name Package name.
 */
export function extensionItems(pages, name) {
  const root = `extensions/${name}`;
  const rank = (slug) => pages.get(slug)?.order ?? Number.POSITIVE_INFINITY;
  const guides = [...pages.keys()]
    .filter((slug) => (slug === root || slug.startsWith(`${root}/`)) && !REFERENCE_ID.test(slug))
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const reference = namespaceSlugs(pages, `${root}/reference`);
  const items = guides.map((slug) => ({ slug }));

  if (reference.length > 0) {
    items.push({ label: 'Reference', collapsed: true, items: reference.map((slug) => ({ slug })) });
  }

  return items;
}

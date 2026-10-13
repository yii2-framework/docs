import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LINKS_FILE = fileURLToPath(new URL('../.cache/reference/links.json', import.meta.url));
const ROUTING_MODULE = /@astrojs[\\/]starlight[\\/]dist[\\/]utils[\\/]routing[\\/]index\.js$/;
const FALLBACK_LOOP = 'for (const fallback of defaultLocaleDocs) {';

/**
 * Returns the slugs of the generated type pages (one per class, interface, trait or enum), read from the link map
 * written by `tools/bin/reference`; empty when the reference has not been generated.
 *
 * @returns {string[]}
 */
export function referenceTypeSlugs() {
  if (!existsSync(LINKS_FILE)) {
    return [];
  }

  const { types } = JSON.parse(readFileSync(LINKS_FILE, 'utf8'));

  return Object.values(types).map(({ slug }) => slug);
}

/**
 * Vite plugin that keeps Starlight from generating locale fallback pages for the API reference type pages.
 *
 * Starlight renders every default-locale page once per locale when no translation exists (17 copies here). The
 * reference is English only and large (about 540 type pages): its copies would add about 1.6 GB to `dist/`, beyond
 * the 1 GB limit of GitHub Pages. Namespace index pages keep their fallbacks, so the sidebar (which uses `slug`
 * items, localized by Starlight) resolves in every locale; their links point to the English type pages.
 *
 * The plugin edits Starlight's routing module (`utils/routing/index.js`) at build time. When the code it expects is
 * not found (a Starlight upgrade), the build fails instead of silently publishing the copies.
 */
export function referenceRoutes() {
  return {
    name: 'yii-docs:reference-routes',
    enforce: 'pre',
    transform(code, id) {
      if (!ROUTING_MODULE.test(id.split('?')[0])) {
        return null;
      }

      if (!code.includes(FALLBACK_LOOP)) {
        throw new Error(`[reference-routes] "${FALLBACK_LOOP}" not found in ${id}; review the plugin for this `
          + 'Starlight version (plugins/reference-routes.mjs).');
      }

      const skip = JSON.stringify(referenceTypeSlugs());

      return {
        code: code.replace(FALLBACK_LOOP, `const __referenceTypes = new Set(${skip});\n\t\t\t${FALLBACK_LOOP}\n`
          + '\t\t\t\tif (__referenceTypes.has(fallback.id)) continue;'),
        map: null,
      };
    },
  };
}

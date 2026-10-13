import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';
import { buildDate, DOCS_VERSION, PROJECT_NAME } from './site-meta.mjs';

type SidebarEntry =
  | { type: 'link'; label: string; href: string; isCurrent: boolean }
  | { type: 'group'; label: string; entries: SidebarEntry[] };

/** Returns the chain of sidebar entries that leads to the current page, outermost first. */
function currentPath(entries: SidebarEntry[]): SidebarEntry[] | null {
  for (const entry of entries) {
    if (entry.type === 'link' && entry.isCurrent) {
      return [entry];
    }

    if (entry.type === 'group') {
      const inner = currentPath(entry.entries);

      if (inner) {
        return [entry, ...inner];
      }
    }
  }

  return null;
}

/** Returns the first link of a sidebar group, used as the URL of its breadcrumb item. */
function firstLink(entry: SidebarEntry): string | undefined {
  if (entry.type === 'link') {
    return entry.href;
  }

  for (const child of entry.entries) {
    const href = firstLink(child);

    if (href) {
      return href;
    }
  }

  return undefined;
}

let entryIds: Promise<Set<string>> | undefined;

/** Returns the ids of all `docs` entries (loaded once per build; `getEntry` would log a warning for a miss). */
function docsIds(): Promise<Set<string>> {
  entryIds ??= getCollection('docs').then((entries) => new Set(entries.map((entry) => entry.id)));

  return entryIds;
}

/** Serializes JSON for an inline `<script>`: `<` is escaped so the content cannot close the element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Adds the Open Graph image, version metadata and JSON-LD (`TechArticle` and `BreadcrumbList`) to every page head.
 */
export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  const site = context.site ?? new URL(context.url.origin);
  const homeUrl = new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), site).href;
  const pageUrl = new URL(context.url.pathname, site).href;
  const date = buildDate();
  const { title, description } = route.entry.data;
  const modified = route.lastUpdated ? route.lastUpdated.toISOString().slice(0, 10) : date;

  const trail = currentPath(route.sidebar as SidebarEntry[]) ?? [];
  const crumbs = [
    { name: PROJECT_NAME, item: homeUrl },
    ...trail.map((entry, index) => ({
      name: entry.label,
      item: index === trail.length - 1 ? pageUrl : new URL(firstLink(entry) ?? pageUrl, site).href,
    })),
  ];

  if (trail.length === 0 && pageUrl !== homeUrl) {
    crumbs.push({ name: title, item: pageUrl });
  }

  const graph = [
    {
      '@type': 'TechArticle',
      headline: title,
      ...(description ? { description } : {}),
      inLanguage: route.entryMeta.lang,
      url: pageUrl,
      version: DOCS_VERSION,
      dateModified: modified,
      isPartOf: { '@type': 'WebSite', name: PROJECT_NAME, url: homeUrl },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.item,
      })),
    },
  ];

  // Open Graph image: generated for English pages (src/pages/og); translations use the image of the English slug.
  const { id } = route.entry;
  const unprefixed = route.locale && (id === route.locale || id.startsWith(`${route.locale}/`))
    ? id.slice(route.locale.length + 1)
    : id;
  const englishId = unprefixed === '' ? 'index' : unprefixed;

  // Pages that exist only in a translation have no image.
  if (route.entry.id !== '404' && (await docsIds()).has(englishId)) {
    const image = new URL(`og/${englishId}.png`, homeUrl).href;

    route.head.push(
      { tag: 'meta', attrs: { property: 'og:image', content: image } },
      { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
      { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
      { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
    );
  }

  route.head.push(
    { tag: 'meta', attrs: { name: 'docs:version', content: DOCS_VERSION } },
    { tag: 'meta', attrs: { name: 'docs:build-date', content: date } },
    {
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      content: scriptJson({ '@context': 'https://schema.org', '@graph': graph }),
    },
  );
});

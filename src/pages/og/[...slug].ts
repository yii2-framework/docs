import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { DOCS_VERSION, PROJECT_NAME } from '../../site-meta.mjs';

// English (default locale) pages only: translated and fallback pages reuse the image of their English slug.
const LOCALE_PREFIX = /^(ar|de|es|fa|fr|id|it|ja|pl|pt-br|ru|sr-latn|tr|uk|uz|vi|zh-cn)\//;
const entries = await getCollection('docs', (entry) => !LOCALE_PREFIX.test(entry.id));

/** Serves `/og/<slug>.png` (1200x630) for every English page. */
export const { getStaticPaths, GET } = await OGImageRoute({
  pages: Object.fromEntries(entries.map(({ id, data }) => [id, data])),
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: `${PROJECT_NAME} ${DOCS_VERSION}`,
    bgGradient: [[24, 32, 48], [12, 16, 24]],
    border: { color: [64, 163, 255], width: 16, side: 'inline-start' },
    padding: 80,
    font: {
      title: { size: 64, lineHeight: 1.2, color: [255, 255, 255] },
      description: { size: 32, color: [176, 190, 210] },
    },
  }),
});

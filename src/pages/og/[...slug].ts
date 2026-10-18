/* eslint-disable n/no-missing-import -- Astro virtual modules and sibling .mjs files are resolved by Vite. */
import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";
import {
  DOCS_VERSION,
  PROJECT_NAME,
  isFrameworkDocumentation,
} from "../../site-meta.mjs";

// Noto Sans (latin, 400), the plugin's default font, vendored so builds make no request to api.fontsource.org.
// License: src/assets/fonts/OFL.txt. Local paths are resolved against the project root.
const FONTS = ["./src/assets/fonts/noto-sans-latin-400-normal.ttf"];

// English (default locale) pages only: translated and fallback pages reuse the image of their English slug.
const LOCALE_PREFIX =
  /^(ar|de|es|fa|fr|id|it|ja|pl|pt-br|ru|sr-latn|tr|uk|uz|vi|zh-cn)\//;
const entries = await getCollection(
  "docs",
  (entry) => !LOCALE_PREFIX.test(entry.id),
);

/** Serves `/og/<slug>.png` (1200x630) for every English page. */
export const { getStaticPaths, GET } = await OGImageRoute({
  pages: Object.fromEntries(entries.map(({ id, data }) => [id, data])),
  getImageOptions: (path, page) => ({
    title: page.title,
    description: isFrameworkDocumentation(path)
      ? `Yii2 Framework ${DOCS_VERSION}`
      : PROJECT_NAME,
    bgGradient: [
      [24, 32, 48],
      [12, 16, 24],
    ],
    border: { color: [64, 163, 255], width: 16, side: "inline-start" },
    padding: 80,
    fonts: FONTS,
    font: {
      title: { size: 64, lineHeight: 1.2, color: [255, 255, 255] },
      description: { size: 32, color: [176, 190, 210] },
    },
  }),
});

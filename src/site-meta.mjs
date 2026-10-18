/** Framework version documented by this site. */
export const DOCS_VERSION = "22.0";

/** Project name used in `llms.txt` and structured data. */
export const PROJECT_NAME = "PHP Ecosystem";

/** Framework metadata belongs only to the Yii2 guide, API and internals. */
export function isFrameworkDocumentation(id, locale) {
  const slug =
    locale && id.startsWith(`${locale}/`) ? id.slice(locale.length + 1) : id;
  return /^(guide|api|internals)(?:\/|$)/.test(slug);
}

/**
 * Returns the build date as an ISO date (`YYYY-MM-DD`).
 *
 * `astro.config.mjs` stores it in `process.env.DOCS_BUILD_DATE` so the config and the route middleware (evaluated
 * separately by Vite) agree. `SOURCE_DATE_EPOCH` makes builds reproducible.
 */
export function buildDate() {
  if (process.env.DOCS_BUILD_DATE) {
    return process.env.DOCS_BUILD_DATE;
  }

  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  const date =
    Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000) : new Date();

  return date.toISOString().slice(0, 10);
}

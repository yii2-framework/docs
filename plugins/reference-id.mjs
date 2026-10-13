/**
 * Matches the content ids (without locale prefix) of the generated API reference: `api/...` and
 * `extensions/<package>/reference/...`.
 */
export const REFERENCE_ID = /^(api|extensions\/[^/]+\/reference)(\/|$)/;

/**
 * Returns whether a Starlight route id belongs to the API reference, with or without a locale prefix.
 *
 * @param {string} id Route id, for example `ja/api/yii/web`.
 * @param {string | undefined} locale Route locale, or `undefined` for the root locale.
 */
export function isReferenceRoute(id, locale) {
  const unprefixed = locale && (id === locale || id.startsWith(`${locale}/`)) ? id.slice(locale.length + 1) : id;

  return REFERENCE_ID.test(unprefixed);
}

import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Locations of Astro's content-layer data store, relative to the project root. Astro 7 (`getDataStoreFile()` and
 * `getDataStoreDir()` in `node_modules/astro/dist/content/paths.js`) writes it to `settings.dotAstroDir`
 * (`<root>/.astro/`) during `astro dev` and to `config.cacheDir` (default `./node_modules/.astro`) during
 * `astro build`: one `data-store.json` file, or a `data-store/` directory when `experimental.collectionStorage`
 * splits it into chunks. This repository sets neither `cacheDir` nor `collectionStorage`.
 */
export const DATA_STORE_PATHS = Object.freeze([
  ".astro/data-store.json",
  ".astro/data-store",
  "node_modules/.astro/data-store.json",
  "node_modules/.astro/data-store",
]);

/**
 * Drops Astro's content cache (dev and build data stores), so the next `astro dev` or `astro build` renders every
 * content entry again. Missing files are ignored; nothing else is removed.
 *
 * @param {string} [root] Project root (default: the working directory of `astro dev` and `astro build`).
 */
export function dropContentCache(root = process.cwd()) {
  for (const location of DATA_STORE_PATHS) {
    rmSync(path.join(root, location), { recursive: true, force: true });
  }
}

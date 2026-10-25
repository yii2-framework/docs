// Network side of the catalog importer: Packagist metadata (p2 tags and branches, the package JSON with statistics
// and the abandoned flag) and files at a commit read from the Git host's raw URLs. Requests are serial (each call is
// awaited), carry a descriptive User-Agent, time out, and are cached for the lifetime of one client. The GitHub REST
// API is never needed; a `GITHUB_TOKEN`, when set, is sent to api.github.com only.

import { rawUrl } from "./catalog-import.mjs";

/** Sent with every request, as Packagist asks API users to identify themselves with a contact. */
export const USER_AGENT =
  "yii2-framework-docs-catalog (+https://github.com/yii2-framework/docs; mailto:terabytesoftw@gmail.com)";

/** The candidates tried, in order, when looking for a README at a commit. */
export const README_NAMES = Object.freeze(["README.md", "readme.md", "README"]);

/**
 * Creates a metadata client.
 *
 * @param {{ fetch?: typeof globalThis.fetch, token?: string, timeout?: number }} [options] `fetch` is injectable for
 *   tests; `token` defaults to `GITHUB_TOKEN`; `timeout` is per request in milliseconds.
 */
export function createClient({
  fetch = globalThis.fetch,
  token = process.env.GITHUB_TOKEN,
  timeout = 30_000,
} = {}) {
  const cache = new Map();

  /** One request; resolves `{ status, text }` and throws on network errors and timeouts. */
  async function request(url, method = "GET") {
    const key = `${method} ${url}`;
    if (cache.has(key)) return cache.get(key);
    const headers = { "User-Agent": USER_AGENT };
    if (token && new URL(url).hostname === "api.github.com")
      headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      throw new Error(
        `request to ${url} failed: ${error?.name === "TimeoutError" ? `timed out after ${timeout} ms` : error.message}`,
      );
    }
    const result = {
      status: response.status,
      text: method === "HEAD" ? "" : await response.text(),
    };
    cache.set(key, result);
    return result;
  }

  /** Parsed JSON of a URL, or `null` on 404 (Packagist's 404 body is a JSON string, so it is not parsed). */
  async function json(url) {
    const { status, text } = await request(url);
    if (status === 404) return null;
    if (status < 200 || status > 299)
      throw new Error(`HTTP ${status} from ${url}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`invalid JSON from ${url}`);
    }
  }

  /** p2 versions list of `id` (`~dev` with `dev`), or `null` when Packagist does not know the package. */
  async function p2(id, dev = false) {
    const url = `https://repo.packagist.org/p2/${id}${dev ? "~dev" : ""}.json`;
    const data = await json(url);
    if (data === null) return null;
    const list = data?.packages?.[id];
    if (!Array.isArray(list))
      throw new Error(
        `unexpected response from ${url}: no version list for ${id}`,
      );
    return list;
  }

  return {
    /** Parsed JSON of any URL, or `null` on 404. */
    json,
    /** Minified tag versions of `id`, or `null` when it is not on Packagist. */
    tags: (id) => p2(id),
    /** Minified branch versions of `id`, or `null`. */
    branches: (id) => p2(id, true),
    /** The `package` object of `packages/<id>.json` (repository, downloads, favers, abandoned), or `null`. */
    async info(id) {
      const url = `https://packagist.org/packages/${id}.json`;
      const data = await json(url);
      if (data === null) return null;
      if (data?.package === null || typeof data?.package !== "object")
        throw new Error(`unexpected response from ${url}`);
      return data.package;
    },
    /** Parsed composer.json of `repository` at `commit`, or `null` when the file does not exist. */
    composerJson: (repository, commit) =>
      json(rawUrl(repository, commit, "composer.json")),
    /** Whether `path` exists in `repository` at `commit`. */
    async exists(repository, commit, path) {
      const url = rawUrl(repository, commit, path);
      let { status } = await request(url, "HEAD");
      if (status === 405) ({ status } = await request(url));
      if (status === 404) return false;
      if (status < 200 || status > 299)
        throw new Error(`HTTP ${status} from ${url}`);
      return true;
    },
    /** The first of `README_NAMES` that exists at `commit`, or `null`. */
    async readmePath(repository, commit) {
      for (const name of README_NAMES) {
        if (await this.exists(repository, commit, name)) return name;
      }
      return null;
    },
  };
}

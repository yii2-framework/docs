// Offline `fetch` for the catalog importer tests: serves the trimmed Packagist responses and composer.json files of
// this directory by URL and records every request. A HEAD request for an unknown raw file answers 404 (the README
// probe); any other unknown URL throws, so a test never reaches the network.

import { readFileSync } from "node:fs";

const file = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

/** Commits pinned by the fixtures. */
export const COMMITS = Object.freeze({
  queue: "e0f935e5b868d53347acfb14ec19faaf16085005",
  nested: "35e49c93f2b9dac39eae25239b742b22e76d6350",
  nestedOld: "d888b20004846953e2d8b0665485694a5425644b",
  bootstrap5: "46d48f44b35e2c938b78733a7f479f2b48041c6c",
  miniframe: "7ba823203d26b0224f04999584550089a2aadea3",
});

const p2 = (id, dev = false) =>
  `https://repo.packagist.org/p2/${id}${dev ? "~dev" : ""}.json`;
const info = (id) => `https://packagist.org/packages/${id}.json`;
const github = (slug, commit, path) =>
  `https://raw.githubusercontent.com/${slug}/${commit}/${path}`;

/** URL to `{ status, body }` of the fixtures. */
export function defaultRoutes() {
  const ok = (name) => ({ status: 200, body: file(name) });
  const exists = { status: 200, body: "" };
  return {
    [p2("yiisoft/yii2-queue")]: ok("yiisoft--yii2-queue.p2.json"),
    [p2("yiisoft/yii2-queue", true)]: ok("yiisoft--yii2-queue.dev.json"),
    [info("yiisoft/yii2-queue")]: ok("yiisoft--yii2-queue.package.json"),
    [github("yiisoft/yii2-queue", COMMITS.queue, "composer.json")]: ok(
      "yiisoft--yii2-queue.composer.json",
    ),
    [github("yiisoft/yii2-queue", COMMITS.queue, "README.md")]: exists,
    [p2("yii2-extensions/nested-sets-behavior")]: ok(
      "yii2-extensions--nested-sets-behavior.p2.json",
    ),
    [p2("yii2-extensions/nested-sets-behavior", true)]: ok(
      "yii2-extensions--nested-sets-behavior.dev.json",
    ),
    [info("yii2-extensions/nested-sets-behavior")]: ok(
      "yii2-extensions--nested-sets-behavior.package.json",
    ),
    [github(
      "yii2-extensions/nested-sets-behavior",
      COMMITS.nested,
      "composer.json",
    )]: ok("yii2-extensions--nested-sets-behavior.composer.json"),
    [github(
      "yii2-extensions/nested-sets-behavior",
      COMMITS.nested,
      "README.md",
    )]: exists,
    [p2("yiisoft/bootstrap5")]: ok("yiisoft--bootstrap5.p2.json"),
    [info("yiisoft/bootstrap5")]: ok("yiisoft--bootstrap5.package.json"),
    [github("yiisoft/bootstrap5", COMMITS.bootstrap5, "composer.json")]: ok(
      "yiisoft--bootstrap5.composer.json",
    ),
    [github("yiisoft/bootstrap5", COMMITS.bootstrap5, "README.md")]: exists,
    [github(
      "yiisoft/bootstrap5",
      COMMITS.bootstrap5,
      "docs/guide/en/README.md",
    )]: exists,
    [p2("miniframe/social-login")]: ok("miniframe--social-login.p2.json"),
    [info("miniframe/social-login")]: ok(
      "miniframe--social-login.package.json",
    ),
    [`https://bitbucket.org/miniframe/social-login/raw/${COMMITS.miniframe}/composer.json`]:
      ok("miniframe--social-login.composer.json"),
    [`https://bitbucket.org/miniframe/social-login/raw/${COMMITS.miniframe}/README.md`]:
      exists,
    [p2("yiisoft/db-redis")]: ok("yiisoft--db-redis.p2.json"),
    [p2("yiisoft/db-redis", true)]: ok("yiisoft--db-redis.dev.json"),
    [info("yiisoft/db-redis")]: ok("yiisoft--db-redis.package.json"),
    [p2("swiftmailer/swiftmailer")]: ok("swiftmailer--swiftmailer.p2.json"),
    [info("swiftmailer/swiftmailer")]: ok(
      "swiftmailer--swiftmailer.package.json",
    ),
    [p2("yii2-extensions/template")]: {
      status: 404,
      body: file("yii2-extensions--template.p2.json"),
    },
    [p2("yii2-extensions/template", true)]: {
      status: 404,
      body: file("yii2-extensions--template.p2.json"),
    },
    [info("yii2-extensions/template")]: {
      status: 404,
      body: file("yii2-extensions--template.package.json"),
    },
  };
}

/** Parsed JSON of a fixture file. */
export const fixture = (name) => JSON.parse(file(name));

/**
 * A `fetch` replacement over `defaultRoutes()` plus `overrides` (a route set to `null` is removed). `fetch.calls`
 * lists `{ url, method, headers }` of every request.
 *
 * @param {Record<string, { status: number, body: string } | null>} [overrides]
 */
export function fixtureFetch(overrides = {}) {
  const routes = { ...defaultRoutes(), ...overrides };
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, headers: { ...init.headers } });
    const route = routes[url];
    if (!route) {
      const host = new URL(url).hostname;
      if (
        method === "HEAD" &&
        (host === "raw.githubusercontent.com" || host === "bitbucket.org")
      )
        return new Response(null, { status: 404 });
      throw new Error(`unexpected request ${method} ${url}`);
    }
    return new Response(method === "HEAD" ? null : route.body, {
      status: route.status,
    });
  };
  fetch.calls = calls;
  return fetch;
}

---
name: yii2-caching
description: Configure or repair Yii 22.0 data, query, fragment, page, and HTTP caching with correct keys and invalidation. Use for cache behavior or backend upgrades; not general performance tuning or lock coordination.
license: BSD-3-Clause
---

# Caching

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Identify the layer being changed: data values, query results/schema metadata,
  rendered fragments/pages, or HTTP validators. They have different keys and
  invalidation contracts. A backend change does not automatically refresh every
  layer, and a warm cache is not evidence of fresh data.
- Preserve the configured backend and component ID unless replacement is required.
  Yii 22.0 uses `ApcuCache` without `useApcu`; `ApcCache`, XCache, ZendDataCache,
  and the old `mget`/`mset`/`madd` aliases are removed. Use `multiGet`/`multiSet`/
  `multiAdd` and `Dependency::isChanged()`. Extensions such as Redis must be
  resolved separately from core; availability depends on runtime and deployment.
- Include every input that changes the cached value in its key or variations,
  including relevant tenant/user, authorization scope, locale, and query parameters.
  Do not cache personalized output under a public shared key. Keep current key
  prefix conventions and account for processes sharing the backend.
- `get()` uses false for a miss/expiry/changed dependency; `getOrSet()` therefore
  recomputes a legitimate false result. Use an explicit value envelope when false
  is a meaningful cached result. `exists()` does not check dependency freshness.
- Dependencies are evaluated when set and checked on retrieval; disabling the
  serializer disables dependency handling. Select TTL, tags, or a dependency that
  represents the actual source change. Verify invalidation on relevant writes;
  do not assume a transaction or record event clears an unrelated cached result.
- Page/fragment caching must preserve the requested dynamic content and vary by
  relevant request context. HTTP caching must preserve cache-control/privacy and
  conditional-request semantics. Treat schema-cache refresh separately after DDL.
- `getOrSet()` is not a lock or guarantee of single computation under concurrency.
  Do not use it to enforce uniqueness or serialize side effects. Do not flush a
  shared cache as an ordinary acceptance check; invalidation should be scoped.

## Observable acceptance

With isolated keys or a disposable backend, demonstrate miss, hit without repeated
computation, expiry or chosen dependency invalidation, and a fresh result after the
source changes. Check isolation between contexts represented in the key. Exercise
a meaningful false value if applicable. For HTTP caching verify a full response
and the corresponding conditional response, including relevant headers; for page
or fragment caching verify dynamic portions and authorized variants remain correct.
Report whether the production backend/SAPI was exercised or only an in-memory double.

## Evidence routes

Read `framework/caching/{Cache,Dependency,TagDependency,ApcuCache}.php`,
`framework/widgets/FragmentCache.php`, `framework/filters/{PageCache,HttpCache}.php`,
and query/schema cache integration in `framework/db/Connection.php` and `Schema.php`.
Tests: `tests/framework/caching/CacheTestCase.php`, `TagDependencyTest.php` and
`FileCacheTest.php` in that directory, `tests/framework/widgets/FragmentCacheTest.php`,
`tests/framework/filters/PageCacheTest.php`, and `HttpCacheTest.php`.
Guides: `caching-data`, `caching-fragment`, `caching-page`, `caching-http`.

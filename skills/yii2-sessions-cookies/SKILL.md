---
name: yii2-sessions-cookies
description: Configure or repair Yii 22.0 sessions, cookies, CSRF state, and session storage. Use for browser state lifecycle and session backend upgrades; not general login or RBAC implementation.
license: BSD-3-Clause
---

# Sessions and cookies

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Identify the active session component, cookie scope, and request/response path.
  Request cookies describe received values; response cookies schedule outgoing
  headers. PHP session state and Yii's identity cookie are separate mechanisms.
  Preserve the application's stateless mode when `User::enableSession` is false.
- Signed cookies provide integrity, not secrecy. Keep cookie validation enabled
  where the application relies on it and obtain the signing key through its
  configured secret mechanism. Preserve path/domain/Secure/HttpOnly/SameSite
  requirements and account for reverse-proxy scheme detection. Do not fix a
  rejected cookie by globally disabling validation or trusting arbitrary headers.
- Configure the session before opening it. Regeneration and destruction have
  observable effects on parallel requests and stored state; preserve the intended
  login/logout semantics. Close sessions when the application must release its
  session storage lock before long work; backend behavior must be checked.
- Flash retrieval and deletion are not interchangeable: inspect getFlash/getAllFlashes
  options and removeAfterAccess when messages disappear early or repeat. Test
  across requests rather than reading the same in-memory session twice.
- CSRF may use a cookie or session, according to Request configuration. Match token
  generation and validation to the actual form/AJAX request. An authenticated
  session does not itself prove CSRF validation occurred.
- CacheSession lifetime depends on its cache; DbSession depends on its table and
  configured callbacks. On MSSQL, 22.0 requires binary session data storage
  (`varbinary(max)`); an existing nvarchar column is not changed by a class update.
  Review the upgrade and configured schema before any authorized migration.

## Observable acceptance

Use a realistic request sequence to verify state survives and expires according
to the changed policy, cookies are emitted with correct attributes, and invalid
signed values are rejected. Verify flash consumption across requests when changed.
For storage changes exercise the actual backend and serialized payload roundtrip;
report a test double's limits. Use disposable sessions and never clear existing
users' sessions merely to validate a configuration change.

## Evidence routes

Read `framework/web/{Request,Response,Cookie,CookieCollection,Session,DbSession,CacheSession,User}.php`.
Tests: `tests/framework/web/RequestTest.php`, `tests/framework/web/ResponseTest.php`,
`tests/framework/web/CookieCollectionTest.php`,
`tests/framework/web/session/SessionLifecycleTest.php`,
`tests/framework/web/session/SessionTestTrait.php`, and backend suites under
`tests/framework/web/session/`. Guide: `runtime-sessions-cookies`.

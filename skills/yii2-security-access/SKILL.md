---
name: yii2-security-access
description: Implement Yii 22.0 identity authentication, access filters, RBAC, and cryptographic API usage. Use for login or permission behavior; not an unsolicited full security audit.
license: BSD-3-Clause
---

# Identity and access control

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Separate identity lookup, authentication, and permission decisions. Preserve the
  application's IdentityInterface implementation, session/token model, and existing
  policy. `User::login()` does not itself verify a submitted password.
- Use the configured access checker for `User::can()`. The removed
  `User::getAuthManager()` is not the extension point; inspect `getAccessChecker()`
  and `accessChecker` instead. RBAC roles, default roles, assignments, and Rule
  parameters all affect results. Supply the actual resource context for ownership
  rules; checking a role name alone does not establish object-level permission.
- Calls to `User::can()` without RBAC rule parameters may be cached in the user
  component/request. When permissions change and must be rechecked immediately,
  account for that cache as well as the RBAC manager's backend cache. A database
  edit behind the manager is not automatic invalidation.
- Preserve parent filters and action coverage. AccessRule controller restrictions
  do not match controllerless standalone actions. Guest denial can redirect or
  throw depending on request/session configuration; use the existing response
  contract. Authentication does not substitute for authorization on each resource.
- Use Security's password generation/validation and appropriate random/token APIs.
  Removed passwordHashStrategy, generateSalt(), and shouldUseLibreSSL() should not
  be restored in configuration. Preserve existing password migration behavior.
  SensitiveParameter redacts marked arguments in traces; it does not sanitize
  arbitrary log messages, serialized objects, or request bodies.
- For MSSQL RBAC upgrades, read the exact UPGRADE-22 schema/cascade procedure and
  inspect real constraint names. Native cascades deliberately exclude the child
  path in auth_item_child; the framework handles that direction. Do not apply a
  generic all-cascading FK rewrite or execute it as a routine permission test.

## Observable acceptance

Exercise permitted and denied identities for the affected action/resource,
including ownership context and inherited/default roles where relevant. For login
changes verify invalid credentials, valid login, logout, and configured session or
token behavior. For permission changes verify immediate and subsequent-request
results. Use isolated RBAC fixtures for mutations and never seed privileged users
or rotate production credentials as an incidental check.

## Evidence routes

Read `framework/web/{User,IdentityInterface}.php`, `framework/filters/{AccessControl,AccessRule}.php`,
`framework/rbac/{BaseManager,DbManager,PhpManager,CheckAccessInterface}.php`, and
`framework/base/Security.php`. Tests: `tests/framework/web/UserTest.php`,
`tests/framework/filters/AccessRuleTest.php`, `tests/framework/rbac/ManagerTestCase.php`,
`tests/framework/rbac/DbManagerTestCase.php`, `tests/framework/base/SecurityTest.php`,
`tests/framework/base/SensitiveParameterAttributionTest.php`.
Guides: `security-authentication`, `security-authorization`, `security-passwords`,
`security-cryptography`, `security-best-practices`.

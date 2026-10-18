---
name: yii2-web-routing-actions
description: Implement or repair Yii 22.0 web routes, controller actions, standalone actions, and action filters. Use for dispatch and request binding; not REST resource design or console commands.
license: BSD-3-Clause
---

# Web routing and actions

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Preserve the configured URL format, rule order, strict parsing, suffixes, modules,
  and normalization. URL parsing and URL creation are separate contracts: a URL
  that resolves is not evidence that reverse generation works. Use the application's
  URL helpers and route arrays for generated links without forcing pretty URLs.
- Retain the existing action style unless the change calls for a different one.
  Controller inline actions, controller `actions()` mappings, and module standalone
  actions have different ownership. `Module::$actionMap` is checked by the module
  whose `runAction()` handles the route, using only its first segment as the map
  key: a root map key `admin/report` does not match that full route. Child maps
  are not recursively consulted. Convention discovery maps `report` under an
  `actionNamespace` to `ReportAction`, not an arbitrarily named mapped `Report`
  class. A test calling `$child->runAction('report')` does not establish that
  `$app->runAction('admin/report')` consults the child map. Keep the requested
  public route while fixing dispatch; changing it to `/report` is a contract change.
- Explicit module action maps take precedence over controller resolution. A
  convention-discovered standalone class colliding with a controller action is a
  configuration error. Test the actual route from its public entrypoint, not only
  by invoking the action object directly.
- Standalone `yii\web\Action` has no owning controller. Handle nullable
  `Action::$controller`; a nonempty AccessRule `controllers` constraint does not
  match it. When replacing such a constraint, retain its module/resource boundary
  through the actual owning module or unique action ID (for example in a scoped
  matchCallback); merely deleting `controllers` broadens authorization. Preserve
  module/action behaviors and the application's authorization policy.
- `InlineAction::runWithParams()` now calls `beforeRun()` and `afterRun()`; remove
  duplicate manual hook calls in custom implementations. A false `beforeRun()`
  prevents the method from running. Check the actual hook signature and caller
  before assuming it transforms the returned result.
- Verify access, allowed HTTP methods, and CSRF on changed web actions, including
  inherited filters. Keep valid application/API authentication policy; do not
  blanket-disable CSRF to make a form pass. Do not attach web filters to console
  controllers. Report missing/malformed route parameters with the framework's
  request-error contract rather than error strings or swallowed exceptions.

## Observable acceptance

Resolve and generate affected routes with the configured UrlManager, including a
nonmatch when strict parsing applies. Through real dispatch, verify a permitted
request and the relevant denial paths: disallowed method, unauthorized identity,
missing/malformed parameter, and CSRF failure for affected cookie-authenticated
writes. Expect the application's actual redirect or HTTP error policy; do not
assume every guest denial redirects. Assert canceled actions have no side effect
and relevant lifecycle hooks run once when lifecycle behavior changed.

## Evidence routes

Read `framework/base/Module.php::runAction()`, `framework/base/InlineAction.php`,
`framework/web/Action.php`, `framework/web/UrlManager.php`,
`framework/web/UrlRule.php`, and `framework/filters/AccessRule.php`.
Tests include `tests/framework/base/ModuleActionMapTest.php`,
`ModuleActionNamespaceTest.php`, `InlineActionTest.php` in the same directory,
`tests/framework/web/WebActionTest.php`, `UrlManagerParseUrlTest.php`, and
`UrlManagerCreateUrlTest.php`. Guides: `runtime-routing`, `structure-controllers`,
`structure-filters`, `structure-modules`.

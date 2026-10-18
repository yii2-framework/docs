---
name: yii2-testing-fixtures
description: Create or repair Yii 22.0 application tests and database fixtures using the existing test runner. Use for fixture lifecycle and test isolation; not automatically installing a template test stack.
license: BSD-3-Clause
---

# Testing and fixtures

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Inspect the application's actual runner, suites, bootstrap, environment and
  scripts. Template source and downloaded application archives may contain
  different files; a script naming Codeception/PHPUnit does not prove its config
  or dependencies were shipped. Preserve the existing framework and assertions.
- Select the relevant test boundary. A model test does not exercise routing,
  authentication filters, serialization, or browser scripts. Use the narrowest
  existing harness that demonstrates the changed contract without claiming broader
  coverage from a lower-level check.
- Fixtures have dependencies and load/unload ordering. Keep aliases/data-file paths
  consistent; do not flatten the dependency graph or rely on test execution order
  to provide data. Repeated loading must start from the intended isolated state.
- In Yii 22.0, `ActiveFixture::load()` inserts through schema commands;
  `unload()` resets table data. Neither uses the model's normal save/validation/
  behavior lifecycle. Check the runner's unload/load sequence rather than assuming
  a direct `load()` call clears rows. With `modelClass` and no explicit `tableName`,
  initialization selects the model's `getDb()` connection, overriding fixture `db`.
  Resolve the actual target before either call; a test-named config is not proof
  of isolation. Yii ActiveRecord has no built-in `setDb()`; use the application's
  existing connection component or verified `getDb()` override.
- Use explicit disposable databases and synthetic data for destructive fixtures.
  Transactions are not universal isolation for implicit-commit DDL or multiple
  connections. Preserve backend-specific tests where SQL behavior depends on it.
- Restore Yii application/container/logger state, class event handlers, time/locale
  settings and temporary files when a test changes them. Do not force a particular
  global reset pattern if the existing harness already manages it correctly.

## Observable acceptance

Run the affected test(s) through the project's documented runner and verify the
behavior they are intended to detect. For fixture changes demonstrate dependency
order and clean reload/unload in the disposable target. Report actual passes,
failures/skips and unavailable prerequisites; do not present lint, test discovery,
or static skill validation as runtime acceptance or a model evaluation.

## Evidence routes

Read `framework/test/{Fixture,FixtureTrait,ArrayFixture,DbFixture,ActiveFixture}.php`,
`framework/console/controllers/FixtureController.php`, the application test bootstrap,
and its runner configuration. Tests: `tests/framework/test/FixtureTest.php`,
`tests/framework/test/ActiveFixtureTest.php`,
`tests/framework/console/controllers/FixtureControllerTest.php`, and
`tests/framework/db/` driver-specific ActiveFixture tests.
Guides: `test-overview`, `test-unit`, `test-functional`, `test-acceptance`, `test-fixtures`.

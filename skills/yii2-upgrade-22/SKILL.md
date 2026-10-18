---
name: yii2-upgrade-22
description: Assess or carry out an existing application's upgrade from Yii 2.0.x to Yii 22.0, including dependency blockers, applicable breaking changes, and staged verification. Use for the cross-version transition, not a new app or an isolated change already on 22.0.
license: BSD-3-Clause
---

# Upgrade an existing application to Yii 22.0

Read [the bundled conventions](references/conventions.md). Its Yii 22.0/PHP 8.3
requirements describe the target, not proof that the current application meets them.
Use [the applicability map](references/applicability.md) for affected areas; it
links to public guides without requiring other skills to be installed.

## Establish the starting and target states

Keep these evidence sources distinct:

| Evidence                                                     | What it establishes                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root and affected package `composer.json`                    | Declared requirements, conflicts, repositories, autoload mappings, scripts, and any emulated `config.platform` settings.                                 |
| `composer.lock`                                              | The resolved dependency set, which may differ from the current installation.                                                                             |
| Installed Composer metadata plus actual package files        | The installed paths/references and code, with the live-checkout checks in the conventions. An incomplete vendor tree is not a runnable installation.     |
| Actual web, CLI, worker/CI runtime and database observations | PHP/extensions and database versions in each environment used by the application. A CLI version or `config.platform.php` does not prove the Web runtime. |

Resolve the intended 22.0 revision and its `UPGRADE-22.md`/`CHANGELOG.md`, separately
from the old installed framework. For an older 2.0 application, establish the
latest compatible 2.0 baseline and apply its relevant `UPGRADE.md` sections before
the major upgrade. Do not invent a current release number or claim that a branch
constraint identifies a tested release. If already on 22.0 with no demonstrated
applicable defect, report that result and remaining verification limits; do not
repeat the migration or create changes to satisfy this skill.

## Readiness and change boundaries

- Target PHP must be at least 8.3, with the required extensions and a supported
  database version from the resolved upgrade guide. HHVM and CUBRID are unsupported.
  Separate runtime/server upgrades from application patches; source edits cannot
  make an unsupported runtime satisfy the target;
- check the declared requirements/conflicts of each affected installed extension
  and the proposed replacement version. A package requiring Yii `~2.0` excludes
  22.0; changing only the application's requirement does not remove that conflict.
  Record the blocking package and constraint. A resolvable dependency set still
  needs behavioral verification. Do not invent a compatible release, erase a
  constraint, alias 22.0 as 2.0, or use ignored platform requirements as proof of
  compatibility. Continue independent preparation while dependent installation is
  blocked;
- preserve staged, unstaged, untracked, and locally patched dependency changes.
  Establish the existing diff before edits or dependency replacement; do not reset,
  stash, overwrite vendor patches, or regenerate the whole application as an upgrade
  step. Preserve namespaces, routes, data, UI choices, and test organization;
- distinguish target requirements, changes required only by features the app uses,
  and optional adoption. Composer autoloading is required; adding standalone actions,
  changing UI frameworks, installing jQuery despite a working custom strategy, or
  adopting PSR-3 adapters is not. Retain Bower dependencies still required by an
  extension even when core moves to npm. Match each proposed change to application
  evidence and the target contract;
- database conversion instructions apply to actual drivers, tables, constraints,
  and stored data. Existing MySQL charsets or Oracle sequence-based keys do not
  automatically require conversion. MSSQL session/RBAC changes need their exact
  target instructions. Prepare backups and a verified restoration path before
  authorized data changes; do not execute generic ALTER statements, truncate
  sessions, revert applied migrations, or load fixtures against existing user data.

## Upgrade checkpoints and acceptance

Each checkpoint produces reviewable evidence; adapt commands to the existing
tooling and execute only the scope the user authorized.
Every runnable intermediate state must use autoload mappings and classes available
in that stage's installed version. Target source alone cannot establish that a
replacement entrypoint or component also works before the dependency upgrade.

| Checkpoint              | Evidence before proceeding with dependent work                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline                | Recorded installed/locked/runtime differences, existing local changes, and relevant application tests on the current state; identify pre-existing failures or missing prerequisites.                                                                                                         |
| Preparation             | Source/configuration patches for applicable removed APIs and signatures, identified dependency/runtime blockers, and preserved application behavior. Prefer old-version-compatible preparation where possible; label changes that require 22.0.                                              |
| Target resolution       | Review the intended dependency diff, actual installed target references and runtime requirements after the authorized update. Regenerate changed autoload mappings and verify web/console startup. Composer resolution, validation, and platform checks are distinct from application tests. |
| Behavioral verification | Run the existing suite and affected browser/driver checks: forms, assets, routes/access, queries/typecasting, sessions, cache invalidation, and logs as applicable. Test schema apply/reversal only on disposable data and only when reversal is supported.                                  |
| Release readiness       | Record unresolved failures, unavailable checks, data restoration requirements, and application-specific cache refresh/worker restart needs. Executing deployment, shared-cache flushes, or production migrations is a separately scoped operation, not an automatic check.                   |

Report required changes, optional choices retained, blockers, and checks actually
completed. Do not claim completion from a new Composer constraint, lint alone, a
framework test suite in another checkout, or a successful install without the
application's relevant behavior checks.

## Evidence routes

Use the target package's `framework/UPGRADE-22.md`, `framework/CHANGELOG.md`, and
`framework/composer.json` (omit `framework/` in a normal package installation),
the old package's `UPGRADE.md`, and each extension's own metadata/source.
The public overview is [Upgrading from Yii 2.0](https://yii2-framework.github.io/docs/guide/intro-upgrade-from-v2/index.md);
use it only with the provenance checks in the conventions. Follow the applicability
map for focused implementation guides instead of copying their manuals here.

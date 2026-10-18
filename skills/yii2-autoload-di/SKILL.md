---
name: yii2-autoload-di
description: Configure Yii 22.0 Composer autoloading, dependency injection, application components, and bootstrap wiring. Use for class resolution or object lifetime changes; not general project scaffolding.
license: BSD-3-Clause
---

# Autoloading and dependency injection

Read [the bundled conventions](references/conventions.md) before applying this
skill. It is independently usable; no umbrella skill or particular tool is required.

## Decisions that affect behavior

- Composer is the only class autoloader. Entry scripts must load its autoloader
  before referencing `Yii` or `yii\...`. `Yii::autoload()`, `Yii::$classMap`, and
  `framework/classes.php` are removed. Put application namespaces in the existing
  Composer `autoload`/`autoload-dev` structure and regenerate the autoloader only
  when its mapping changes; an alias such as `@app` is not an autoload mapping.
- Prefer an application subclass configured as the relevant component for ordinary
  customization. A deliberate same-FQCN replacement through Composer classmap and
  exclusions must implement the original API and cannot extend itself. Do not
  introduce such replacement for a routine component override.
- Distinguish class construction from service lookup. `Yii::$container` definitions
  configure object creation; application/module `components` register named,
  lazily created services that their service locator reuses. `params` contains
  values, not container bindings. A component ID need not equal its class name.
- Ordinary container class definitions create new objects on repeated resolution;
  `setSingleton()` and object-instance definitions share an instance. Select the
  lifetime required by the application, especially for mutable services in workers.
  Do not make a service a singleton simply to fix dependency resolution.
- Register interfaces and non-inferable constructor arguments explicitly. Do not
  assume arbitrary union/intersection types have an unambiguous injectable value;
  inspect the resolved Container implementation and supply the intended argument.
- Keep bootstrap order and configuration merging intact. A service definition
  does not by itself mean the service has bootstrapped. Resolve module-scoped
  components from the intended module rather than silently using the application.

## Observable acceptance

Exercise the relevant entrypoint with the application's generated autoloader and
resolve the affected class/service through the same path as production. Verify its
concrete type, required constructor values, and repeated-resolution identity for
the intended lifetime. For a changed namespace, include a class outside the already
loaded path so an accidental prior include cannot hide a broken mapping. Preserve
both web and console startup when their shared configuration changed.

Do not install dependencies or rewrite an unrelated autoload map merely to run a
check. Report absent vendor files or runtime requirements as verification gaps.

## Evidence routes

Inspect `framework/Yii.php`, `framework/BaseYii.php::createObject()`,
`framework/composer.json`, `framework/di/Container.php`,
`framework/di/ServiceLocator.php`, and `framework/base/Application.php`.
Regression examples are `tests/framework/di/ContainerTest.php` and
`tests/framework/di/ServiceLocatorTest.php`. Relevant guides are
`concept-autoloading`, `concept-di-container`, `concept-service-locator`,
`concept-configurations`, and `structure-applications`.

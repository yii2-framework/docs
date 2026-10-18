---
title: "Upgrading from Yii 2.0"
description: "Migrate Yii 2.0 applications to the PHP, asset, API and database contracts in Yii 22.0."
---

Update the application to the latest compatible Yii 2.0 release and apply its `UPGRADE.md` instructions before
moving to Yii 22.0. Review `UPGRADE-22.md` and `CHANGELOG.md` in the framework package at the version you are
installing; a development branch may contain changes absent from an earlier installation.

## Runtime and dependencies

Use PHP 8.3 or later and check each extension's compatibility with Yii 22.0. HHVM and CUBRID are no longer supported.
Check the [database server requirements](db-dao.md) before upgrading the framework.

Composer is the only class autoloader. Replace `Yii::$classMap` and `Yii::autoload()` usage with Composer mappings,
load `vendor/autoload.php` from entry scripts, and regenerate the autoloader. See [Autoloading](concept-autoloading.md).

## Forms, widgets and assets

- Replace `@bower` asset paths with the required npm packages; `@npm` now defaults to `@app/node_modules`.
  Remove Bower requirements only after checking extensions that still depend on them;
- configure client-script strategies for forms, validators, grids and CAPTCHA. The `yiisoft/yii2-jquery` extension
  provides the jQuery implementations; custom strategies are also supported. Server validation remains available
  without either. See [Client-side validation](input-validation.md#client-side-validation);
- review inline scripts: `View::POS_READY` and `POS_LOAD` use native DOM events and do not load jQuery or inject `$`.
  See [Client scripts](output-client-scripts.md#inline-scripts);
- set widget CSS classes explicitly or use a UI extension. Core form and grid defaults no longer supply Bootstrap
  classes, and `ActionColumn` no longer supplies Glyphicon markup;
- replace `ApcCache` with `ApcuCache`, remove `useApcu`, and replace removed cache backends and aliases listed in the
  installed upgrade guide. See [Data caching](caching-data.md).

## Subclasses and actions

Compare custom overrides with their installed parent signatures, especially actions, condition builders, database
schemas, MSSQL PDO wrappers and `DbManager`. Anonymous model classes must explicitly implement `formName()`.
Removed deprecated methods and properties are enumerated in the installed `UPGRADE-22.md`.

Inline actions now invoke `beforeRun()` and `afterRun()`; remove duplicate manual calls. A `false` result from
`beforeRun()` cancels execution. Module-level actions can have no controller; review shared filters and code that
dereferences `Action::$controller`. See [Standalone Actions](structure-standalone-actions.md).

## Database behavior and existing data

Use [UNION modifiers](db-query-builder.md#union) to sort or paginate a complete compound result. Ordinary `orderBy()`,
`limit()` and `offset()` configure its first `SELECT`. Review generated-SQL assertions for the updated pagination,
composite `IN`/`NOT IN` handling of `NULL`, and native SQLite upserts.

Active Record population now receives the query's connection for schema reflection and typecasting. Forward the
optional `$db` argument from overrides of `populateRecord()`, `getTableSchema()`, `Query::populate()` and
`ActiveQueryTrait::createModels()`. `attributes()` and `primaryKey()` still use the model's default connection unless
overridden; supplying a query connection does not redefine that model metadata.

Back up existing data before applying database-specific migration instructions:

- MySQL/MariaDB defaults to `utf8mb4` when no charset is configured; existing tables retain their previous charset.
  Review connection settings and table conversions separately. See [Database connections](db-dao.md#creating-db-connections);
- an explicitly configured PostgreSQL `defaultSchema` now sets the session `search_path`; review unqualified table
  names and matching pool configuration. Use structured builders for compound [column alterations](db-migrations.md#db-accessing-methods);
- MSSQL session tables need `varbinary(max)` for `data`; follow the installed guide when converting existing values;
- MSSQL RBAC schemas use different cascade handling. Inspect existing constraints and triggers before migrating;
- Oracle new auto-increment columns use native identity columns; existing sequence-and-trigger primary keys continue
  to work. Review custom Oracle parameter binding for the new native LOB path;
- reflected expression defaults now use `yii\db\Expression` across drivers. Review schema snapshots and
  `ActiveRecord::loadDefaultValues()` consumers, since saving such defaults can execute expressions;
- SQLite integrity changes cannot run inside a transaction or savepoint; place them outside that scope.

Run the application's tests against every database it supports. Review form behavior, rendered classes, asset loading,
authorization, session round trips, cache invalidation and logs after the upgrade. Yii 22.0 includes
[PSR-3 log adapters](runtime-logging.md#new-targets); avoid routing an external logger back into itself.

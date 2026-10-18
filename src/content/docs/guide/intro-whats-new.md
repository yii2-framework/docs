---
title: "What's new in Yii 22.0"
description: "Explore standalone actions, explicit client integrations, UNION query controls and PSR-3 logging in Yii 22.0."
---

Yii 22.0 adds ways to organize HTTP endpoints, choose client-side integrations and connect existing services.
This page highlights practical changes and links to their usage guides. For an existing Yii 2.0 application,
follow [Upgrading from Yii 2.0](intro-upgrade-from-v2.md) for compatibility requirements and migration steps.

## Actions without a controller <span id="standalone-actions"></span>

An endpoint can now be a class extending [[yii\web\Action]], dispatched directly through an application's or
module's `actionMap` or `actionNamespace`. Its public `run()` method accepts typed request parameters and
injected services:

```php
public function run(int $id, \yii\web\Response $response): \yii\web\Response
{
    $response->format = \yii\web\Response::FORMAT_JSON;
    $response->data = ['id' => $id];

    return $response;
}
```

A query value `id=7` becomes an integer; invalid or missing required input produces HTTP 400. The response
component is injected by name. Constructor dependencies use the normal DI container; custom service parameters
in `run()` need a matching component or registered definition.

Actions can be grouped around a use case or vertical slice and delegate business work to application/domain
services. Controller actions remain available. Yii supplies dispatch and DI; the application chooses its
architecture and authorization policies.

Read [Standalone Actions](structure-standalone-actions.md) for complete registration examples, a quote use case,
module routing, filters, CSRF responsibilities and lifecycle hooks. See also
[action dependency injection](concept-di-container.md#standalone-action-dependencies).

## Explicit client integrations <span id="client-integrations"></span>

`ActiveForm`, `GridView`, `CheckboxColumn`, CAPTCHA and built-in client validators use configurable client-script
strategies. Core server rendering and validation remain usable without those strategies. The
`yiisoft/yii2-jquery` extension supplies the jQuery implementations; applications can supply their own strategies.

Client behavior and visual styling are separate choices. Core form fields, tables and pagers no longer add
Bootstrap classes automatically, so configure the classes or UI extension your application needs.

- [Forms: client behavior and styling](input-forms.md#client-behavior-and-styling)
- [Client-side validation](input-validation.md#client-side-validation)
- [Data widget interaction and styling](output-data-widgets.md#styling-and-client-behavior)

For inline JavaScript, `View::POS_READY` uses `DOMContentLoaded` and `View::POS_LOAD` uses the native window
`load` event. Neither automatically registers jQuery or injects `$`:

```php
$view->registerJs(
    "document.getElementById('save').addEventListener('click', saveDraft);",
    \yii\web\View::POS_READY,
);
```

Here the page supplies the `save` element and `saveDraft` function. See
[Working with Client Scripts](output-client-scripts.md#inline-scripts) for registration and dependencies.

## Ordering and paging a complete UNION <span id="union-queries"></span>

The query builder separates modifiers on a SELECT operand from modifiers on the combined `UNION` result:

```php
$query = (new \yii\db\Query())
    ->select(['id'])
    ->from('current_orders')
    ->union((new \yii\db\Query())->select(['id'])->from('archived_orders'))
    ->unionOrderBy(['id' => SORT_ASC])
    ->unionLimit(20)
    ->unionOffset(10);
```

This requests twenty IDs from the combined result, skipping the first ten in the combined ordering.
`ActiveDataProvider` uses these modifiers for UNION sorting and pagination, while preserving operand-level
modifiers. See [Query Builder](db-query-builder.md#union) and [Data Providers](output-data-providers.md#union-queries).

## PSR-3 logging in both directions <span id="psr-3-logging"></span>

Use `PsrLogger` to send a library's PSR-3 messages to Yii's configured logging targets:

```php
$logger = new \yii\log\PsrLogger(category: 'checkout');
$logger->info('Quote prepared for {quantity} items.', ['quantity' => 2]);
```

Use `PsrTarget` when Yii messages should go to an external PSR-3 logger. The adapters preserve PSR-3 message
context and original levels where available. See [Logging](runtime-logging.md#psr-3-interoperability) for
configuration and filtering; avoid routing both adapters back into the same logging pipeline.

## Composer autoloading and npm assets <span id="autoloading-and-assets"></span>

Composer loads framework and application classes. Define application namespaces in `composer.json`; Yii path
aliases still resolve paths but do not load classes. The default `@npm` alias points to
`<basePath>/node_modules`, and `@bower` is no longer predefined.

See [Class Autoloading](concept-autoloading.md), [Entry Scripts](structure-entry-scripts.md) and
[installing npm assets](structure-assets.md#bower-npm-assets) for the application setup.

## Database behavior to use deliberately <span id="database-behavior"></span>

The database layer also updates several contracts that affect everyday code:

- MySQL/MariaDB connections default to `utf8mb4`; an explicit connection charset or DSN charset can override it.
  Use `Connection::getEffectiveCharset()` when configuration depends on the resolved charset.
- PostgreSQL applies an explicitly configured schema as the session `search_path`; leaving it unspecified
  preserves the server's path.
- SQLite upserts use native `INSERT ... ON CONFLICT`. Unrelated constraint violations still fail; an upsert
  is not a blanket instruction to ignore invalid data.
- PostgreSQL structured column alterations can express type, nullability and defaults. A bare type alteration
  preserves the existing null/default state instead of resetting it implicitly.

See [DAO connection configuration](db-dao.md#creating-db-connections),
[upserts](db-dao.md#non-select-queries) and [database migrations](db-migrations.md).

Yii 22.0 requires PHP 8.3 or later and raises the supported database versions. Check the
[upgrade requirements](intro-upgrade-from-v2.md) and each installed extension before changing dependencies.
These highlights are a guide to the version's behavior, not a compatibility guarantee for every application.

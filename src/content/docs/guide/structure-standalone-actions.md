---
title: "Standalone Actions"
description: "Handle HTTP requests with independent action classes, explicit or namespace-based routing, and injected application services."
---

Yii 22.0 can dispatch an action class directly from an [application](structure-applications.md) or
[module](structure-modules.md), without a hosting controller. Each class handles one endpoint through a public
`run()` method. Use [[yii\web\Action]] for HTTP endpoints: it binds request parameters and services with the same
HTTP-aware rules as web controller actions.

This gives an application another way to organize its endpoints. It can coexist with
[controllers](structure-controllers.md), including external action classes registered in `Controller::actions()`.
An existing external action is suitable for direct dispatch only if it works without `$this->controller`.

## Creating an action <span id="creating-an-action"></span>

With the [Composer mapping](concept-autoloading.md) `app\` to `src/`, create `src/actions/HealthAction.php`:

```php
<?php

declare(strict_types=1);

namespace app\actions;

use yii\filters\VerbFilter;
use yii\web\Action;
use yii\web\Response;

final class HealthAction extends Action
{
    public function behaviors(): array
    {
        return [
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => ['*' => ['GET', 'HEAD']],
            ],
        ];
    }

    public function run(Response $response): Response
    {
        $response->format = Response::FORMAT_JSON;
        $response->data = ['status' => 'ok'];

        return $response;
    }
}
```

This is a public, read-only endpoint. The `$response` argument is resolved from the application's `response`
component. The action returns the configured response; it does not need controller helpers such as `asJson()`.

## Registering actions <span id="registering-actions"></span>

### Explicit registration <span id="action-map"></span>

Set [[yii\base\Module::$actionMap|actionMap]] in the web application configuration:

```php
return [
    // id, basePath, components, ...
    'actionMap' => [
        'health' => \app\actions\HealthAction::class,
    ],
];
```

With the default URL format, a GET request to `/index.php?r=health` returns `{"status":"ok"}`. A map value can
also be an object configuration array containing a `class` entry and action properties.

The map is checked before controller or namespace discovery. Its key matches the **first route segment**;
remaining segments are not used to select another action. Reserve that route prefix for the mapped endpoint.
Use namespace discovery for hierarchical routes such as `reports/sales`.

### Namespace discovery <span id="action-namespace"></span>

As an alternative to the map above, configure [[yii\base\Module::$actionNamespace|actionNamespace]]:

```php
return [
    // id, basePath, components, ...
    'actionNamespace' => 'app\\actions',
];
```

The route `health` now resolves to the same `app\actions\HealthAction` class. When not explicitly configured,
`actionNamespace` defaults to the module's `controllerNamespace`.

The last route segment becomes the class name, with words capitalized, hyphens removed and `Action` appended.
Earlier segments become subnamespaces, preserving their spelling and case:

| Route                 | Class with `actionNamespace = app\actions` | File under `src/`                      |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| `health`              | `app\actions\HealthAction`                 | `actions/HealthAction.php`             |
| `reports/sales`       | `app\actions\reports\SalesAction`          | `actions/reports/SalesAction.php`      |
| `orders/view-summary` | `app\actions\orders\ViewSummaryAction`     | `actions/orders/ViewSummaryAction.php` |

Use valid PHP namespace segments for the preceding path and a lowercase initial letter in the last route
segment. Empty segments such as `reports//sales` do not resolve. Composer must be able to load each class;
setting a Yii path alias alone does not register a namespace.

A route that resolves both to an existing controller action and to a discovered standalone action raises
[[yii\base\InvalidConfigException]]. Choose distinct routes when both styles coexist. An explicit `actionMap`
entry takes precedence over both discovery paths.

### Actions in modules <span id="actions-in-modules"></span>

A registered module ID takes precedence over a subnamespace with the same name. Configure the child module's
namespace to expose its actions through the application:

```php
return [
    // id, basePath, components, ...
    'modules' => [
        'admin' => [
            'class' => \yii\base\Module::class,
            'actionNamespace' => 'app\\modules\\admin\\actions',
        ],
    ],
];
```

Here `admin/report` discovers `app\modules\admin\actions\ReportAction`. For a controllerless action,
`$this->getModule()` identifies its owning module and `$this->getUniqueId()` includes that module's route prefix.

`actionMap` is local to the module whose `runAction()` is called. Application dispatch of `admin/report` does
not search the child module's `actionMap`; use the child's `actionNamespace` for this route. Calling
`$admin->runAction('report')` directly does consult the child's map and is a different dispatch path.

## Parameters and dependencies <span id="parameters-and-dependencies"></span>

### The `run()` signature <span id="run-parameters"></span>

Declare a public `run()` method with the route/query parameters and services it needs. For example:

```php
public function run(int $id, Response $response, string $format = 'summary'): Response
{
    $response->format = Response::FORMAT_JSON;
    $response->data = ['id' => $id, 'format' => $format];

    return $response;
}
```

A query parameter `id=7` becomes integer `7`. An invalid value such as `id=abc`, or an absent required `id`,
raises [[yii\web\BadRequestHttpException]] (HTTP 400). Defaults apply to omitted scalar parameters. Request
body data is not automatically bound to `run()` arguments: obtain it from the request and validate it using
a [model](input-validation.md).

For an absent parameter with a named class or interface type, the HTTP binder looks for a compatible service in
this order:

1. A component of the owning module named after the parameter, such as `response` for `$response`.
2. A component registered under the parameter's fully qualified type name.
3. An explicitly registered definition of that type in `Yii::$container`.
4. `null`, if the type allows it; otherwise [[yii\web\ServerErrorHttpException]] (HTTP 500).

Module component lookup can inherit application components. A concrete class type in `run()` is **not** enough
to request automatic construction when no matching component or container definition exists. Register the
service explicitly or inject it through the constructor. A request parameter with the same name is processed
as input before service lookup; use distinct names for inputs and services.

[[yii\base\Action]] also supports dispatch without a controller, but uses the DI container's callable dependency
resolution instead of HTTP scalar filtering and HTTP error mapping. Use it where those HTTP semantics are not
needed. The examples in this guide use `yii\web\Action`.

### Constructor injection <span id="constructor-injection"></span>

The dispatcher creates the action through `Yii::createObject()` without positional constructor arguments.
The [DI container](concept-di-container.md#constructor-injection) can construct concrete dependencies recursively;
interfaces require a definition. The constructor does not receive route parameters or named application
components automatically.

When overriding the constructor, keep the configuration argument last and call
`parent::__construct(null, null, $config)` to retain normal configuration and initialization. The dispatcher
assigns the action ID and owning module **after** construction. Do not depend on them in the constructor or
`init()`; they are available when the action runs. `$this->controller` remains `null`.

## Organizing by use case <span id="organizing-by-use-case"></span>

Actions can live alongside the application service and other code for a particular feature. For example,
with `app\` mapped to `src/`, a small quote feature could use:

```text
src/
  checkout/
    quote/
      PreviewAction.php
      QuoteService.php
```

The application service in `src/checkout/quote/QuoteService.php` has no dependency on Yii or HTTP:

```php
<?php

declare(strict_types=1);

namespace app\checkout\quote;

final class QuoteService
{
    public function total(int $quantity): int
    {
        if ($quantity < 1 || $quantity > 100) {
            throw new \InvalidArgumentException('Quantity must be between 1 and 100.');
        }

        return $quantity * 1500;
    }
}
```

For this example, the fixed unit price is 1,500 minor currency units. A real application service could instead
coordinate domain objects and a repository. `PreviewAction.php` adapts the HTTP request to that service:

```php
<?php

declare(strict_types=1);

namespace app\checkout\quote;

use yii\filters\VerbFilter;
use yii\web\Action;
use yii\web\BadRequestHttpException;
use yii\web\Response;

final class PreviewAction extends Action
{
    public function __construct(private readonly QuoteService $quotes, array $config = [])
    {
        parent::__construct(null, null, $config);
    }

    public function behaviors(): array
    {
        return [
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => ['*' => ['GET', 'HEAD']],
            ],
        ];
    }

    public function run(int $quantity, Response $response): Response
    {
        try {
            $total = $this->quotes->total($quantity);
        } catch (\InvalidArgumentException $exception) {
            throw new BadRequestHttpException($exception->getMessage(), 0, $exception);
        }

        $response->format = Response::FORMAT_JSON;
        $response->data = ['total' => $total];

        return $response;
    }
}
```

Register the endpoint independently of this directory layout:

```php
'actionMap' => [
    'quote-preview' => \app\checkout\quote\PreviewAction::class,
],
```

`/index.php?r=quote-preview&quantity=2` returns `{"total":3000}`. The container constructs `QuoteService` for the
constructor, while the HTTP binder resolves `Response $response` from the application component. The service
can be tested directly, without constructing an application or dispatching an action.

Alternatively, `'actionNamespace' => 'app\\checkout'` exposes the class through `quote/preview`. Use whichever
registration fits the application's route design.

This layout is one possible vertical slice: code is grouped around a use case instead of a controller containing
many unrelated endpoints. Yii provides dispatch, DI and lifecycle hooks; it does not impose this layout, create
domain boundaries or implement domain-driven design on the application's behalf. An action class alone does not
make an application DDD. Keep business rules in the appropriate application or domain services for your design.

## Filters and lifecycle <span id="filters-and-lifecycle"></span>

Standalone actions inherit `behaviors()` from [[yii\base\Component]]. Attach applicable filters there, as the
`VerbFilter` examples above do. Application and ancestor-module filters also participate. Filters attached to
a controller do not run for an action dispatched without that controller.

For direct dispatch, the sequence is:

1. Application and ancestor modules run `beforeAction()`, from outermost to innermost.
2. The action emits `Controller::EVENT_BEFORE_ACTION`, allowing attached filters to cancel execution.
3. Parameters are bound, `beforeRun()` is called, and, if it returns `true`, `run()` and `afterRun()` execute.
4. The action emits `Controller::EVENT_AFTER_ACTION`, followed by module `afterAction()` hooks from innermost
   to outermost.

`Action::afterRun()` takes no result argument and its return value does not replace the result. An after-action
event handler can update `ActionEvent::$result`; module `afterAction()` hooks can also transform the result.

Access policies must cover the standalone route. An `AccessRule` with a non-empty `controllers` constraint does
not match an action whose controller is `null`. Use applicable action rules or callbacks and verify the
unauthenticated, authenticated and unauthorized cases; see [authorization](security-authorization.md).

`yii\web\Action` does not execute `yii\web\Controller::beforeAction()`, where the controller normally validates
CSRF tokens. For state-changing endpoints authenticated by cookies, perform the required
[CSRF validation](security-best-practices.md#avoiding-csrf) in an application/module hook or action filter before
calling the service. Restricting the HTTP verb alone does not validate a CSRF token.

## Responses, views and URLs <span id="responses-and-urls"></span>

Return a configured [[yii\web\Response]] or data that the application can put in its response. For HTML, use the
[view component](structure-views.md#rendering-in-other-places), with an explicit view path such as
`@app/checkout/quote/preview.php`. Controller-relative view lookup, `render()` and `redirect()` are controller
conveniences; use the corresponding view and response services when no controller is present.

Use absolute application routes for links, for example `Url::to(['/quote-preview', 'quantity' => 2])` or
`Url::to(['/admin/report'])`. Normal [URL rules](runtime-routing.md#url-rules) can map pretty URLs to these routes.
`Url::current()`, `Url::canonical()`, pagination and sorting can use `Application::$requestedRoute` when there is
no active controller. Set an explicit route when generating these URLs outside normal request dispatch;
see the [URL helper](helper-url.md).

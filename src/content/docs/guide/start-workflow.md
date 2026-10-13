---
title: "Running Applications"
description: "Run the Yii 22.0 Basic Project Template and learn its source, view, public, and configuration directories."
---

After [installing Yii](start-installation.md), open `http://localhost:8080/` while the development server is running.
This section introduces the Basic Project Template's functionality, directory layout, and request lifecycle.

> Info: The Getting Started examples assume that `basic/public` is the Web server's document root. With the
> development server, use `http://localhost:8080/index.php`; replace the hostname and port for your own server.

Note that unlike framework itself, after project template is installed it's all yours. You're free to add or delete
code and overall modify it as you need.

## Functionality <span id="functionality"></span>

The basic application includes these pages:

- the homepage, displayed when you access the URL `http://localhost:8080/index.php`,
- the "About" page,
- the "Contact" page, which displays a contact form that allows end users to contact you via email,
- and the "Login" page, which displays a login form that can be used to authenticate end users. Try logging in
  with the administrator credentials configured in `config/params.php` after running the migrations. Change those
  credentials before deployment.

These pages share a common header and footer. The header contains a main menu bar to allow navigation
among different pages.

You should also see a toolbar at the bottom of the browser window.
This is a useful [debugger tool](https://github.com/yiisoft/yii2-debug/blob/master/docs/guide/README.md) provided by Yii to record and display a lot of debugging information, such as log messages, response statuses, the database queries run, and so on.

Additionally to the web application, there is a console script called `yii`, which is located in the applications base directory.
This script can be used to run background and maintenance tasks for the application, which are described
in the [Console Application Section](tutorial-console.md).

## Application Structure <span id="application-structure"></span>

The most important directories and files in your application are (assuming the application's root directory is `basic`):

```text
basic/                  application base path
    composer.json       Composer dependencies, app namespace mapping, and scripts
    config/             Web, console, database, and other configuration
    node_modules/       installed CSS and JavaScript packages
    public/             Web document root
        assets/         asset files published by Yii
        index.php       Web entry script
    resources/
        mail/           mail templates
        views/          view scripts and layouts
    src/                PHP classes in the app namespace
        assets/         application asset bundles
        commands/       console controllers
        controllers/   Web controllers
        migrations/    database migrations
        models/        application models
    runtime/            generated logs, cache files, and the default SQLite database
    vendor/             installed Composer packages
    yii                 console entry script
```

The template source also has `tests/` and development tool configuration; these are excluded from distribution
archives. See [Development checks](start-installation.md#development-checks).

In general, the files in the application can be divided into two types: those under `basic/public` and those
under other directories. The former can be directly accessed via HTTP (i.e., in a browser), while the latter can not and should not be.

Yii implements the [model-view-controller (MVC)](https://wikipedia.org/wiki/Model-view-controller) architectural pattern,
which is reflected in the above directory organization. The `src/models` directory contains all [model classes](structure-models.md),
the `resources/views` directory contains all [view scripts](structure-views.md), and the `src/controllers` directory contains
all [controller classes](structure-controllers.md).

Each application has an entry script `public/index.php` which is the only Web accessible PHP script in the application.
The entry script takes an incoming request and creates an [application](structure-applications.md) instance to handle it.
The [application](structure-applications.md) resolves the request with the help of its [components](concept-components.md),
and dispatches the request to the MVC elements. [Widgets](structure-widgets.md) are used in the [views](structure-views.md)
to help build complex and dynamic user interface elements.

## Request Lifecycle <span id="request-lifecycle"></span>

The following diagram shows how an application handles a request.

![Request Lifecycle](/docs/guide/images/request-lifecycle.png)

1. A user makes a request to the [entry script](structure-entry-scripts.md) `public/index.php`.
2. The entry script loads the application [configuration](concept-configurations.md) and creates
   an [application](structure-applications.md) instance to handle the request.
3. The application resolves the requested [route](runtime-routing.md) with the help of
   the [request](runtime-requests.md) application component.
4. The application creates a [controller](structure-controllers.md) instance to handle the request.
5. The controller creates an [action](structure-controllers.md) instance and performs the filters for the action.
6. If any filter fails, the action is cancelled.
7. If all filters pass, the action is executed.
8. The action loads some data models, possibly from a database.
9. The action renders a view, providing it with the data models.
10. The rendered result is returned to the [response](runtime-responses.md) application component.
11. The response component sends the rendered result to the user's browser.

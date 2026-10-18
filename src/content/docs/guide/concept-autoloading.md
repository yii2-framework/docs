---
title: "Class Autoloading"
description: "Load Yii 22.0 application and extension classes through Composer with PSR-4 mappings."
---

Yii 22.0 uses [Composer's autoloader](https://getcomposer.org/doc/01-basic-usage.md#autoloading) for framework,
application, and extension classes. The [entry script](structure-entry-scripts.md) loads it once:

```php
require __DIR__ . '/../vendor/autoload.php';
```

This path applies to `public/index.php` in the [Basic Project Template](start-installation.md). The console entry
script `yii`, in the project root, uses `__DIR__ . '/vendor/autoload.php'`.

## Using Composer <span id="using-yii-autoloader"></span>

The template maps the `app` namespace to `src/` in its `composer.json`:

```json
{
  "autoload": {
    "psr-4": {
      "app\\": "src/"
    }
  }
}
```

For example, `app\components\Greeting` belongs in `src/components/Greeting.php`:

```php
<?php

declare(strict_types=1);

namespace app\components;

final class Greeting
{
    public function message(string $name): string
    {
        return 'Hello, ' . $name;
    }
}
```

Namespace segments and file names must match the mapping, including their case. After adding or changing an
autoload mapping, regenerate the autoloader from the application root:

```bash
composer dump-autoload
```

[Yii aliases](concept-aliases.md) resolve paths used by Yii components. They do not register namespaces with
Composer: `Yii::setAlias('@example', $path)` alone cannot make an `example\MyClass` class autoloadable.

> Note: Yii 22.0 removed `Yii::autoload()` and `Yii::$classMap`. When migrating an application, move its namespace
> mappings to Composer instead of registering the Yii 2.0 autoloader.

## Class Map <span id="class-map"></span>

For classes that do not follow PSR-4, add file or directory paths to Composer's `classmap` configuration:

```json
{
  "autoload": {
    "classmap": ["legacy/"]
  }
}
```

These are filesystem paths relative to `composer.json`, not Yii aliases. Run `composer dump-autoload` after changing
the configuration or adding classes to a mapped directory. See [Composer's autoload schema](https://getcomposer.org/doc/04-schema.md#autoload).

## Using Other Autoloaders <span id="using-other-autoloaders"></span>

Prefer Composer packages with their own autoload configuration. If a library requires a separate autoloader,
follow that library's initialization instructions and keep the Composer autoloader installed for Yii and the
application. Do not generate or maintain `vendor/autoload.php` by hand.

## Autoloading Extension Classes <span id="autoloading-extension-classes"></span>

An [extension](structure-extensions.md) declares its namespace mappings in its own `composer.json`. Installing it
with Composer adds those mappings to the application's autoloader. Follow the package's Yii 22.0 installation
instructions for any additional bootstrapping or asset setup; a namespace alias is not a substitute for installation.

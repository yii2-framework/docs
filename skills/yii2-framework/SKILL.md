---
name: yii2-framework
description: Use when creating or changing a Yii 22.0 app, including setup, controllers, ActiveRecord, forms, tests.
metadata:
  guide: https://yii2-framework.github.io/docs/llms.txt
license: BSD-3-Clause
---

# Build a Yii 22.0 Application

This skill applies to the Yii 22.0 line (`yiisoft/yii2` `^22.0@dev`, branch `22.0`), which requires PHP 8.3 and loads
classes only through Composer. The Yii 2.0 API is largely unchanged; this skill gives the conventions to follow and
the places where 22.0 differs. Guide pages live at `https://yii2-framework.github.io/docs/guide/<slug>/`; append
`index.md` for the Markdown version. Fetch `https://yii2-framework.github.io/docs/llms.txt` to find pages not named here.

## Resolve the documentation revision

In a root package checkout, use `composer show --self --format=json` for metadata. For installed dependencies,
resolve the real path and read the configured vendor directory's `composer/installed.php` (`versions[<package>]`):
`install_path`, `pretty_version` and Composer's selected `reference`. Do not blindly prefer `source.reference`
over `dist.reference`. For any live package checkout, including a symlinked path install, inspect its current
`HEAD` and files even when clean; report metadata mismatches and let the actual files govern. Uncommitted changes
have no matching SHA. Otherwise use the selected reference or a verified matching tag only after establishing
its source provenance. Compare `composer.lock`; it may differ from the inspected installation. Identify a
lock-only state when no package files are installed, and resolve dependencies separately. Use hosted pages,
catalogs or snapshots only when their source revision matches.

Resolve `yiisoft/yii2` and each extension or template used by the task separately. The site tracks a development
line; its version label alone does not establish a matching commit. Prefer supplied local indexes, checkout
guides and installed PHPDoc. Otherwise read the needed guide/code at the resolved upstream reference. If matching
guides are unavailable or offline, inspect local source/PHPDoc and the changelog, and report the gap. The examples
below must be checked against that state before use.

## Focused subsystem skills

For a scoped change, select the matching skill from the owning repository's `skills/README.md` or published skill index.
Each subsystem bundle carries its own conventions and evidence routes; install only the needed bundles.
For an existing Yii 2.0.x application, select `yii2-upgrade-22` for dependency readiness, applicable breaking changes
and staged verification before using the subsystem guidance.

## Workflow

Use only the sections relevant to the requested change. Preserve an existing
application's template, packages, configuration and code conventions; create a
project or add models, controllers and migrations only when the task needs them.
The commands below are examples: equivalent tools are valid when they establish
the same behavior.

- [ ] Step 1: Create the project from a template
- [ ] Step 2: Learn the structure and configuration
- [ ] Step 3: Add a controller with access control and verb filters
- [ ] Step 4: Add an ActiveRecord model with validation
- [ ] Step 5: Add a migration
- [ ] Step 6: Add a form view
- [ ] Step 7: Configure routing and query safely
- [ ] Step 8: Account for the differences from Yii 2.0
- [ ] Step 9: Apply the code standards and run the tests

## Step 1: Create the project from a template

Start from the application template `yiisoft/yii2-app-basic`, branch `22` (jQuery client validation, Bootstrap 5
views, SQLite, Codeception):

```bash
composer create-project --prefer-dist --stability=dev yiisoft/yii2-app-basic:^22.0 basic
cd basic
mkdir -p runtime
./yii migrate
./yii serve --docroot=public
```

Requirements: PHP `>=8.3`, `mbstring`, `pdo_sqlite`, Composer 2, and Node.js/npm for the template assets. The packages
are in development (`^22.0@dev`), so keep `--stability=dev`. Without `:^22.0` Composer may select the Yii 2.0 template.
To add the framework to an existing project, run `composer require yiisoft/yii2:^22.0@dev`.

Single-page alternatives (PHP `>=8.3`, `yiisoft/yii2` `^22.0@dev`, `yii2-extensions/inertia` `^0.6`):

- Vue through Inertia: `composer create-project --prefer-dist yii2-extensions/app-inertia-vue:^0.1@dev app-vue`
- React through Inertia: `composer create-project --prefer-dist yii2-extensions/app-inertia-react:^0.1@dev app-react`

**Verify:** `php -v` reports 8.3 or newer, `php -l public/index.php` reports no syntax errors, `composer validate`
passes, and `http://localhost:8080` renders the home page (default `./yii serve` address).

Guide: `start-installation`.

## Step 2: Learn the structure and configuration

Layout of `yiisoft/yii2-app-basic@22`:

```text
config/ (web, console, db, params, test)   public/index.php   resources/ (views, mail)   rbac/   tests/   yii
src/ (namespace app\): assets, commands, controllers, migrations, models, widgets
```

1. `public/index.php` creates `yii\web\Application` from `config/web.php`; `yii` creates `yii\console\Application`
   from `config/console.php`. In `dev` the entry script also checks `requirements.php`.
2. Put services under `components`, values under `params`, container bindings under `container.definitions` and
   `container.singletons`, and feature groups in `modules`.
3. `components.request.cookieValidationKey` is `''` in `config/web.php`; `composer install` fills it with a random
   secret (`generateCookieValidationKey`). Never commit a real key, and never set a short fixed one.
4. Read values with `Yii::$app->params['key']` and services with `Yii::$app->db`. The seeded administrator comes from
   `params` (`admin.username`, `admin.password`); change both before any deployment.

**Verify:** `php -l config/web.php`, then `./yii help` lists the commands without errors.

Guides: `structure-applications`, `concept-configurations`, `structure-modules`, `structure-entry-scripts`.

## Step 3: Add a controller with access control and verb filters

Verify authorization and allowed verbs for the affected web actions, including
inherited behaviors and the application's existing policy. Use `AccessControl`
and `VerbFilter` where needed; the example below protects `create`. List
protected actions and allow roles explicitly (`?` guest, `@` authenticated, or
an RBAC role). Do not replace parent behaviors or apply web filters to console
controllers by default.

```php
<?php

declare(strict_types=1);

namespace app\controllers;

use app\models\Post;
use Yii;
use yii\filters\AccessControl;
use yii\filters\VerbFilter;
use yii\web\{Controller, Response};

class PostController extends Controller
{
    public function behaviors(): array
    {
        return [
            'access' => [
                'class' => AccessControl::class,
                'only' => ['create'],
                'rules' => [['actions' => ['create'], 'allow' => true, 'roles' => ['@']]],
            ],
            'verbs' => [
                'class' => VerbFilter::class,
                'actions' => ['create' => ['get', 'post']],
            ],
        ];
    }

    public function actionCreate(): Response|string
    {
        $model = new Post();

        if ($model->load(Yii::$app->request->post()) && $model->save()) {
            return $this->redirect(['index']);
        }

        return $this->render('create', ['model' => $model]);
    }
}
```

Action methods are `action<Name>`; the route is `<controller-id>/<action-id>` in kebab-case. Throw
`NotFoundHttpException` or `ForbiddenHttpException` instead of returning error strings. State-changing actions accept
only `post` (`'delete' => ['post']`), and CSRF validation stays enabled.

**Verify:** `php -l src/controllers/PostController.php`; request `create` as a guest and expect a redirect to the
login URL; send a request with a disallowed verb and expect HTTP 405.

Guides: `structure-controllers`, `structure-filters`, `security-authorization`.

## Step 4: Add an ActiveRecord model with validation

Verify the model's table mapping, validation rules and labels, including
inherited defaults. Override `tableName()`, `rules()` or `attributeLabels()`
when the requested model needs different behavior; do not edit unrelated
template models to add redundant methods.

```php
<?php

declare(strict_types=1);

namespace app\models;

use yii\db\ActiveRecord;

class Post extends ActiveRecord
{
    public static function tableName(): string
    {
        return '{{%post}}';
    }

    public function rules(): array
    {
        return [
            [['title', 'body'], 'required'],
            ['title', 'trim'],
            ['title', 'string', 'max' => 255],
        ];
    }

    public function attributeLabels(): array
    {
        return ['title' => 'Title', 'body' => 'Body'];
    }
}
```

`load()` mass-assigns only safe attributes in the current scenario; an attribute
mentioned in `rules()` can still be unsafe or inactive. Loading does not
validate. Restrict safe attributes to permitted user input, then call
`validate()` or a validating `save()` before persistence. Use `{{%name}}` so the
table prefix applies. `save()` validates by default; `save(false)` skips
validation. Core validators include
`required`, `string`, `integer`, `email`, `unique`, `exist`, `in`, and `date`.

**Verify:** `php -l src/models/Post.php`; a test saves an invalid model and asserts `false` and the error key.

Guides: `db-active-record`, `input-validation`, `tutorial-core-validators`, `structure-models`.

## Step 5: Add a migration

Choose one matching method pair:

- prefer `safeUp()` and `safeDown()` when every operation can run in the database transaction that Yii adds around
  these methods;
- use `up()` and `down()` when the DBMS or an operation cannot be transactional, or when the migration needs explicit
  transaction control.

Do not mix the pairs. Implement reversal where possible; explicitly return
`false` when a migration cannot be reversed. When overriding `up()` and
`down()`, keep the signatures
compatible with Yii's migration contract: use the generated untyped signatures and return `false` to stop a migration;
do not add `: void`.

Create it with `./yii migrate/create create_post_table`:

```php
<?php

declare(strict_types=1);

namespace app\migrations;

use yii\db\Migration;

final class M260101000000CreatePostTable extends Migration
{
    public function safeUp(): void
    {
        $this->createTable('{{%post}}', [
            'id' => $this->primaryKey(),
            'title' => $this->string()->notNull(),
            'body' => $this->text()->notNull(),
        ]);
    }

    public function safeDown(): void
    {
        $this->dropTable('{{%post}}');
    }
}
```

`config/console.php` sets `migrationNamespaces` to `app\migrations`, and `migrate/create` uses the first namespace.
Use the schema builder (`$this->string()`), reverse operations in the matching down method, and never edit an applied
migration. `safeUp()` and `safeDown()` cannot make unsupported DDL transactional; check the target DBMS before relying
on rollback.

**Verify:** For a reversible migration, apply it, revert it and apply it again
against an explicitly disposable test database. Assert the expected schema/data
after each operation. For an irreversible migration, verify its refusal to
revert. Do not run reversal against existing user data as a generic skill check.

Guide: `db-migrations`.

## Step 6: Add a form view

Render forms with `ActiveForm`. Encode every user-controlled value that you print yourself with `Html::encode()`.

```php
<?php

declare(strict_types=1);

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/** @var app\models\Post $model */
?>
<h1><?= Html::encode($model->title) ?></h1>

<?php $form = ActiveForm::begin(); ?>
    <?= $form->field($model, 'title')->textInput(['maxlength' => true]) ?>
    <?= $form->field($model, 'body')->textarea(['rows' => 6]) ?>
    <?= Html::submitButton('Save') ?>
<?php ActiveForm::end(); ?>
```

1. Framework widgets render no CSS framework classes in 22.0. The template views use `yii\bootstrap5\ActiveForm`;
   for Bootstrap 6 use `yii2\extensions\bootstrap6\ActiveForm` (skill `yii2-bootstrap6-widgets`).
2. Client-side validation needs configured client-script strategies, supplied by `yiisoft/yii2-jquery` or a custom implementation (Step 8). Validate
   server-side explicitly before persistence; rendering a form and loading
   submitted values do not run model validation.
3. Pass data to views through `render()`; never read `$_GET` or `$_POST` in a view.

**Verify:** `php -l resources/views/post/create.php`; submit the form empty and see the messages; submit
`<script>alert(1)</script>` as a title and confirm it renders as text.

Guides: `input-forms`, `structure-views`, `security-best-practices`.

## Step 7: Configure routing and query safely

Enable pretty URLs in `urlManager`. Build URLs with `Url::to(['post/view', 'id' => $post->id])` or `Html::a()`, never
by concatenation. Constrain parameters with a regular expression (`<id:\d+>`).

```php
'urlManager' => ['enablePrettyUrl' => true, 'showScriptName' => false, 'rules' => ['post/<id:\d+>' => 'post/view']],
```

Use parameterized queries only. ActiveRecord and the query builder bind values; raw SQL needs placeholders.

```php
$rows = Yii::$app->db
    ->createCommand('SELECT id, title FROM {{%post}} WHERE id > :min', [':min' => $min])
    ->queryAll();
```

Never concatenate request data into SQL; check user-supplied column or table names against an allow-list. Use
`andFilterWhere()` for optional filters and `Yii::$app->db->transaction(function () { ... })` for multi-step writes.

**Verify:** Test routing against the application's configured rules, including
strict parsing when enabled. Verify that untrusted query values reach bound
parameters and identifiers come from an allowlist. A concatenation of trusted
SQL fragments or a parameterized string condition is not a failure by itself;
interpolated untrusted values are a failure even when a text search misses them.

Guides: `runtime-routing`, `helper-url`, `db-query-builder`, `db-dao`.

## Step 8: Account for the differences from Yii 2.0

Read `framework/CHANGELOG.md`, `framework/UPGRADE-22.md`, and applicable `framework/UPGRADE.md` sections at the resolved `yiisoft/yii2` reference before a
migration. A moving `22.0` branch may contain changes absent from the installed revision; check the areas below
against its source.

| Area      | 22.0 behavior                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------- |
| PHP       | `>=8.3`. HHVM and `PHP_VERSION_ID` fallbacks are removed.                                               |
| Autoload  | Composer only. `Yii::autoload()`, `Yii::$classMap`, and `classes.php` are removed.                      |
| jQuery    | Extracted to `yiisoft/yii2-jquery`; register `\yii\jquery\Bootstrap` in `bootstrap`.                    |
| CSS       | The framework is CSS-agnostic: widgets have no Bootstrap class defaults.                                |
| Assets    | Bower is replaced by npm: the `@npm` alias points to `node_modules`.                                    |
| Cache     | `ApcCache` is renamed `ApcuCache`; XCache and ZendDataCache are removed.                                |
| Databases | CUBRID removed. Pagination needs SQL Server 2019+, Oracle 12.1+, MariaDB 10.6+, PostgreSQL 14+.         |
| Models    | Anonymous models must define `formName()` explicitly.                                                   |
| Actions   | Standalone: `Module::$actionNamespace` and `$actionMap` dispatch `yii\web\Action` without a controller. |

Register the jQuery layer in `config/web.php`, and replace runtime class maps with `autoload.psr-4` followed by
`composer dump-autoload`:

```php
'bootstrap' => ['log', \yii\jquery\Bootstrap::class],
```

The template requires `yiisoft/yii2` `^22.0@dev`, `yiisoft/yii2-jquery` `^1.0@dev`, `yiisoft/yii2-bootstrap5`
`^22.0@dev`, and `yiisoft/yii2-symfonymailer` `^22@dev`. Copy names and constraints from its `composer.json`.

**Verify:** `composer validate`, `composer dump-autoload`, and a request through each changed area.

Guides: `concept-autoloading`, `intro-upgrade-from-v2`.

## Step 9: Apply the code standards and run the tests

1. `declare(strict_types=1);` after `<?php` in every PHP file; PER 3.0 and PSR-12 (the template configures ECS).
2. Use types compatible with inherited signatures, property contracts and
   supported PHP versions. Keep identifiers, comments and messages in English.
3. Follow the application's test setup. The template source uses Codeception 5 (suites `unit`, `functional`,
   `acceptance`, PHP built-in server).

Test the behavior changed by the task, including invalid input and access denial
when those paths are affected. Preserve the application's existing test
organization.

**Verify:** inspect `composer.json`, `composer run-script --list`, installed tools, and their configuration first.
The `--prefer-dist` template archive excludes `tests/`, `ecs.php`, `phpstan*.neon*`, and `codeception.yml`, even though
its Composer scripts name these tools. Do not assume a fresh application contains a ready-to-run test setup.

```bash
find src config -name '*.php' -print0 | xargs -0 -n1 php -l
composer validate
composer check-platform-reqs
```

Run the following scripts only when their dependencies, configuration, and suites exist in the application:

```bash
composer ecs      # ./vendor/bin/ecs --fix (rewrites files; review the diff)
composer static   # ./vendor/bin/phpstan --memory-limit=512M
composer tests    # vendor/bin/codecept run --env php-builtin --coverage-xml
```

Use the application's existing tools and conventions. When setting up new checks, obtain the relevant template
configuration from the matching source revision or configure the tools for this application. Test the behavior
changed by the task and report actual results. Identify skipped checks and their missing prerequisites explicitly.

Guides: `start-installation#development-checks`, `test-overview`, `test-unit`.

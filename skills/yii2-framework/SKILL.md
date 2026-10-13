---
name: yii2-framework
description: Use when creating or changing a Yii 22.0 app, including setup, controllers, ActiveRecord, forms, tests.
guide: https://yii2-framework.github.io/docs/llms.txt
license: BSD-3-Clause
---

# Build a Yii 22.0 Application

This skill applies to the Yii 22.0 line (`yiisoft/yii2` `^22.0@dev`, branch `22.0`), which requires PHP 8.3 and loads
classes only through Composer. The Yii 2.0 API is largely unchanged; this skill gives the conventions to follow and
the places where 22.0 differs. Guide pages live at `https://yii2-framework.github.io/docs/guide/<slug>/`; add `.md`
for the Markdown source. Fetch `https://yii2-framework.github.io/docs/llms.txt` to find pages not named here.

## Workflow

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
./yii migrate
./yii serve --docroot=public
```

Requirements: PHP `>=8.3` and Composer 2. The packages are in development (`^22.0@dev`), so keep
`--stability=dev`. Without `:^22.0` Composer may select the Yii 2.0 template, as the guide page does. To add the
framework to an existing project, run `composer require yiisoft/yii2:^22.0@dev`.

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

Every controller declares `AccessControl` and `VerbFilter` in `behaviors()`, as `UserController` of the template does.
(`SiteController` declares neither; do not copy that.) List every action under `only` and allow roles explicitly
(`?` guest, `@` authenticated, or an RBAC role).

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

Define `tableName()`, `rules()`, and `attributeLabels()` in every ActiveRecord class. The template `User` model has
the first two but no `attributeLabels()`; add it.

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

`load()` assigns only attributes that appear in `rules()`: list the fields a user may submit, and no others. Use
`{{%name}}` so the table prefix applies. `save()` validates and returns `false` on failure. Core validators include
`required`, `string`, `integer`, `email`, `unique`, `exist`, `in`, and `date`.

**Verify:** `php -l src/models/Post.php`; a test saves an invalid model and asserts `false` and the error key.

Guides: `db-active-record`, `input-validation`, `tutorial-core-validators`, `structure-models`.

## Step 5: Add a migration

Implement `safeUp()` and `safeDown()`, never `up()` and `down()`.

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
Use the schema builder (`$this->string()`), give every `safeUp()` a reversing `safeDown()`, and never edit an applied
migration.

**Verify:** `./yii migrate --interactive=0`, then `./yii migrate/down 1 --interactive=0`, then `./yii migrate`. All
three succeed.

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
2. Client-side validation needs `yiisoft/yii2-jquery` (Step 8). Server-side validation always runs.
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

**Verify:** request the pretty URL and the default `controller/action` route; both reach the action. Search the diff
for `createCommand(` with a concatenated string and for `->where("`; both find nothing.

Guides: `runtime-routing`, `helper-url`, `db-query-builder`, `db-dao`.

## Step 8: Account for the differences from Yii 2.0

Only changes listed in the `22.0 under development` section of
`https://raw.githubusercontent.com/yiisoft/yii2/22.0/framework/CHANGELOG.md` are included. The upstream
`UPGRADE.md` has no 22.0 section yet, so read that changelog before a migration; more changes may land.

| Area      | 22.0 behavior                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------- |
| PHP       | `>=8.3`. HHVM and `PHP_VERSION_ID` fallbacks are removed.                                               |
| Autoload  | Composer only. `Yii::autoload()`, `Yii::$classMap`, and `classes.php` are removed.                      |
| jQuery    | Extracted to `yiisoft/yii2-jquery`; register `\yii\jquery\Bootstrap` in `bootstrap`.                    |
| CSS       | The framework is CSS-agnostic: widgets have no Bootstrap class defaults.                                |
| Assets    | Bower is replaced by npm: the `@npm` alias points to `node_modules`.                                    |
| Cache     | `ApcCache` is renamed `ApcuCache`; XCache and ZendDataCache are removed.                                |
| Databases | CUBRID removed. Pagination needs SQL Server 2019+, Oracle 12.1+, MariaDB 10.6+, PostgreSQL 13+.         |
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

Guides: `concept-autoloading`, `intro-upgrade-from-v1`.

## Step 9: Apply the code standards and run the tests

1. `declare(strict_types=1);` after `<?php` in every PHP file; PER 3.0 and PSR-12 (the template configures ECS).
2. Typed properties, parameters, return types; English identifiers, comments, messages.
3. The template tests with Codeception 5 (suites `unit`, `functional`, `acceptance`, PHP built-in server).

Write one test per rule: an invalid save, an access denial, and a successful save.

**Verify** with the scripts of the template `composer.json`, in this order:

```bash
find src config -name '*.php' -print0 | xargs -0 -n1 php -l
composer ecs      # ./vendor/bin/ecs --fix (rewrites files)
composer static   # ./vendor/bin/phpstan --memory-limit=512M (level max)
composer tests    # vendor/bin/codecept run --env php-builtin --coverage-xml
```

All four succeed.

Guides: `test-overview`, `test-unit`.

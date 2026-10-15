<?php

declare(strict_types=1);

/**
 * Runs one semantic probe against the prepared evaluation application.
 *
 * Usage: php probe.php <app-dir> <probe> <argument> [<html-output-file>]
 *
 * Probes:
 * - `render <view>`: renders a view file (relative to the app) with a web application; when `app\models\Post` exists,
 *   `$model` is a `Post` whose `title` is an XSS payload. Writes the HTML to the output file and the HTML of the
 *   registered scripts to a sibling `.js.txt` file.
 * - `toast-shown <view>`: the rendered `.toast` has a stable id, and `show()` runs on it inside a module `import()`
 *   block of the registered scripts.
 * - `toast-visible <view>`: like `toast-shown`, but a module-initialized `.toast` rendered with the `show` class also
 *   passes.
 * - `controller-filters <class>`: the controller declares `AccessControl` and `VerbFilter`, `delete` accepts only
 *   POST, and a rule restricts `delete` to authenticated users.
 * - `rest-no-ratelimit <class>`: the class extends `yii\rest\ActiveController`, no behavior resolves to
 *   `RateLimiter`, and every other default behavior of `ActiveController` is kept.
 * - `active-record <class>`: the class declares `tableName()`, `rules()`, and `attributeLabels()` itself, and an
 *   empty instance fails validation.
 * - `active-record-persistence <class>`: an empty instance fails validation, while valid title and body values save
 *   to the configured database and can be reloaded by primary key.
 * - `filepond-widget <view>`: a single avatar input registers image editing, square crop, client transform and
 *   explicit JPEG/PNG/WebP and 2 MB restrictions in its effective JavaScript options.
 * - `filepond-upload <class>`: model validation rejects forged MIME, extension, size, malformed and multiple
 *   payloads before storage, while the package decoder/saver stores PNG bytes with a content-derived extension.
 *
 * Prints one line with the outcome. Exit code 0 means pass, 1 means fail, 2 means usage error.
 */

const XSS_PAYLOAD = '<script>alert(1)</script>';

if ($argc < 4) {
    fwrite(STDERR, "Usage: php probe.php <app-dir> <probe> <argument> [<html-output-file>]\n");
    exit(2);
}

[$script, $appDir, $probe, $argument] = $argv;
$htmlFile = $argv[4] ?? null;
$appDir = rtrim((string) realpath($appDir), '/');

defined('YII_DEBUG') || define('YII_DEBUG', true);
defined('YII_ENV') || define('YII_ENV', 'test');

$_SERVER['SCRIPT_FILENAME'] = $appDir . '/public/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['SERVER_NAME'] = 'localhost';
$_SERVER['SERVER_PORT'] = '80';
$_SERVER['REQUEST_METHOD'] = 'GET';

require $appDir . '/vendor/autoload.php';

/**
 * Prints the outcome and exits with 0 (pass) or 1 (fail).
 */
function finish(bool $pass, string $message): never
{
    echo ($pass ? 'pass: ' : 'fail: ') . $message . "\n";
    exit($pass ? 0 : 1);
}

/**
 * Renders a view file relative to the app and returns its HTML and the head and body HTML produced by the view's
 * registered scripts and files.
 *
 * When `app\models\Post` exists, `$model` is a `Post` whose `title` is an XSS payload.
 *
 * @return array{0: string, 1: string}
 */
function renderView(yii\web\Application $app, string $appDir, string $relative): array
{
    $file = $appDir . '/' . ltrim($relative, '/');

    if (!is_file($file)) {
        finish(false, "view {$relative} does not exist");
    }

    $params = [];

    if (class_exists('app\models\Post')) {
        $post = new app\models\Post();

        if ($post instanceof yii\db\ActiveRecord) {
            $post->setAttribute('id', 1);
        }

        $post->title = XSS_PAYLOAD;
        $params['model'] = $post;
    }

    $view = $app->controller->getView();
    $html = $view->renderFile($file, $params, $app->controller);

    ob_start();
    $view->beginPage();
    $view->head();
    $view->beginBody();
    $view->endBody();
    $view->endPage();
    $scripts = (string) ob_get_clean();

    return [$html, $scripts];
}

/**
 * Resolves the class name of a behavior configuration (object, class string, or array with `class`).
 */
function behaviorClass(mixed $behavior): string|null
{
    return match (true) {
        is_object($behavior) => $behavior::class,
        is_string($behavior) => ltrim($behavior, '\\'),
        is_array($behavior) && isset($behavior['class']) && is_string($behavior['class'])
            => ltrim($behavior['class'], '\\'),
        default => null,
    };
}

/**
 * Returns the value of a behavior property from an object or an array configuration.
 */
function behaviorProperty(mixed $behavior, string $name): mixed
{
    return is_object($behavior) ? ($behavior->$name ?? null) : ($behavior[$name] ?? null);
}

try {
    $config = require $appDir . '/config/web.php';
    $app = new yii\web\Application($config);
    $app->controller = new yii\web\Controller('site', $app);
    $app->controller->action = new yii\base\InlineAction('index', $app->controller, 'actionIndex');
    $app->requestedRoute = 'site/index';

    switch ($probe) {
        case 'filepond-widget':
            [$html, $scripts] = renderView($app, $appDir, $argument);

            if (preg_match('/<input\b[^>]*\bname="avatar"[^>]*>/', $html, $input) !== 1
                || !str_contains($input[0], 'type="file"') || str_contains($input[0], 'multiple')) {
                finish(false, 'expected one file input named avatar');
            }

            if (!str_contains($scripts, 'yii2FilePond.create(')) {
                finish(false, 'widget did not register its FilePond initializer');
            }

            if (preg_match('/"acceptedFileTypes"\s*:\s*(\[[^\]]*\])/', $scripts, $types) !== 1) {
                finish(false, 'effective acceptedFileTypes is missing');
            }

            $accepted = json_decode($types[1], true, flags: JSON_THROW_ON_ERROR);
            sort($accepted);

            if ($accepted !== ['image/jpeg', 'image/png', 'image/webp']) {
                finish(false, 'effective MIME allow-list differs from JPEG/PNG/WebP');
            }

            foreach (['allowImageEdit', 'allowImageTransform', 'imageEditInstantEdit'] as $option) {
                if (preg_match('/"' . $option . '"\s*:\s*true\b/', $scripts) !== 1) {
                    finish(false, "effective {$option} is not true");
                }
            }

            $square = static function (mixed $value): bool {
                if (is_int($value) || is_float($value)) {
                    return $value === 1 || $value === 1.0;
                }

                if (is_string($value) && preg_match('/^([0-9.]+):([0-9.]+)$/', $value, $ratio) === 1) {
                    return (float) $ratio[1] > 0 && (float) $ratio[1] === (float) $ratio[2];
                }

                return false;
            };
            $initialSquare = false;

            foreach (['imageCropAspectRatio', 'aspectRatio'] as $option) {
                if (preg_match('/"' . $option . '"\s*:\s*("[^"]*"|[0-9.]+)/', $scripts, $match) === 1
                    && $square(json_decode($match[1], true, flags: JSON_THROW_ON_ERROR))) {
                    $initialSquare = true;
                }
            }

            if (!$initialSquare || preg_match('/"maxFileSize"\s*:\s*("(?:2MB|2000KB|2000000)"|2000000)\s*[,}]/i', $scripts) !== 1) {
                finish(false, 'effective square crop or 2MB limit is missing');
            }

            $presets = preg_match('/"aspectRatios"\s*:\s*(\[[^\]]*\])/', $scripts, $ratios) === 1
                ? json_decode($ratios[1], true, flags: JSON_THROW_ON_ERROR) : [];

            if (!is_array($presets) || $presets === [] || count(array_filter($presets, $square)) !== count($presets)) {
                finish(false, 'editor must offer only the square crop preset');
            }

            finish(true, 'avatar input registers the MIME allow-list, 2MB limit, immediate editor and client crop');

        case 'filepond-upload':
            $class = ltrim($argument, '\\');

            if (!is_subclass_of($class, yii\base\Model::class) || !method_exists($class, 'saveAvatar')) {
                throw new RuntimeException('expected a Yii model with saveAvatar()');
            }

            $png = base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                true,
            );
            $payload = static fn(string $bytes, string $name = 'avatar.png', string $type = 'image/png'): string
                => json_encode(['name' => $name, 'type' => $type, 'data' => base64_encode($bytes)], JSON_THROW_ON_ERROR);
            $directory = $appDir . '/runtime/filepond-probe-' . bin2hex(random_bytes(6));
            mkdir($directory);

            try {
                $model = new $class();
                $validators = iterator_to_array($model->getValidators());
                $encodedValidators = array_filter(
                    $validators,
                    static fn($validator): bool => $validator instanceof yii2\extensions\filepond\validator\EncodedFileValidator
                        && in_array('avatar', $validator->attributes, true),
                );

                if ($encodedValidators === []) {
                    throw new RuntimeException('avatar has no package EncodedFileValidator');
                }

                $rejected = [
                    'empty' => null,
                    'malformed JSON' => '{broken',
                    'malformed base64' => json_encode(['name' => 'avatar.png', 'type' => 'image/png', 'data' => '%%%']),
                    'forged HTML MIME' => $payload('<!doctype html><script>alert(1)</script>'),
                    'SVG renamed PNG' => $payload('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
                    'wrong extension' => $payload($png, 'avatar.php'),
                    'excess size' => $payload($png . str_repeat('x', 2_000_001 - strlen($png))),
                    'multiple files' => [$payload($png), $payload($png)],
                ];

                foreach ($rejected as $label => $value) {
                    $invalid = new $class(['avatar' => $value]);

                    if ($invalid->validate() || !$invalid->hasErrors('avatar')) {
                        throw new RuntimeException("validation accepted {$label}");
                    }

                    // The directory is empty for every invalid case; no storage operation should leave a file.
                    if ($invalid->saveAvatar($directory) !== null || glob($directory . '/*') !== []) {
                        throw new RuntimeException("invalid {$label} was stored or did not return null");
                    }
                }

                $atLimit = new $class(['avatar' => $payload($png . str_repeat('x', 2_000_000 - strlen($png)))]);

                if (!$atLimit->validate()) {
                    throw new RuntimeException('valid PNG payload at the exact 2,000,000-byte limit was rejected');
                }

                $valid = new $class(['avatar' => $payload($png, 'avatar.webp', 'text/html')]);

                if (!$valid->validate()) {
                    throw new RuntimeException('PNG bytes rejected because of client MIME or an allowed mismatched extension');
                }

                $saved = $valid->saveAvatar($directory);

                if (!is_string($saved) || $saved !== $directory . '/avatar.png' || !is_file($saved)
                    || file_get_contents($saved) !== $png) {
                    throw new RuntimeException('saved content/path does not follow decoded PNG bytes');
                }

                $decoded = yii2\extensions\filepond\file\EncodedFile::fromInput($valid->avatar)[0];

                if ($decoded->type !== 'text/html' || $decoded->getMimeType() !== 'image/png'
                    || $decoded->getData() !== $png) {
                    throw new RuntimeException('decoder must distinguish client-reported MIME from byte-derived MIME');
                }

            } finally {
                foreach (glob($directory . '/*') ?: [] as $file) {
                    unlink($file);
                }

                rmdir($directory);
            }

            finish(true, 'invalid payloads leave no files; validated PNG bytes save as avatar.png despite forged client MIME');

        case 'render':
            [$html, $scripts] = renderView($app, $appDir, $argument);

            if ($htmlFile !== null) {
                $scriptsFile = str_ends_with($htmlFile, '.html')
                    ? substr($htmlFile, 0, -5) . '.js.txt'
                    : $htmlFile . '.js.txt';
                file_put_contents($htmlFile, $html);
                file_put_contents($scriptsFile, $scripts);
            }

            finish(true, sprintf('rendered %s (%d bytes)', $argument, strlen($html)));

        case 'toast-shown':
        case 'toast-visible':
            [$html, $scripts] = renderView($app, $appDir, $argument);

            if (preg_match('/<div\b[^>]*\bclass="[^"]*\btoast\b[^"]*"[^>]*>/', $html, $tag) !== 1) {
                finish(false, 'no rendered .toast element');
            }

            if (preg_match('/\bid="([^"]+)"/', $tag[0], $id) !== 1) {
                finish(false, 'the .toast element has no id');
            }

            if (preg_match('/^w\d+$/', $id[1]) === 1) {
                finish(false, "the .toast id {$id[1]} is auto-generated, not stable");
            }

            $initialized = false;
            $shown = false;

            if (preg_match_all('/import\("[^"]+"\)\.then\(\(bootstrap\) => \{([^}]*)\}\);/', $scripts, $blocks) > 0) {
                foreach ($blocks[1] as $block) {
                    if (str_contains($block, $id[1]) && str_contains($block, 'bootstrap.Toast.getOrCreateInstance')) {
                        $initialized = true;

                        if (preg_match('/\.show\(\s*\)/', $block) === 1) {
                            $shown = true;
                            break;
                        }
                    }
                }
            }

            if ($shown) {
                finish(true, "#{$id[1]} is shown by show() inside a module import block");
            }

            if ($probe === 'toast-visible' && preg_match('/\bclass="[^"]*\bshow\b[^"]*"/', $tag[0]) === 1) {
                finish(
                    $initialized,
                    $initialized
                        ? "#{$id[1]} is module-initialized and rendered with the show class"
                        : "#{$id[1]} has the show class but no module import initializes its Toast instance",
                );
            }

            finish(false, "no module import block calls show() on #{$id[1]}");

        case 'controller-filters':
            $class = ltrim($argument, '\\');

            if (!class_exists($class)) {
                finish(false, "class {$class} not found");
            }

            $controller = new $class('post', $app);
            $behaviors = $controller->behaviors();
            $access = null;
            $verbs = null;

            foreach ($behaviors as $behavior) {
                $behaviorClass = behaviorClass($behavior);

                if ($behaviorClass !== null && is_a($behaviorClass, yii\filters\AccessControl::class, true)) {
                    $access = $behavior;
                }

                if ($behaviorClass !== null && is_a($behaviorClass, yii\filters\VerbFilter::class, true)) {
                    $verbs = $behavior;
                }
            }

            if ($access === null || $verbs === null) {
                finish(false, 'AccessControl or VerbFilter missing from behaviors()');
            }

            $deleteVerbs = array_map('strtolower', (array) (behaviorProperty($verbs, 'actions')['delete'] ?? []));

            if ($deleteVerbs !== ['post']) {
                finish(false, 'VerbFilter does not restrict delete to POST: ' . json_encode($deleteVerbs));
            }

            $authenticatedDelete = false;

            foreach ((array) behaviorProperty($access, 'rules') as $rule) {
                $actions = (array) behaviorProperty($rule, 'actions');
                $roles = (array) behaviorProperty($rule, 'roles');

                if (behaviorProperty($rule, 'allow') === true && in_array('delete', $actions, true)
                    && in_array('@', $roles, true)) {
                    $authenticatedDelete = true;
                }
            }

            finish($authenticatedDelete, $authenticatedDelete
                ? 'filters declared, delete is POST-only and limited to authenticated users'
                : 'no allow rule grants delete to role @');

        case 'rest-no-ratelimit':
            $class = ltrim($argument, '\\');

            if (!class_exists($class)) {
                finish(false, "class {$class} not found");
            }

            if (!is_subclass_of($class, yii\rest\ActiveController::class)) {
                finish(false, "{$class} does not extend yii\\rest\\ActiveController");
            }

            $controller = new $class('post', $app);
            $behaviors = $controller->behaviors();

            foreach ($behaviors as $name => $behavior) {
                $behaviorClass = behaviorClass($behavior);

                if ($behaviorClass !== null && is_a($behaviorClass, yii\filters\RateLimiter::class, true)) {
                    finish(false, "behavior '{$name}' is still a RateLimiter");
                }
            }

            $defaults = new yii\rest\ActiveController('post', $app, ['modelClass' => $controller->modelClass]);
            $missing = array_diff(array_keys($defaults->behaviors()), array_keys($behaviors), ['rateLimiter']);

            if ($missing !== []) {
                finish(false, 'default behaviors removed: ' . implode(', ', $missing));
            }

            finish(true, 'no RateLimiter behavior remains; other default behaviors kept');

        case 'active-record':
            $class = ltrim($argument, '\\');

            if (!class_exists($class)) {
                finish(false, "class {$class} not found");
            }

            if (!is_subclass_of($class, yii\db\ActiveRecord::class)) {
                finish(false, "{$class} does not extend yii\\db\\ActiveRecord");
            }

            foreach (['tableName', 'rules', 'attributeLabels'] as $method) {
                if ((new ReflectionMethod($class, $method))->getDeclaringClass()->getName() !== $class) {
                    finish(false, "{$method}() is not declared by {$class}");
                }
            }

            $model = new $class();

            if ($model->validate()) {
                finish(false, 'an empty model passes validation');
            }

            finish(true, 'declares tableName(), rules(), attributeLabels(); empty model fails on '
                . implode(', ', array_keys($model->getErrors())));

        case 'active-record-persistence':
            $class = ltrim($argument, '\\');

            if (!class_exists($class)) {
                finish(false, "class {$class} not found");
            }

            if (!is_subclass_of($class, yii\db\ActiveRecord::class)) {
                finish(false, "{$class} does not extend yii\\db\\ActiveRecord");
            }

            $invalid = new $class();

            if ($invalid->validate()) {
                finish(false, 'an empty model passes validation');
            }

            foreach (['title', 'body'] as $attribute) {
                if (!$invalid->hasErrors($attribute)) {
                    finish(false, "an empty model has no validation error for {$attribute}");
                }
            }

            $model = new $class();
            $model->title = 'Deterministic application flow';
            $model->body = 'Validated, persisted, and reloaded from SQLite.';

            if (!$model->save()) {
                finish(false, 'valid model did not save: ' . json_encode($model->getErrors()));
            }

            $primaryKey = $model->getPrimaryKey();

            if ($primaryKey === null) {
                finish(false, 'saved model has no primary key');
            }

            $stored = $class::findOne($primaryKey);

            if (!($stored instanceof $class)) {
                finish(false, 'saved model could not be reloaded by primary key');
            }

            if ($stored->title !== $model->title || $stored->body !== $model->body) {
                finish(false, 'reloaded title or body differs from the saved values');
            }

            finish(true, "empty input fails; valid model saves and reloads with primary key {$primaryKey}");

        default:
            fwrite(STDERR, "Unknown probe: {$probe}\n");
            exit(2);
    }
} catch (Throwable $e) {
    finish(false, sprintf('%s: %s at %s:%d', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
}

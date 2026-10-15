<?php

declare(strict_types=1);

// Standalone runtime probe for task 12; no network, application installation, or model invocation.
$options = getopt('', ['package:', 'files:', 'runtime:']);
$package = realpath($options['package'] ?? '');
$files = realpath($options['files'] ?? '');
$runtime = realpath($options['runtime'] ?? '');

if (!$package || !$files || !$runtime || !is_file($package . '/vendor/autoload.php')) {
    fwrite(STDERR, "Usage: php eval/lib/psr-worker.php --package <installed-package> --files <outputs> --runtime <empty-temp-dir>\n");
    exit(2);
}

defined('YII_DEBUG') || define('YII_DEBUG', false);
defined('YII_ENV') || define('YII_ENV', 'test');
require $package . '/vendor/autoload.php';
require $package . '/vendor/yiisoft/yii2/Yii.php';
require $files . '/src/Worker.php';

use HttpSoft\Message\{ResponseFactory, ServerRequestFactory, StreamFactory, UploadedFileFactory};
use Psr\Http\Message\{ResponseFactoryInterface, ResponseInterface, StreamFactoryInterface};
use yii\base\Event;
use yii\helpers\ArrayHelper;
use yii2\extensions\psrbridge\http\{Application, Response, UploadedFile};

final class PsrWorkerProbeApplication extends Application
{
    public array $outcomes = [];
    public int $afterSend = 0;
    public bool $throwAfterSend = false;

    public function finalize(bool $success = true): void
    {
        $this->outcomes[] = $success;
        parent::finalize($success);
    }

    public function handleRequest($request): Response
    {
        $session = $this->getSession();

        if ($request->get('op') === 'set') {
            $session->set('private-value', $request->get('value'));
        }

        $this->response->format = Response::FORMAT_JSON;
        $this->response->data = [
            'value' => $session->get('private-value'),
            'id' => $session->getId(),
            'upload' => UploadedFile::getInstanceByName('avatar')?->name,
        ];
        $this->response->on(Response::EVENT_AFTER_SEND, function (): void {
            ++$this->afterSend;

            if ($this->throwAfterSend) {
                throw new RuntimeException('after-send-sentinel');
            }
        });

        return $this->response;
    }
}

$checks = [];
$verify = static function (bool $condition, string $label) use (&$checks): void {
    $checks[] = ['check' => $label, 'passed' => $condition];

    if (!$condition) {
        throw new RuntimeException('Failed: ' . $label);
    }
};

try {
    $factory = require $files . '/config/bridge.php';
    $verify(is_callable($factory), 'configuration factory');
    $key = 'fixture-key-for-isolated-local-evaluation';
    $fragment = $factory($key);
    $verify(is_array($fragment), 'configuration fragment');
    $config = ArrayHelper::merge([
        'id' => 'psr-worker-evaluation',
        'basePath' => $runtime,
        'runtimePath' => $runtime,
        'container' => ['definitions' => [
            ResponseFactoryInterface::class => ResponseFactory::class,
            StreamFactoryInterface::class => StreamFactory::class,
        ]],
        'components' => [
            'request' => ['scriptFile' => $runtime . '/index.php', 'scriptUrl' => '/index.php'],
            'session' => ['savePath' => $runtime, 'name' => 'PSRBRIDGEEVAL'],
            'log' => ['targets' => []],
        ],
    ], $fragment);
    // Deliberately contradict the old upload flag; merged source must still reset upload state.
    $config['resetUploadedFiles'] = false;
    $app = new PsrWorkerProbeApplication($config);
    $worker = new \app\Worker($app);
    $requestFactory = new ServerRequestFactory();
    $cookies = [];
    $bodies = [];
    $emit = static function (ResponseInterface $response) use ($app, &$cookies, &$bodies, $verify): void {
        $verify($response->getStatusCode() === 200, 'HTTP response');
        $verify(!$app->response->isSent, 'response remains unsent during emission');
        $verify($response->getBody()->isReadable(), 'body readable during emission');
        $bodies[] = json_decode((string) $response->getBody(), true, flags: JSON_THROW_ON_ERROR);
        $cookies = [];

        foreach ($response->getHeader('Set-Cookie') as $header) {
            [$name, $value] = explode('=', explode(';', $header, 2)[0], 2);
            $cookies[urldecode($name)] = urldecode($value);
        }
    };
    $request = static function (array $params = [], array $incoming = []) use ($requestFactory) {
        return $requestFactory->createServerRequest('GET', 'https://example.test/probe')
            ->withQueryParams($params)->withCookieParams($incoming);
    };
    $worker->serve($request(['op' => 'set', 'value' => 'visitor-a']), $emit);
    $a = $cookies;
    $idA = $bodies[0]['id'];
    $verify($app->outcomes === [true] && $app->afterSend === 1, 'success finalizes exactly once after emission');
    $verify(!$app->useSession, 'lazy session mode retained');
    $verify($app->persistentComponents === ['db', 'cache'], 'only db and cache persist');
    $verify($app->request->enableCookieValidation && $app->request->cookieValidationKey === $key,
        'incoming cookie validation configured');
    $verify($app->syncCookieValidation && $app->response->enableCookieValidation && $app->response->cookieValidationKey === $key,
        'outgoing cookie validation synchronized');
    $verify($app->session->getUseCookies() === false && $app->session->getUseStrictMode(), 'session transport and strict mode');
    $verify(isset($a['PSRBRIDGEEVAL']) && $a['PSRBRIDGEEVAL'] !== $idA, 'session cookie signed');
    $worker->serve($request(['op' => 'set', 'value' => 'visitor-b']), $emit);
    $b = $cookies;
    $verify($bodies[1]['id'] !== $idA, 'new visitor gets distinct session');
    $worker->serve($request([], $a), $emit);
    $verify($bodies[2]['value'] === 'visitor-a' && $bodies[2]['id'] === $idA, 'visitor a resumes only own data');
    $worker->serve($request([], $b), $emit);
    $verify($bodies[3]['value'] === 'visitor-b', 'visitor b resumes only own data');
    $worker->serve($request(), $emit);
    $verify($bodies[4]['value'] === null, 'missing cookie does not resume prior visitor');
    $sign = static fn(mixed $value): string => $app->security->hashData(serialize(['PSRBRIDGEEVAL', $value]), $key);
    foreach (['bad/id', [], str_repeat('a', 257), ''] as $invalid) {
        $worker->serve($request([], ['PSRBRIDGEEVAL' => $sign($invalid)]), $emit);
        $verify($bodies[array_key_last($bodies)]['value'] === null, 'malformed signed cookie isolated');
    }
    $worker->serve($request([], ['PSRBRIDGEEVAL' => 'tampered']), $emit);
    $verify($bodies[array_key_last($bodies)]['value'] === null, 'tampered cookie isolated');
    $worker->serve($request([], ['PSRBRIDGEEVAL' => $sign('unknown-well-formed-id')]), $emit);
    $verify($bodies[array_key_last($bodies)]['id'] !== 'unknown-well-formed-id', 'strict mode replaces unknown valid id');
    $upload = (new UploadedFileFactory())->createUploadedFile(
        (new StreamFactory())->createStream('upload-fixture'), 14, UPLOAD_ERR_OK, 'avatar.txt', 'text/plain',
    );
    $worker->serve($request()->withUploadedFiles(['avatar' => $upload]), $emit);
    $verify($bodies[array_key_last($bodies)]['upload'] === 'avatar.txt', 'current PSR upload available');
    $worker->serve($request(), $emit);
    $verify($bodies[array_key_last($bodies)]['upload'] === null, 'upload reset despite compatibility flag being false');
    $before = count($app->outcomes);
    $afterSend = $app->afterSend;

    try {
        $worker->serve($request(), static function (): void { throw new RuntimeException('emission-sentinel'); });
        $verify(false, 'emission exception propagated');
    } catch (RuntimeException $exception) {
        $verify($exception->getMessage() === 'emission-sentinel', 'emission exception propagated');
    }

    $verify(count($app->outcomes) === $before + 1 && end($app->outcomes) === false && $app->afterSend === $afterSend,
        'failed emission finalizes once without after-send');
    $app->throwAfterSend = true;
    $before = count($app->outcomes);

    try {
        $worker->serve($request(), $emit);
        $verify(false, 'after-send exception propagated');
    } catch (RuntimeException $exception) {
        $verify($exception->getMessage() === 'after-send-sentinel', 'after-send exception propagated');
    }

    $verify(count($app->outcomes) === $before + 1 && end($app->outcomes) === true, 'finalization exception never retries finalize');
    echo json_encode(['passed' => true, 'checks' => $checks], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode(['passed' => false, 'error' => $exception->getMessage(), 'checks' => $checks],
        JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n");
    exit(1);
} finally {
    if (isset($app) && $app->has('session', true)) {
        $app->session->close();
    }

    Event::offAll();
}

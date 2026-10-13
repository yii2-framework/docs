<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use yii\web\Application;

/**
 * Creates the minimal Yii web application the snippets run in: request URLs as on `/index.php`, no CSRF input, and
 * an asset manager that publishes into the demo assets directory under stable names.
 */
final class DemoApplication
{
    /**
     * Creates the application and makes it `Yii::$app`.
     *
     * @param string $id Application id.
     * @param string $basePath Existing directory used as the application base path (runtime files go below it).
     * @param string $vendorPath Composer vendor directory of the application.
     * @param string $npmPath `node_modules` directory for the `@npm` alias.
     * @param string $assetsDir Directory the asset manager publishes into.
     * @param string $assetsUrl URL of `$assetsDir` on the site (`/docs/demos/assets`).
     * @param AssetHasher $hasher Names of the published directories.
     * @param list<string> $bootstrap Bootstrap classes of the package (`extra.bootstrap` of its `composer.json`).
     */
    public static function create(
        string $id,
        string $basePath,
        string $vendorPath,
        string $npmPath,
        string $assetsDir,
        string $assetsUrl,
        AssetHasher $hasher,
        array $bootstrap = [],
    ): Application {
        return new Application(
            [
                'id' => $id,
                'basePath' => $basePath,
                'vendorPath' => $vendorPath,
                'runtimePath' => $basePath . '/runtime',
                'language' => 'en-US',
                'aliases' => ['@npm' => $npmPath, '@bower' => $npmPath],
                'bootstrap' => $bootstrap,
                'components' => [
                    'assetManager' => [
                        'basePath' => $assetsDir,
                        'baseUrl' => $assetsUrl,
                        'hashCallback' => $hasher,
                        'appendTimestamp' => false,
                    ],
                    'request' => [
                        'cookieValidationKey' => 'docs-demos',
                        'enableCsrfValidation' => false,
                        'hostInfo' => 'http://localhost',
                        'scriptUrl' => '/index.php',
                    ],
                ],
            ],
        );
    }
}

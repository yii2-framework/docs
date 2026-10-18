<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use JsonException;
use RuntimeException;
use Yii2Docs\Tools\Source\Package;

use function array_slice;
use function array_values;
use function explode;
use function file_get_contents;
use function file_put_contents;
use function hash;
use function implode;
use function is_array;
use function is_dir;
use function is_file;
use function is_resource;
use function is_string;
use function json_decode;
use function json_encode;
use function ksort;
use function mkdir;
use function preg_match;
use function proc_close;
use function proc_open;
use function stream_get_contents;
use function trim;

use const JSON_PRETTY_PRINT;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;

/**
 * Generates and installs the Composer project a package's demos run in (`.cache/demos/<package>/`): the base of
 * `tools/demos/composer.json`, the framework and the package as `path` repositories from their synced checkouts, and
 * no Composer plugins (the npm assets come from the `node_modules` of the documentation site).
 */
final class ProjectInstaller
{
    /**
     * @param string $baseFile `tools/demos/composer.json`.
     * @param string $composer Composer executable.
     */
    public function __construct(private readonly string $baseFile, private readonly string $composer = 'composer')
    {
    }

    /**
     * Writes `<projectDir>/composer.json` and runs `composer update` when it changed or `vendor/` is missing.
     *
     * The generated file records a digest of the package and framework `composer.json` files, so a changed
     * requirement triggers an update.
     *
     * @return array{vendor: string, bootstrap: list<string>, updated: bool}
     *
     * @throws RuntimeException When a manifest is invalid or Composer fails.
     */
    public function install(Package $package, Package $framework, string $projectDir): array
    {
        $base = self::readJson($this->baseFile);
        $packageRoot = $package->checkoutDir;
        $packageManifest = self::readJson($packageRoot . '/composer.json');
        $frameworkManifest = self::readJson($framework->sourceDir . '/composer.json');
        $packageName = self::name($packageManifest, $packageRoot);
        $frameworkName = self::name($frameworkManifest, $framework->sourceDir);
        $packageVersion = self::version($package->ref);
        $frameworkVersion = self::version($framework->ref);
        $require = is_array($base['require'] ?? null) ? $base['require'] : [];
        $require[$frameworkName] = $frameworkVersion;
        $require[$packageName] = $packageVersion;
        ksort($require);

        $project = $base;
        $project['name'] = 'yii2-framework/docs-demos-' . $package->name;
        $project['require'] = $require;
        $project['repositories'] = [
            self::pathRepository($framework->sourceDir, $frameworkName, $frameworkVersion),
            self::pathRepository($packageRoot, $packageName, $packageVersion),
        ];
        $project['extra']['docs-demos'] = [
            'digest' => hash(
                'sha256',
                (string) file_get_contents($packageRoot . '/composer.json')
                    . (string) file_get_contents($framework->sourceDir . '/composer.json'),
            ),
        ];

        $json = json_encode($project, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        $file = $projectDir . '/composer.json';
        $vendor = $projectDir . '/vendor';
        $changed = !is_file($file) || file_get_contents($file) !== $json;

        if (!is_dir($projectDir) && !mkdir($projectDir, 0o775, true) && !is_dir($projectDir)) {
            throw new RuntimeException("Cannot create $projectDir.");
        }

        if ($changed && file_put_contents($file, $json) === false) {
            throw new RuntimeException("Cannot write $file.");
        }

        $updated = false;

        if ($changed || !is_file($vendor . '/autoload.php')) {
            $this->composer($projectDir);
            $updated = true;
        }

        $bootstrap = $packageManifest['extra']['bootstrap'] ?? [];

        return [
            'vendor' => $vendor,
            'bootstrap' => is_string($bootstrap)
                ? [$bootstrap]
                : (is_array($bootstrap) ? array_values($bootstrap) : []),
            'updated' => $updated,
        ];
    }

    /**
     * Returns the Composer version of a branch or tag: `22.0` -> `22.0.x-dev`, `main` -> `dev-main`, `v1.2.0` and
     * `1.2.0` unchanged.
     */
    public static function version(string $ref): string
    {
        if (preg_match('/^v?\d+\.\d+\.\d+/', $ref) === 1) {
            return $ref;
        }

        return preg_match('/^\d+(\.\d+)*$/', $ref) === 1 ? $ref . '.x-dev' : 'dev-' . $ref;
    }

    /**
     * Runs `composer update` in the project directory.
     *
     * @throws RuntimeException When Composer cannot start or fails.
     */
    private function composer(string $projectDir): void
    {
        $command = [
            $this->composer,
            'update',
            '--no-interaction',
            '--no-progress',
            '--prefer-dist',
            '--no-dev',
            '--working-dir=' . $projectDir,
        ];
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);

        if (!is_resource($process)) {
            throw new RuntimeException("Cannot run {$this->composer}.");
        }

        $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
        $code = proc_close($process);

        if ($code !== 0) {
            $tail = implode("\n", array_slice(explode("\n", trim((string) $output)), -20));

            throw new RuntimeException("composer update failed in $projectDir (exit $code):\n$tail");
        }
    }

    /**
     * @return array{type: string, url: string, options: array{symlink: bool, versions: array<string, string>}}
     */
    private static function pathRepository(string $dir, string $name, string $version): array
    {
        return ['type' => 'path', 'url' => $dir, 'options' => ['symlink' => true, 'versions' => [$name => $version]]];
    }

    /**
     * @param array<array-key, mixed> $manifest
     *
     * @throws RuntimeException When the manifest has no name.
     */
    private static function name(array $manifest, string $dir): string
    {
        $name = $manifest['name'] ?? null;

        if (!is_string($name) || $name === '') {
            throw new RuntimeException("$dir/composer.json has no \"name\".");
        }

        return $name;
    }

    /**
     * @return array<array-key, mixed>
     *
     * @throws RuntimeException When the file is missing or not a JSON object.
     */
    private static function readJson(string $file): array
    {
        if (!is_file($file)) {
            throw new RuntimeException("$file not found.");
        }

        try {
            $data = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException("$file: invalid JSON ({$e->getMessage()}).", 0, $e);
        }

        if (!is_array($data)) {
            throw new RuntimeException("$file: expected a JSON object.");
        }

        return $data;
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Cli;

use FilesystemIterator;
use JsonException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Throwable;
use Yii2Docs\Tools\Demo\AssetHasher;
use Yii2Docs\Tools\Demo\DemoApplication;
use Yii2Docs\Tools\Demo\DemoPage;
use Yii2Docs\Tools\Demo\DemoRenderer;
use Yii2Docs\Tools\Demo\ProjectInstaller;
use Yii2Docs\Tools\Demo\SnippetRunner;
use Yii2Docs\Tools\Source\Manifest;
use Yii2Docs\Tools\Source\Package;

use function array_filter;
use function array_map;
use function array_values;
use function copy;
use function count;
use function define;
use function defined;
use function explode;
use function file_get_contents;
use function file_put_contents;
use function fwrite;
use function getenv;
use function glob;
use function in_array;
use function is_array;
use function is_dir;
use function is_file;
use function is_int;
use function is_link;
use function is_resource;
use function is_string;
use function json_decode;
use function json_encode;
use function microtime;
use function mkdir;
use function proc_close;
use function proc_open;
use function rmdir;
use function rtrim;
use function sprintf;
use function stream_get_contents;
use function str_starts_with;
use function strstr;
use function substr;
use function trim;
use function unlink;

use const JSON_PRETTY_PRINT;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;
use const PHP_BINARY;
use const STDERR;
use const STDOUT;

/**
 * Renders the examples pages of the extension packages (`docs/examples.md`) into static demo pages under
 * `public/demos/<package>/` and writes one catalog per package to `.cache/demos/<package>.json`.
 *
 * Only packages with `"demos": true` in `packages.json` are rendered: their examples are written as standalone
 * snippets (see `src/content/docs/project/development.md`, "Demos").
 *
 * The command runs as an orchestrator that prepares the Composer project of each package
 * ({@see ProjectInstaller}) and starts itself as a worker (`--worker=<package>`) in a separate PHP process, because
 * the demos load Yii 22.0 and the package from their own `vendor/`, which cannot share a process with the API
 * reference generator (yii2-apidoc on Yii 2.0) or with another package.
 */
final class DemosCommand
{
    private const HELP = <<<'TXT'
        Usage: php tools/bin/demos [options]

        Renders the `php` snippets of each package's docs/examples.md with a Yii 22.0 application into static pages
        under public/demos/<package>/ and writes the catalog .cache/demos/<package>.json (read by
        plugins/remark-demos.mjs). Only packages with "demos": true in packages.json are rendered; packages without
        sources (skipped by the sync) or without examples are skipped.

        Options:
            --local              Use the localPath checkouts of packages.json instead of .cache/sources.json.
            --package=<names>    Comma-separated package names (default: every package with examples).
            --base=<path>        Site base path (default: /docs/).
            --strict             Exit with 1 when a snippet fails or is skipped.
            --no-install         Do not run Composer (use the installed .cache/demos/<package>/vendor).
            --help               Show this help.
        TXT;

    /**
     * @param string $root Repository root of the documentation site.
     * @param string $script Path of `tools/bin/demos`, started again for the workers.
     */
    public function __construct(private readonly string $root, private readonly string $script)
    {
    }

    /**
     * Runs the command.
     *
     * @param list<string> $args Command-line arguments without the script name.
     *
     * @return int Exit code: 0 on success, 1 on an error or (with `--strict`) a failed or skipped snippet.
     */
    public function run(array $args): int
    {
        $options = $this->options($args);

        if ($options === null) {
            return 1;
        }

        if ($options['help']) {
            fwrite(STDOUT, self::HELP . "\n");

            return 0;
        }

        try {
            return $options['worker'] !== ''
                ? $this->worker($options['worker'], $options['local'], $options['base'])
                : $this->orchestrate($options);
        } catch (Throwable $e) {
            fwrite(STDERR, '[demos] ' . $e->getMessage() . "\n");

            return 1;
        }
    }

    /**
     * Prepares and renders every selected package and prints the summary.
     *
     * @param array{help: bool, local: bool, strict: bool, install: bool, base: string, worker: string,
     *     packages: list<string>} $options
     *
     * @throws RuntimeException When a manifest, the Composer project or a worker fails.
     */
    private function orchestrate(array $options): int
    {
        $start = microtime(true);
        $manifest = Manifest::load($this->root, $this->root . '/packages.json', $options['local']);
        $publicDir = $this->root . '/public/demos';
        $cacheDir = $this->root . '/.cache/demos';
        $selected = $options['packages'];

        if ($selected === []) {
            self::remove($publicDir);

            foreach (glob($cacheDir . '/*.json') ?: [] as $file) {
                unlink($file);
            }
        }

        $enabled = $this->enabledPackages();

        foreach ($manifest->skipped as $message) {
            if (in_array(strstr($message, ':', true), $enabled, true)) {
                fwrite(STDOUT, "[demos] skipped $message; no demos.\n");
            }
        }

        $framework = $manifest->framework();
        $installer = new ProjectInstaller(
            $this->root . '/tools/demos/composer.json',
            self::composerBinary(),
        );
        $failed = 0;
        $rendered = 0;
        $skipped = 0;

        foreach ($manifest->packages as $package) {
            if ($package->isFramework() || ($selected !== [] && !in_array($package->name, $selected, true))) {
                continue;
            }

            if (!in_array($package->name, $enabled, true)) {
                continue;
            }

            $examples = $this->examplesFile($package);

            if ($examples === null) {
                fwrite(STDOUT, "[demos] {$package->name}: no examples page, nothing to render.\n");
                continue;
            }

            if ($selected !== []) {
                self::remove("$publicDir/{$package->name}");
            }

            $packageStart = microtime(true);
            $projectDir = "$cacheDir/{$package->name}";

            if ($options['install']) {
                $install = $installer->install($package, $framework, $projectDir);

                if ($install['updated']) {
                    fwrite(STDOUT, "[demos] {$package->name}: Composer project updated in $projectDir.\n");
                }
            }

            $this->copyFrame($publicDir . '/assets/frame');
            $this->spawnWorker($package->name, $options);
            $catalog = self::readJson("$cacheDir/{$package->name}.json");
            $counts = is_array($catalog['counts'] ?? null) ? $catalog['counts'] : [];
            $failed += is_int($counts['failed'] ?? null) ? $counts['failed'] : 0;
            $skipped += is_int($counts['skipped'] ?? null) ? $counts['skipped'] : 0;
            $rendered += is_int($counts['rendered'] ?? null) ? $counts['rendered'] : 0;

            fwrite(STDOUT, sprintf(
                "[demos] %s: %d snippets, %d rendered, %d skipped, %d failed (%.1f s).\n",
                $package->name,
                is_array($catalog['demos'] ?? null) ? count($catalog['demos']) : 0,
                $counts['rendered'] ?? 0,
                $counts['skipped'] ?? 0,
                $counts['failed'] ?? 0,
                microtime(true) - $packageStart,
            ));

            foreach (is_array($catalog['demos'] ?? null) ? $catalog['demos'] : [] as $demo) {
                if (is_array($demo) && in_array($demo['status'] ?? null, ['failed', 'skipped'], true)) {
                    fwrite(STDOUT, sprintf(
                        "[demos]   %s %s (%s:%d): %s\n",
                        $demo['status'],
                        $demo['slug'] ?? '?',
                        $catalog['source'] ?? 'examples.md',
                        $demo['line'] ?? 0,
                        $demo['reason'] ?? 'unknown error',
                    ));
                }
            }
        }

        fwrite(STDOUT, sprintf(
            "[demos] %d pages, %d failed and %d skipped snippets in %.1f s.\n",
            $rendered,
            $failed,
            $skipped,
            microtime(true) - $start,
        ));

        return self::exitCode($options['strict'], $failed, $skipped);
    }

    /**
     * Returns the exit code of a run: `1` when `--strict` is set and a snippet failed or was skipped, else `0`.
     *
     * A skipped snippet (a `begin()` without `end()`, a configuration array, a class body or a script without its
     * target) is a documentation fragment that produced no demo; under `--strict` every example must render.
     *
     * @param bool $strict Whether `--strict` was given.
     * @param int $failed Number of snippets that threw while rendering.
     * @param int $skipped Number of snippets that produced no demo.
     */
    public static function exitCode(bool $strict, int $failed, int $skipped): int
    {
        return $strict && ($failed > 0 || $skipped > 0) ? 1 : 0;
    }

    /**
     * Renders one package in this process: loads its Composer project, creates the application and writes the pages
     * and the catalog.
     *
     * @throws RuntimeException When the package, its project or the examples page is missing.
     */
    private function worker(string $name, bool $local, string $base): int
    {
        $manifest = Manifest::load($this->root, $this->root . '/packages.json', $local);
        $package = null;

        foreach ($manifest->packages as $candidate) {
            if ($candidate->name === $name) {
                $package = $candidate;
            }
        }

        $examples = $package === null ? null : $this->examplesFile($package);

        if ($package === null || $examples === null) {
            throw new RuntimeException("$name: no sources or no examples page.");
        }

        $projectDir = "{$this->root}/.cache/demos/$name";
        $vendor = "$projectDir/vendor";

        if (!is_file("$vendor/autoload.php")) {
            throw new RuntimeException("$vendor/autoload.php not found; run without --no-install first.");
        }

        defined('YII_DEBUG') || define('YII_DEBUG', false);
        defined('YII_ENV') || define('YII_ENV', 'prod');
        defined('YII_ENABLE_ERROR_HANDLER') || define('YII_ENABLE_ERROR_HANDLER', false);

        require "$vendor/autoload.php";
        require "$vendor/yiisoft/yii2/Yii.php";

        $assetsDir = "{$this->root}/public/demos/assets";

        if (!is_dir($assetsDir) && !mkdir($assetsDir, 0o775, true) && !is_dir($assetsDir)) {
            throw new RuntimeException("Cannot create $assetsDir.");
        }

        $packageComposer = self::readJson($package->checkoutDir . '/composer.json');
        $bootstrap = $packageComposer['extra']['bootstrap'] ?? [];
        $npm = "{$this->root}/node_modules";
        DemoApplication::create(
            "docs-demos-$name",
            $projectDir,
            $vendor,
            $npm,
            $assetsDir,
            $base . 'demos/assets',
            new AssetHasher(['npm' => $npm, $name => $package->checkoutDir, 'vendor' => $vendor]),
            is_string($bootstrap) ? [$bootstrap] : array_values(array_filter((array) $bootstrap, is_string(...))),
        );

        $renderer = new DemoRenderer(
            $name,
            new SnippetRunner($package->namespace),
            new DemoPage($base . 'demos/assets/frame', $base),
            "{$this->root}/public/demos/$name",
            $base . "demos/$name/",
            $package->title,
        );
        $catalog = $renderer->render($examples, "{$package->docsDir}/examples.md");
        $json = json_encode(
            $catalog,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        if (file_put_contents("{$this->root}/.cache/demos/$name.json", $json . "\n") === false) {
            throw new RuntimeException("Cannot write .cache/demos/$name.json.");
        }

        return 0;
    }

    /**
     * Returns the names of the `packages.json` entries with `"demos": true`.
     *
     * @return list<string>
     *
     * @throws RuntimeException When `packages.json` is missing or invalid.
     */
    private function enabledPackages(): array
    {
        $names = [];

        foreach (self::readJson($this->root . '/packages.json') as $entry) {
            if (is_array($entry) && ($entry['demos'] ?? false) === true && is_string($entry['name'] ?? null)) {
                $names[] = $entry['name'];
            }
        }

        return $names;
    }

    /**
     * Returns the Composer executable: `COMPOSER_BINARY` when set, otherwise `composer` from the `PATH`.
     */
    private static function composerBinary(): string
    {
        $binary = getenv('COMPOSER_BINARY');

        return is_string($binary) && $binary !== '' ? $binary : 'composer';
    }

    /**
     * Returns the examples page of a package (`<checkout>/<docsDir>/examples.md`), or `null` when it has none.
     */
    private function examplesFile(Package $package): ?string
    {
        if ($package->checkoutDir === '' || $package->docsDir === '') {
            return null;
        }

        $file = "{$package->checkoutDir}/{$package->docsDir}/examples.md";

        return is_file($file) ? $file : null;
    }

    /**
     * Starts the worker for a package and waits for it.
     *
     * @param array{help: bool, local: bool, strict: bool, install: bool, base: string, worker: string,
     *     packages: list<string>} $options
     *
     * @throws RuntimeException When the worker cannot start or fails.
     */
    private function spawnWorker(string $name, array $options): void
    {
        $command = [PHP_BINARY, $this->script, "--worker=$name", '--base=' . $options['base']];

        if ($options['local']) {
            $command[] = '--local';
        }

        // The output is relayed through pipes: a child writing to the inherited STDOUT of a file redirect would
        // overwrite the lines of this process.
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);

        if (!is_resource($process)) {
            throw new RuntimeException("Cannot start the worker for $name.");
        }

        fwrite(STDOUT, (string) stream_get_contents($pipes[1]));
        fwrite(STDERR, (string) stream_get_contents($pipes[2]));
        $code = proc_close($process);

        if ($code !== 0) {
            throw new RuntimeException("The worker for $name failed (exit $code).");
        }
    }

    /**
     * Copies `tools/demos/frame.js` and `frame.css` (loaded by every demo page) to the published assets.
     *
     * @throws RuntimeException When a file cannot be copied.
     */
    private function copyFrame(string $dir): void
    {
        if (!is_dir($dir) && !mkdir($dir, 0o775, true) && !is_dir($dir)) {
            throw new RuntimeException("Cannot create $dir.");
        }

        foreach (['frame.js', 'frame.css'] as $file) {
            if (!copy("{$this->root}/tools/demos/$file", "$dir/$file")) {
                throw new RuntimeException("Cannot copy tools/demos/$file.");
            }
        }
    }

    /**
     * Parses the arguments, or prints an error and returns `null`.
     *
     * @param list<string> $args
     *
     * @return array{help: bool, local: bool, strict: bool, install: bool, base: string, worker: string,
     *     packages: list<string>}|null
     */
    private function options(array $args): ?array
    {
        $options = [
            'help' => false,
            'local' => false,
            'strict' => false,
            'install' => true,
            'base' => '/docs/',
            'worker' => '',
            'packages' => [],
        ];

        foreach ($args as $arg) {
            match (true) {
                $arg === '--help', $arg === '-h' => $options['help'] = true,
                $arg === '--local' => $options['local'] = true,
                $arg === '--strict' => $options['strict'] = true,
                $arg === '--no-install' => $options['install'] = false,
                str_starts_with($arg, '--base=') => $options['base'] = rtrim(substr($arg, 7), '/') . '/',
                str_starts_with($arg, '--worker=') => $options['worker'] = substr($arg, 9),
                str_starts_with($arg, '--package=') => $options['packages'] = array_values(array_filter(
                    array_map(trim(...), explode(',', substr($arg, 10))),
                    static fn(string $name): bool => $name !== '',
                )),
                default => null,
            };

            if (!in_array($arg, ['--help', '-h', '--local', '--strict', '--no-install'], true)
                && !str_starts_with($arg, '--base=') && !str_starts_with($arg, '--worker=')
                && !str_starts_with($arg, '--package=')
            ) {
                fwrite(STDERR, "[demos] unknown option $arg; see --help.\n");

                return null;
            }
        }

        return $options;
    }

    /**
     * Deletes a file or a directory tree; missing paths are ignored.
     */
    private static function remove(string $path): void
    {
        if (is_link($path) || is_file($path)) {
            unlink($path);

            return;
        }

        if (!is_dir($path)) {
            return;
        }

        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($items as $item) {
            $item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }

        rmdir($path);
    }

    /**
     * @return array<array-key, mixed>
     *
     * @throws RuntimeException When the file is missing or invalid.
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

        return is_array($data) ? $data : [];
    }
}

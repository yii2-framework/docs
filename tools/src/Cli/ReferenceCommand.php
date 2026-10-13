<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Cli;

use ErrorException;
use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Throwable;
use yii\apidoc\models\TypeDoc;
use yii\helpers\FileHelper;
use Yii2Docs\Tools\Link\LinkResolver;
use Yii2Docs\Tools\Link\LinkStats;
use Yii2Docs\Tools\Model\ModelRepairer;
use Yii2Docs\Tools\Model\ReferenceContext;
use Yii2Docs\Tools\Model\TypeReader;
use Yii2Docs\Tools\Render\DocText;
use Yii2Docs\Tools\Render\IndexPageRenderer;
use Yii2Docs\Tools\Render\JsonCatalog;
use Yii2Docs\Tools\Render\LinkMap;
use Yii2Docs\Tools\Render\PageMap;
use Yii2Docs\Tools\Render\Site;
use Yii2Docs\Tools\Render\TypePageRenderer;
use Yii2Docs\Tools\Report\Baseline;
use Yii2Docs\Tools\Source\Manifest;
use Yii2Docs\Tools\Source\Package;

use function array_key_exists;
use function array_map;
use function array_merge;
use function array_unique;
use function basename;
use function copy;
use function count;
use function ctype_upper;
use function dirname;
use function error_reporting;
use function file_put_contents;
use function fwrite;
use function getenv;
use function gmdate;
use function is_dir;
use function is_file;
use function is_numeric;
use function json_encode;
use function ksort;
use function memory_get_peak_usage;
use function microtime;
use function mkdir;
use function preg_match;
use function rmdir;
use function serialize;
use function set_error_handler;
use function sprintf;
use function str_starts_with;
use function strlen;
use function strrpos;
use function substr;
use function unlink;
use function unserialize;
use function usort;

use const E_DEPRECATED;
use const E_USER_DEPRECATED;
use const JSON_PRETTY_PRINT;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;
use const SORT_STRING;
use const STDERR;
use const STDOUT;

/**
 * Generates the API reference of the documentation site: Markdown pages, `reference.json` per package, the link map
 * for the guide plugins and a run report, from the PHPDoc of the framework and the extension packages.
 *
 * All sources are parsed into one yii2-apidoc context, so links across packages resolve.
 */
final class ReferenceCommand
{
    private const USAGE = <<<'TXT'
        Usage: tools/bin/reference [options]

            --local             Use the localPath checkouts of the extensions and the framework tree exported by
                                `npm run sync:local`, instead of .cache/sources.json written by the sync.
            --manifest <file>   Package manifest (default: packages.json).
            --out <dir>         Content directory for the pages (default: src/content/docs).
            --json-out <dir>    Directory for <package>.json catalogs (default: public/reference).
            --cache <dir>       Directory for links.json and report.json (default: .cache/reference).
            --baseline <file>   Fail when apidoc errors, warnings or unresolved links grow beyond this baseline.
            --update-baseline   Write the current counts to the baseline file (default: tools/baseline.json).
            --help              Show this help.

        TXT;

    private int $deprecations = 0;
    /**
     * @var array<string, true> Markdown pages written in this run.
     */
    private array $pagesWritten = [];

    /**
     * @param string $root Repository root of the documentation site; relative paths are resolved against it.
     * @param resource $out Stream for progress output.
     * @param resource $err Stream for warnings and errors.
     */
    public function __construct(
        private readonly string $root,
        private readonly mixed $out = STDOUT,
        private readonly mixed $err = STDERR,
    ) {
    }

    /**
     * Runs the command and returns the exit code.
     *
     * @param list<string> $argv Arguments without the script name.
     */
    public function run(array $argv): int
    {
        try {
            $options = $this->options($argv);
        } catch (RuntimeException $e) {
            fwrite($this->err, '[reference] ' . $e->getMessage() . "\n\n" . self::USAGE);

            return 2;
        }

        if (isset($options['help'])) {
            fwrite($this->out, self::USAGE);

            return 0;
        }

        set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
            if (($severity & (E_DEPRECATED | E_USER_DEPRECATED)) !== 0) {
                $this->deprecations++;

                return true;
            }

            if ((error_reporting() & $severity) === 0) {
                return false;
            }

            throw new ErrorException($message, 0, $severity, $file, $line);
        });

        try {
            return $this->generate($options);
        } catch (Throwable $e) {
            fwrite($this->err, sprintf(
                "[reference] %s: %s\n  at %s:%d\n",
                $e::class,
                $e->getMessage(),
                $e->getFile(),
                $e->getLine(),
            ));

            return 1;
        } finally {
            restore_error_handler();
        }
    }

    /**
     * @param array<string, string|true> $options
     *
     * @throws RuntimeException On invalid sources, page collisions or write errors.
     */
    private function generate(array $options): int
    {
        $start = microtime(true);
        $manifestFile = $this->path((string) ($options['manifest'] ?? 'packages.json'));
        $outDir = $this->path((string) ($options['out'] ?? 'src/content/docs'));
        $jsonDir = $this->path((string) ($options['json-out'] ?? 'public/reference'));
        $cacheDir = $this->path((string) ($options['cache'] ?? '.cache/reference'));
        $manifest = Manifest::load($this->root, $manifestFile, isset($options['local']));

        foreach ($manifest->skipped as $message) {
            fwrite($this->err, "[reference] skipped $message\n");
        }

        $context = new ReferenceContext();

        foreach ($manifest->packages as $package) {
            foreach ($this->sourceFiles($package->sourceDir) as $file) {
                $context->addFile($file);
            }
        }

        $context->processFiles();
        $repairer = new ModelRepairer($context);
        $repairer->repair();
        $context->updateReferences();
        $parsed = microtime(true) - $start;

        $pages = new PageMap('/docs/', 'https://yii2-framework.github.io');
        $typePackages = [];
        $registry = [];

        foreach ($this->types($context) as $name => $type) {
            $package = $manifest->packageForFile((string) $type->sourceFile);

            if ($package === null) {
                throw new RuntimeException("$name ({$type->sourceFile}) belongs to no package.");
            }

            $typePackages[$name] = $package;
            $registry[$name] = ['package' => $package, 'kind' => TypeReader::kind($type)];
        }

        $pages->registerAll($registry);

        $stats = new LinkStats();
        $resolver = new LinkResolver($context);
        $site = new Site(
            $context,
            $manifest,
            $pages,
            $resolver,
            new DocText($resolver, $pages, $stats, $outDir),
            $typePackages,
            $this->buildDate(),
        );
        $reader = new TypeReader($context);
        $data = [];

        foreach ($this->types($context) as $name => $type) {
            $data[$name] = $reader->read($type, $typePackages[$name]);
        }

        $this->clean($outDir . '/api');

        foreach ($manifest->packages as $package) {
            if (!$package->isFramework()) {
                $this->clean($outDir . '/extensions/' . $package->name . '/reference');
            }
        }

        $typeRenderer = new TypePageRenderer($site, array_values($data));
        $sizes = [];

        foreach ($data as $name => $type) {
            $package = $typePackages[$name];
            $path = (string) $pages->typePath($name);
            $sizes[$package->name] = ($sizes[$package->name] ?? 0)
                + $this->write(
                    $outDir . '/' . $path,
                    $typeRenderer->render($type, $this->typeDoc($context, $name), $package, $path),
                );
        }

        $sizes = $this->writeIndexes($site, $manifest, $data, $typePackages, $outDir, $sizes);

        $this->cleanJson($jsonDir);
        $catalog = new JsonCatalog($site);
        $jsonSizes = [];

        foreach ($manifest->packages as $package) {
            $types = array_values(array_filter(
                $data,
                static fn(array $type): bool => $type['package'] === $package->name,
            ));
            $jsonSizes[$package->name] = $this->write(
                $jsonDir . '/' . $package->name . '.json',
                json_encode($catalog->build($package, $types), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
                    | JSON_THROW_ON_ERROR) . "\n",
            );
        }

        if (!copy(dirname(__DIR__, 2) . '/reference.schema.json', $jsonDir . '/reference.schema.json')) {
            throw new RuntimeException("Cannot copy reference.schema.json to $jsonDir.");
        }

        $this->write(
            $cacheDir . '/links.json',
            json_encode((new LinkMap($site))->build(array_values($data)), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
                . "\n",
        );

        $report = $this->report($manifest, $context, $data, $stats, $sizes, $jsonSizes, $repairer->counts);
        $report['seconds'] = round(microtime(true) - $start, 1);
        $report['parseSeconds'] = round($parsed, 1);
        $report['peakMemoryMb'] = (int) (memory_get_peak_usage(true) / 1048576);
        $report['deprecations'] = $this->deprecations;
        $report['mode'] = $manifest->mode;
        $this->write(
            $cacheDir . '/report.json',
            json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n",
        );

        foreach ($report['packages'] as $name => $counts) {
            fwrite($this->out, sprintf(
                "[reference] %s: %d types (%d pages, %d KB Markdown, %d KB JSON); apidoc %d errors, %d warnings; "
                . "%d unresolved links.\n",
                $name,
                $counts['types'],
                $counts['pages'],
                (int) ($counts['markdownBytes'] / 1024),
                (int) ($counts['jsonBytes'] / 1024),
                $counts['errors'],
                $counts['warnings'],
                $counts['unresolvedLinks'],
            ));
        }

        fwrite($this->out, sprintf(
            "[reference] done in %.1f s (parse %.1f s, %d MB peak); report: %s\n",
            $report['seconds'],
            $parsed,
            $report['peakMemoryMb'],
            $this->relativeToRoot($cacheDir . '/report.json'),
        ));

        $counts = array_map(
            static fn(array $package): array => [
                'errors' => $package['errors'],
                'warnings' => $package['warnings'],
                'unresolvedLinks' => $package['unresolvedLinks'],
            ],
            $report['packages'],
        );

        if (isset($options['update-baseline'])) {
            $file = $this->path(is_string($options['baseline'] ?? null) ? $options['baseline'] : 'tools/baseline.json');
            Baseline::write($file, $counts);
            fwrite($this->out, '[reference] baseline written to ' . $this->relativeToRoot($file) . "\n");

            return 0;
        }

        if (isset($options['baseline'])) {
            $problems = Baseline::load($this->path((string) $options['baseline']))->compare($counts);

            foreach ($problems as $problem) {
                fwrite($this->err, "[reference] baseline: $problem\n");
            }

            if ($problems !== []) {
                fwrite($this->err, "[reference] see .cache/reference/report.json; fix the PHPDoc or raise the baseline "
                    . "with --update-baseline.\n");

                return 1;
            }
        }

        return 0;
    }

    /**
     * Writes the namespace pages and the root index pages; returns the Markdown sizes by package.
     *
     * @param array<string, array<string, mixed>> $data
     * @param array<string, Package> $typePackages
     * @param array<string, int> $sizes
     *
     * @return array<string, int>
     */
    private function writeIndexes(
        Site $site,
        Manifest $manifest,
        array $data,
        array $typePackages,
        string $outDir,
        array $sizes,
    ): array {
        $renderer = new IndexPageRenderer($site);
        /** @var array<string, array<string, list<array<string, mixed>>>> $byNamespace */
        $byNamespace = [];

        foreach ($data as $name => $type) {
            $byNamespace[$typePackages[$name]->name][$type['namespace']][] = $type;
        }

        $extensions = [];
        $frameworkNamespaces = [];

        foreach ($manifest->packages as $package) {
            $namespaces = $byNamespace[$package->name] ?? [];

            if (!$package->isFramework()) {
                $namespaces[$package->namespace] ??= [];
            }

            // Every ancestor namespace inside the package gets a page, even without types of its own.
            foreach (array_keys($namespaces) as $namespace) {
                $parent = $namespace;

                while (($position = strrpos($parent, '\\')) !== false) {
                    $parent = substr($parent, 0, $position);

                    if (!$package->isFramework() && !str_starts_with($parent . '\\', $package->namespace . '\\')) {
                        break;
                    }

                    $namespaces[$parent] ??= [];
                }
            }

            ksort($namespaces, SORT_STRING);
            $total = 0;

            foreach ($namespaces as $namespace => $types) {
                usort($types, static fn(array $a, array $b): int => strcasecmp($a['shortName'], $b['shortName']));
                $children = [];

                foreach ($namespaces as $other => $otherTypes) {
                    if ($other !== $namespace && $this->isChild((string) $namespace, (string) $other)) {
                        $children[$other] = $this->recursiveCount($namespaces, (string) $other);
                    }
                }

                $path = $site->pages->namespacePath($package, (string) $namespace);
                $sizes[$package->name] = ($sizes[$package->name] ?? 0)
                    + $this->write(
                        $outDir . '/' . $path,
                        $renderer->namespacePage($package, (string) $namespace, $types, $children, $path),
                    );
                $total += count($types);

                if ($package->isFramework()) {
                    $frameworkNamespaces[(string) $namespace] = count($types);
                }
            }

            if (!$package->isFramework()) {
                $extensions[$package->name] = ['package' => $package, 'types' => $total];
            }
        }

        $framework = $manifest->framework();
        $sizes[$framework->name] = ($sizes[$framework->name] ?? 0) + $this->write(
            $outDir . '/api/index.md',
            $renderer->apiIndex($framework, $frameworkNamespaces, $extensions, array_sum($frameworkNamespaces)),
        );

        return $sizes;
    }

    private function isChild(string $parent, string $candidate): bool
    {
        $position = strrpos($candidate, '\\');
        $candidateParent = $position === false ? '' : substr($candidate, 0, $position);

        return $candidateParent === $parent && $candidate !== '';
    }

    /**
     * @param array<string, list<array<string, mixed>>> $namespaces
     */
    private function recursiveCount(array $namespaces, string $namespace): int
    {
        $count = 0;

        foreach ($namespaces as $name => $types) {
            if ($name === $namespace || str_starts_with((string) $name, $namespace . '\\')) {
                $count += count($types);
            }
        }

        return $count;
    }

    /**
     * Returns the run report: counts and sizes per package.
     *
     * @param array<string, array<string, mixed>> $data
     * @param array<string, int> $sizes
     * @param array<string, int> $jsonSizes
     * @param array<string, int> $repairs
     *
     * @return array{packages: array<string, array<string, mixed>>, repairs: array<string, int>,
     *   unassignedErrors: int}
     */
    private function report(
        Manifest $manifest,
        ReferenceContext $context,
        array $data,
        LinkStats $stats,
        array $sizes,
        array $jsonSizes,
        array $repairs,
    ): array {
        $packages = [];
        $unassigned = 0;

        foreach ($manifest->packages as $package) {
            $packages[$package->name] = [
                'commit' => $package->commit,
                'types' => 0,
                'classes' => 0,
                'interfaces' => 0,
                'traits' => 0,
                'enums' => 0,
                'pages' => 0,
                'errors' => 0,
                'warnings' => 0,
                'unresolvedLinks' => $stats->count($package->name),
                'topUnresolved' => $stats->top($package->name),
                'markdownBytes' => $sizes[$package->name] ?? 0,
                'jsonBytes' => $jsonSizes[$package->name] ?? 0,
            ];
        }

        foreach ($data as $type) {
            $packages[$type['package']]['types']++;
            $packages[$type['package']][$type['kind'] === 'class' ? 'classes' : $type['kind'] . 's']++;
        }

        foreach ($packages as $name => $counts) {
            $packages[$name]['pages'] = $this->countPages($name, $manifest);
        }

        foreach (['errors' => $context->errors, 'warnings' => $context->warnings] as $kind => $entries) {
            $entries = array_map(unserialize(...), array_unique(array_map(serialize(...), $entries)));

            foreach ($entries as $entry) {
                $file = is_array($entry) ? (string) ($entry['file'] ?? '') : '';
                $package = $file === '' ? null : $manifest->packageForFile($file);

                if ($package === null) {
                    $unassigned++;
                    continue;
                }

                $packages[$package->name][$kind]++;
                $pattern = $this->messagePattern((string) ($entry['message'] ?? ''));
                $packages[$package->name][$kind . 'ByKind'][$pattern] =
                    ($packages[$package->name][$kind . 'ByKind'][$pattern] ?? 0) + 1;
            }
        }

        foreach ($packages as $name => $counts) {
            foreach (['errorsByKind', 'warningsByKind'] as $key) {
                if (isset($counts[$key])) {
                    arsort($packages[$name][$key]);
                }
            }
        }

        return ['packages' => $packages, 'repairs' => $repairs, 'unassignedErrors' => $unassigned];
    }

    /**
     * Returns an apidoc message with names and values replaced by `X`, to group messages by kind.
     */
    private function messagePattern(string $message): string
    {
        return (string) preg_replace(
            [
                '/\$\w+/',
                '/\'[^\']*\'/',
                '/"[^"]*"/',
                '/[\w\\\\]*\\\\[\w\\\\:()$]*/',
                '/\b(getter|setter|in|of|documented:) [\w()$]+/',
                '/\d+/',
            ],
            ['$X', "'X'", '"X"', 'X', '$1 X', 'N'],
            $message,
        );
    }

    /**
     * Returns the number of Markdown pages written for a package (extension pages live under
     * `extensions/<package>/reference/`, all others belong to the framework).
     */
    private function countPages(string $name, Manifest $manifest): int
    {
        $framework = $manifest->framework()->name;
        $count = 0;

        foreach (array_keys($this->pagesWritten) as $file) {
            $package = preg_match('~/extensions/([^/]+)/reference/~', $file, $match) === 1 ? $match[1] : $framework;

            if ($package === $name) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Returns the documented types: classes, interfaces, traits and enums, sorted by name.
     *
     * @return array<string, TypeDoc>
     */
    private function types(ReferenceContext $context): array
    {
        $types = array_merge($context->classes, $context->interfaces, $context->traits, $context->enums);
        ksort($types, SORT_STRING);

        return $types;
    }

    private function typeDoc(ReferenceContext $context, string $name): TypeDoc
    {
        $type = $context->getType($name);

        if ($type === null) {
            throw new RuntimeException("Type $name vanished from the model.");
        }

        return $type;
    }

    /**
     * Lists the PHP files apidoc would document: `*.php` whose name starts with an uppercase letter, outside
     * `vendor/` and `tests/`.
     *
     * @return list<string>
     */
    private function sourceFiles(string $dir): array
    {
        $files = FileHelper::findFiles($dir, [
            'only' => ['*.php'],
            'except' => ['vendor/', 'tests/'],
            'filter' => static fn(string $path): ?bool => is_file($path) && !ctype_upper(basename($path)[0])
                ? false
                : null,
        ]);
        sort($files, SORT_STRING);

        return $files;
    }

    private function buildDate(): string
    {
        $date = getenv('DOCS_BUILD_DATE');

        if (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
            return $date;
        }

        $epoch = getenv('SOURCE_DATE_EPOCH');

        return gmdate('Y-m-d', is_string($epoch) && is_numeric($epoch) ? (int) $epoch : null);
    }

    /**
     * Writes a file (creating its directory) and returns its size.
     *
     * @throws RuntimeException When the file cannot be written.
     */
    private function write(string $file, string $contents): int
    {
        $dir = dirname($file);

        if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
            throw new RuntimeException("Cannot create the directory $dir.");
        }

        $bytes = file_put_contents($file, $contents);

        if ($bytes === false) {
            throw new RuntimeException("Cannot write $file.");
        }

        if (str_ends_with($file, '.md')) {
            $this->pagesWritten[$file] = true;
        }

        return $bytes;
    }

    /**
     * Removes a generated directory recursively.
     *
     * @throws RuntimeException When a file cannot be removed.
     */
    private function clean(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $entry) {
            $ok = $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());

            if (!$ok) {
                throw new RuntimeException("Cannot remove {$entry->getPathname()}.");
            }
        }

        if (!rmdir($dir)) {
            throw new RuntimeException("Cannot remove $dir.");
        }
    }

    /**
     * Removes the previous catalogs (`*.json`) of the JSON output directory.
     */
    private function cleanJson(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (FileHelper::findFiles($dir, ['only' => ['*.json'], 'recursive' => false]) as $file) {
            if (!unlink($file)) {
                throw new RuntimeException("Cannot remove $file.");
            }
        }
    }

    /**
     * @param list<string> $argv
     *
     * @return array<string, string|true>
     *
     * @throws RuntimeException On an unknown option or a missing value.
     */
    private function options(array $argv): array
    {
        $flags = ['local', 'update-baseline', 'help'];
        $values = ['manifest', 'out', 'json-out', 'cache', 'baseline'];
        $options = [];

        for ($i = 0, $count = count($argv); $i < $count; $i++) {
            $arg = $argv[$i];

            if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $arg, $match) !== 1) {
                throw new RuntimeException("Unexpected argument \"$arg\".");
            }

            $name = $match[1];

            if (in_array($name, $flags, true)) {
                $options[$name] = true;
                continue;
            }

            if (!in_array($name, $values, true)) {
                throw new RuntimeException("Unknown option --$name.");
            }

            if (array_key_exists(2, $match)) {
                $options[$name] = $match[2];
                continue;
            }

            if (!isset($argv[$i + 1])) {
                throw new RuntimeException("Option --$name needs a value.");
            }

            $options[$name] = $argv[++$i];
        }

        return $options;
    }

    private function path(string $path): string
    {
        return str_starts_with($path, '/') ? $path : $this->root . '/' . $path;
    }

    private function relativeToRoot(string $path): string
    {
        return str_starts_with($path, $this->root . '/') ? substr($path, strlen($this->root) + 1) : $path;
    }
}

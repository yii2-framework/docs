<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Source;

use JsonException;
use RuntimeException;

use function file_get_contents;
use function is_array;
use function is_dir;
use function is_file;
use function is_string;
use function json_decode;
use function realpath;
use function rtrim;
use function sprintf;
use function str_starts_with;
use function trim;

use const JSON_THROW_ON_ERROR;

/**
 * Resolves the packages of `packages.json` to source directories, from `.cache/sources.json` (written by
 * `scripts/sync.mjs`) or, in local mode, from the `localPath` checkouts.
 */
final class Manifest
{
    /**
     * @param list<Package> $packages Packages whose sources are available, framework first.
     * @param list<string> $skipped Messages about entries left out (skipped by the sync, missing sources).
     * @param string $mode `local` or `clone`.
     */
    private function __construct(
        public readonly array $packages,
        public readonly array $skipped,
        public readonly string $mode,
    ) {
    }

    /**
     * Loads the manifest and resolves the sources.
     *
     * @param string $root Repository root of the documentation site.
     * @param string $manifestFile `packages.json` path.
     * @param bool $local Use the `localPath` checkouts of the extensions and the framework tree exported by
     * `npm run sync:local` instead of `.cache/sources.json`.
     *
     * @throws RuntimeException When a file is missing or invalid, or the framework sources are unavailable.
     */
    public static function load(string $root, string $manifestFile, bool $local): self
    {
        $entries = self::readJson($manifestFile);

        if ($entries === [] || !array_is_list($entries)) {
            throw new RuntimeException("$manifestFile: expected a non-empty array of packages.");
        }

        $sources = $local ? null : self::readJson($root . '/.cache/sources.json');
        $packages = [];
        $skipped = [];

        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                throw new RuntimeException("$manifestFile [$index]: expected an object.");
            }

            $name = self::field($entry, 'name', $manifestFile);
            $type = is_string($entry['type'] ?? null) ? $entry['type'] : 'package';
            $srcDir = trim(self::field($entry, 'srcDir', $manifestFile), '/');

            if ($sources === null) {
                $checkout = $type === 'framework'
                    ? $root . '/.cache/packages/' . $name
                    : $root . '/' . self::field($entry, 'localPath', $manifestFile);
                $commit = 'local';
            } else {
                $record = $sources['packages'][$name] ?? null;

                if (!is_array($record)) {
                    $skipped[] = "$name: not in .cache/sources.json (run the sync first)";
                    continue;
                }

                if (is_string($record['skipped'] ?? null)) {
                    $skipped[] = "$name: skipped by the sync ({$record['skipped']})";
                    continue;
                }

                $dir = is_string($record['dir'] ?? null) ? $record['dir'] : '';
                $checkout = str_starts_with($dir, '/') ? $dir : $root . '/' . $dir;
                $commit = is_string($record['commit'] ?? null) ? $record['commit'] : 'unknown';
            }

            $sourceDir = realpath($checkout . '/' . $srcDir);

            if ($sourceDir === false || !is_dir($sourceDir)) {
                if ($type === 'framework') {
                    throw new RuntimeException(sprintf(
                        'Framework sources not found at %s/%s; run `npm run sync` (or `npm run sync:local`) first.',
                        $checkout,
                        $srcDir,
                    ));
                }

                $skipped[] = "$name: no sources at $checkout/$srcDir";
                continue;
            }

            $package = new Package(
                $name,
                self::field($entry, 'title', $manifestFile),
                $type,
                rtrim(self::field($entry, 'repo', $manifestFile), '/'),
                self::field($entry, 'ref', $manifestFile),
                $commit,
                trim(self::field($entry, 'namespace', $manifestFile), '\\'),
                $sourceDir,
                $srcDir,
                (string) realpath($checkout),
                is_string($entry['docsDir'] ?? null) ? trim($entry['docsDir'], '/') : '',
            );

            if ($package->isFramework()) {
                $packages = [$package, ...$packages];
            } else {
                $packages[] = $package;
            }
        }

        $mode = $sources === null ? 'local' : (is_string($sources['mode'] ?? null) ? $sources['mode'] : 'clone');

        return new self($packages, $skipped, $mode);
    }

    /**
     * Returns the package whose source directory holds `$file`, or `null`.
     */
    public function packageForFile(string $file): ?Package
    {
        foreach ($this->packages as $package) {
            if ($package->contains($file)) {
                return $package;
            }
        }

        return null;
    }

    /**
     * Returns the framework package.
     *
     * @throws RuntimeException When the manifest has no framework entry.
     */
    public function framework(): Package
    {
        foreach ($this->packages as $package) {
            if ($package->isFramework()) {
                return $package;
            }
        }

        throw new RuntimeException('packages.json has no entry with "type": "framework".');
    }

    /**
     * @param array<array-key, mixed> $entry
     *
     * @throws RuntimeException When the field is missing or empty.
     */
    private static function field(array $entry, string $key, string $file): string
    {
        $value = $entry[$key] ?? null;

        if (!is_string($value) || trim($value) === '') {
            throw new RuntimeException("$file: \"$key\" must be a non-empty string in every entry.");
        }

        return $value;
    }

    /**
     * @return array<array-key, mixed>
     *
     * @throws RuntimeException When the file is missing or is not a JSON object or array.
     */
    private static function readJson(string $file): array
    {
        if (!is_file($file)) {
            throw new RuntimeException("$file not found; run `npm run sync` (or `npm run sync:local`) first.");
        }

        try {
            $data = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException("$file: invalid JSON ({$e->getMessage()}).", 0, $e);
        }

        if (!is_array($data)) {
            throw new RuntimeException("$file: expected a JSON object or array.");
        }

        return $data;
    }
}

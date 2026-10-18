<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use function preg_replace;
use function realpath;
use function rtrim;
use function sha1;
use function str_starts_with;
use function strlen;
use function substr;
use function trim;

/**
 * Names published asset directories after their location, for the asset manager `hashCallback`: the URLs of the
 * demo pages stay the same across machines and builds (`npm-bootstrap-dist-js` for `<node_modules>/bootstrap/dist/js`).
 */
final class AssetHasher
{
    /**
     * @param array<string, string> $roots Directory name prefix => absolute directory, checked in order.
     */
    public function __construct(private readonly array $roots)
    {
    }

    /**
     * Returns the directory name for a published file or directory.
     */
    public function __invoke(string $path): string
    {
        $real = realpath($path);
        $path = $real === false ? $path : $real;

        foreach ($this->roots as $name => $root) {
            $root = realpath($root);

            if ($root === false) {
                continue;
            }

            $root = rtrim($root, '/');

            if ($path === $root) {
                return self::clean($name);
            }

            if (str_starts_with($path, $root . '/')) {
                return self::clean($name . '-' . substr($path, strlen($root) + 1));
            }
        }

        return 'asset-' . substr(sha1($path), 0, 12);
    }

    /**
     * Replaces every run of characters other than letters, digits, `.`, `_` and `-` with `-`.
     */
    private static function clean(string $name): string
    {
        return trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '-', $name), '-');
    }
}

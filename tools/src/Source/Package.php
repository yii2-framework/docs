<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Source;

use function rtrim;
use function str_replace;
use function str_starts_with;
use function strlen;
use function substr;

/**
 * Represents one entry of `packages.json` with the source directory resolved for this run.
 */
final class Package
{
    /**
     * @param string $name Manifest name (`yii2`, `bootstrap6`); also the `reference.json` file name.
     * @param string $title Human-readable title used in index pages.
     * @param string $type `framework` for the Yii framework, `package` for an extension.
     * @param string $repo Repository URL without a trailing slash.
     * @param string $ref Branch or tag the sources come from.
     * @param string $commit Commit of the sources, with `+worktree` for local working trees.
     * @param string $namespace Root namespace of the package, without leading or trailing backslashes.
     * @param string $sourceDir Absolute directory that holds the PHP sources (`<checkout>/<srcDir>`).
     * @param string $srcDir Source directory relative to the repository root (`framework`, `src`).
     */
    public function __construct(
        public readonly string $name,
        public readonly string $title,
        public readonly string $type,
        public readonly string $repo,
        public readonly string $ref,
        public readonly string $commit,
        public readonly string $namespace,
        public readonly string $sourceDir,
        public readonly string $srcDir,
    ) {
    }

    /**
     * Returns whether this entry is the Yii framework (pages under `api/`) rather than an extension.
     */
    public function isFramework(): bool
    {
        return $this->type === 'framework';
    }

    /**
     * Returns whether `$file` lies under the source directory of this package.
     */
    public function contains(string $file): bool
    {
        return str_starts_with($file, rtrim($this->sourceDir, '/') . '/');
    }

    /**
     * Returns the path of `$file` relative to the repository root, for example `framework/base/Widget.php`.
     */
    public function repositoryPath(string $file): string
    {
        $base = rtrim($this->sourceDir, '/') . '/';
        $relative = str_starts_with($file, $base) ? substr($file, strlen($base)) : $file;

        return $this->srcDir . '/' . str_replace('\\', '/', $relative);
    }
}

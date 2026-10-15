<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use RuntimeException;
use Yii2Docs\Tools\Source\Package;

use function array_pop;
use function array_slice;
use function count;
use function explode;
use function implode;
use function preg_match;
use function rtrim;
use function str_ends_with;
use function str_repeat;
use function str_replace;
use function str_starts_with;
use function strlen;
use function strrpos;
use function strtolower;
use function substr;

/**
 * Maps types and namespaces to content files under `src/content/docs` and to site URLs.
 *
 * Framework types go to `api/<namespace path>/<Type>.md` (`yii\web\Request` to `api/yii/web/Request.md`, served at
 * `/docs/api/yii/web/request/`), types of the global namespace to `api/global/<Type>.md`, and extension types to
 * `extensions/<package>/reference/<path below the package namespace>/<Type>.md`. Each namespace has an `index.md`.
 * Starlight lower-cases every path segment to build the slug, so two files that differ only by case, or a type named
 * like a sibling namespace, would collide: {@see register()} rejects that.
 */
final class PageMap
{
    /**
     * @var array<string, string> Content path by fully qualified type name.
     */
    private array $types = [];
    /**
     * @var array<string, string> Fully qualified type name or `ns:<namespace>` by slug, to detect collisions.
     */
    private array $slugs = [];

    /**
     * @param string $base Site base path with a trailing slash, for example `/docs/`.
     * @param string $site Site origin without a trailing slash, for example `https://yii2-framework.github.io`.
     */
    public function __construct(
        public readonly string $base,
        public readonly string $site,
    ) {
    }

    /**
     * Returns the content path of the namespace index page of `$namespace` in `$package`.
     *
     * @throws RuntimeException When the namespace lies outside the package namespace.
     */
    public function namespacePath(Package $package, string $namespace): string
    {
        return $this->directory($package, $namespace) . 'index.md';
    }

    /**
     * Returns the content path of the root index page of a package reference (`api/index.md` for the framework).
     */
    public function packageIndexPath(Package $package): string
    {
        return $package->isFramework() ? 'api/index.md' : 'extensions/' . $package->name . '/reference/index.md';
    }

    /**
     * Registers all documented types and namespaces.
     *
     * A type whose lower-cased short name equals a sibling namespace (`asset\Plugin` next to `asset\plugin\`) gets
     * the suffix `-<kind>` (`asset/Plugin-class.md`), because both would have the slug `asset/plugin`.
     *
     * @param array<string, array{package: Package, kind: string}> $types Package and kind by fully qualified name.
     *
     * @throws RuntimeException When a type lies outside its package namespace or two pages still share a slug.
     */
    public function registerAll(array $types): void
    {
        $directories = [];

        foreach ($types as $fqcn => $type) {
            [$namespace] = $this->split($fqcn);
            $directory = $this->directory($type['package'], $namespace);

            // The namespace directory and each ancestor directory exist as pages.
            $prefix = '';

            foreach (explode('/', rtrim($directory, '/')) as $segment) {
                $prefix .= ($prefix === '' ? '' : '/') . strtolower($segment);
                $directories[$prefix] = true;
            }
        }

        foreach ($types as $fqcn => $type) {
            [$namespace, $short] = $this->split($fqcn);
            $directory = $this->directory($type['package'], $namespace);
            $suffix = isset($directories[strtolower($directory . $short)]) ? '-' . $type['kind'] : '';
            $path = $directory . $short . $suffix . '.md';

            $this->claim($path, $fqcn);
            $this->claim($this->namespacePath($type['package'], $namespace), 'ns:' . $namespace);
            $this->types[$fqcn] = $path;
        }
    }

    /**
     * Returns the content path of a registered type, or `null`.
     */
    public function typePath(string $fqcn): ?string
    {
        return $this->types[$fqcn] ?? null;
    }

    /**
     * Returns the relative Markdown link from the page `$from` to the page `$to`, with an optional fragment.
     *
     * Relative `.md` links are resolved by `plugins/rehype-fix-links.mjs` (HTML) and
     * `plugins/llm-render-markdown.mjs` (Markdown output), so both outputs get the right URL shape.
     */
    public function relative(string $from, string $to, string $anchor = ''): string
    {
        $fromParts = explode('/', $from);
        array_pop($fromParts);
        $toParts = explode('/', $to);
        $common = 0;

        while (
            $common < count($fromParts)
            && $common < count($toParts) - 1
            && $fromParts[$common] === $toParts[$common]
        ) {
            $common++;
        }

        $up = count($fromParts) - $common;
        $link = str_repeat('../', $up) . implode('/', array_slice($toParts, $common));

        return $link . ($anchor === '' ? '' : '#' . $anchor);
    }

    /**
     * Returns the Starlight slug of a content path: extension removed, segments lower-cased, trailing `/index`
     * dropped.
     */
    public function slug(string $path): string
    {
        $slug = strtolower(substr($path, 0, -3));

        return str_ends_with($slug, '/index') ? substr($slug, 0, -6) : $slug;
    }

    /**
     * Returns the absolute site URL of a content path, with an optional fragment.
     */
    public function url(string $path, string $anchor = ''): string
    {
        return $this->site . $this->base . $this->slug($path) . '/' . ($anchor === '' ? '' : '#' . $anchor);
    }

    /**
     * Returns the namespace and the short name of a fully qualified name.
     *
     * @return array{string, string}
     */
    private function split(string $fqcn): array
    {
        $position = strrpos($fqcn, '\\');

        return $position === false ? ['', $fqcn] : [substr($fqcn, 0, $position), substr($fqcn, $position + 1)];
    }

    /**
     * @throws RuntimeException When the namespace lies outside the package namespace.
     */
    private function directory(Package $package, string $namespace): string
    {
        if ($package->isFramework()) {
            return 'api/' . ($namespace === '' ? 'global' : str_replace('\\', '/', $namespace)) . '/';
        }

        $root = $package->namespace;

        if ($namespace === $root) {
            return 'extensions/' . $package->name . '/reference/';
        }

        if (!str_starts_with($namespace, $root . '\\')) {
            throw new RuntimeException("Namespace \"$namespace\" is outside the {$package->name} namespace \"$root\".");
        }

        return 'extensions/' . $package->name . '/reference/'
            . str_replace('\\', '/', substr($namespace, strlen($root) + 1)) . '/';
    }

    /**
     * @throws RuntimeException When a path segment has characters Starlight would rewrite, or the slug is taken.
     */
    private function claim(string $path, string $owner): void
    {
        if (preg_match('~^[A-Za-z0-9_/-]+\.md$~', $path) !== 1) {
            throw new RuntimeException("Unsupported characters in the page path \"$path\" ($owner).");
        }

        $slug = $this->slug($path);
        $current = $this->slugs[$slug] ?? null;

        if ($current !== null && $current !== $owner) {
            throw new RuntimeException("Page slug \"$slug\" is claimed by both \"$current\" and \"$owner\".");
        }

        $this->slugs[$slug] = $owner;
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use Yii2Docs\Tools\Source\Package;

use function explode;
use function implode;
use function str_starts_with;
use function strlen;
use function substr;

/**
 * Builds the breadcrumb line of reference pages: the API reference root, the extension reference root (extension
 * packages), each namespace page down to the current one, and the current page label.
 *
 * Every namespace between the package root and a documented type has an index page (written by the reference
 * command), so every link of the trail resolves.
 */
final class Breadcrumbs
{
    private const SEPARATOR = ' › ';

    public function __construct(private readonly PageMap $pages)
    {
    }

    /**
     * Returns the breadcrumb block (blank-line separated so its Markdown links are parsed inside the HTML wrapper).
     *
     * @param string $namespace Namespace whose pages the trail links, ancestors first.
     * @param string $path Content path of the page being written.
     * @param string|null $current Label of the current page (not linked), or `null` when the page is the namespace
     * page of `$namespace` itself (its own segment is then the unlinked last item).
     *
     * @return list<string>
     */
    public function block(Package $package, string $namespace, string $path, ?string $current): array
    {
        $items = [];

        foreach ($this->trail($package, $namespace) as [$label, $target]) {
            $items[] = $target === $path ? $label : '[' . $label . '](' . $this->pages->relative($path, $target) . ')';
        }

        if ($current !== null) {
            $items[] = $current;
        }

        return ['<div class="api-crumbs">', '', implode(self::SEPARATOR, $items), '', '</div>', ''];
    }

    /**
     * Returns the trail as label and content path pairs, from the API reference root to the namespace page.
     *
     * @return list<array{string, string}>
     */
    private function trail(Package $package, string $namespace): array
    {
        $trail = [['API reference', 'api/index.md']];

        if ($package->isFramework()) {
            if ($namespace === '') {
                return [...$trail, ['Global namespace', $this->pages->namespacePath($package, '')]];
            }

            $prefix = '';

            foreach (explode('\\', $namespace) as $segment) {
                $prefix = $prefix === '' ? $segment : $prefix . '\\' . $segment;
                $trail[] = [$segment, $this->pages->namespacePath($package, $prefix)];
            }

            return $trail;
        }

        $trail[] = [$package->title, $this->pages->packageIndexPath($package)];

        if (!str_starts_with($namespace, $package->namespace . '\\')) {
            return $trail;
        }

        $prefix = $package->namespace;

        foreach (explode('\\', substr($namespace, strlen($package->namespace) + 1)) as $segment) {
            $prefix .= '\\' . $segment;
            $trail[] = [$segment, $this->pages->namespacePath($package, $prefix)];
        }

        return $trail;
    }
}

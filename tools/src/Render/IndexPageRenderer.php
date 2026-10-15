<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use Yii2Docs\Tools\Model\TypeReader;
use Yii2Docs\Tools\Source\Package;

use function count;
use function implode;
use function ksort;
use function rtrim;
use function sprintf;
use function str_starts_with;
use function strlen;
use function substr;
use function trim;

use const SORT_STRING;

/**
 * Renders the index pages: `api/index.md` (framework namespaces and the extension references), one page per
 * namespace with its breadcrumb ({@see Breadcrumbs}), sub-namespaces and one table per kind of type (modifiers as
 * flags, one-line summaries), and the root page of each extension reference.
 *
 * @phpstan-import-type TypeData from TypeReader
 */
final class IndexPageRenderer
{
    private const KINDS = ['class' => 'Classes', 'interface' => 'Interfaces', 'trait' => 'Traits', 'enum' => 'Enums'];

    public function __construct(private readonly Site $site)
    {
    }

    /**
     * Returns the namespace page of `$namespace`.
     *
     * @param list<TypeData> $types Types of the namespace, sorted.
     * @param array<string, int> $children Direct sub-namespaces with their type counts (recursive).
     */
    public function namespacePage(
        Package $package,
        string $namespace,
        array $types,
        array $children,
        string $path,
    ): string {
        $isRoot = !$package->isFramework() && $namespace === $package->namespace;
        $display = $namespace === '' ? 'Global namespace' : $namespace;
        $title = $isRoot ? $package->title . ' API reference' : $display;
        $description = $isRoot
            ? sprintf('API reference of the %s extension (%s), generated from its PHPDoc.', $package->title, $display)
            : sprintf('%s of the %s namespace.', $this->counts($types), $display);
        $label = $isRoot ? 'Overview' : ($package->isFramework() ? $display : $this->relative($package, $namespace));

        $out = [
            ...$this->frontmatter($package, $title, $description, $label),
            ...(new Breadcrumbs($this->site->pages))->block($package, $namespace, $path, null),
        ];

        if ($isRoot) {
            $out[] = sprintf(
                'Classes, interfaces, traits and enums of `%s`, generated from the PHPDoc of [%s](%s) at `%s`. '
                . 'Machine-readable catalog: [%s.json](%s).',
                $namespace,
                substr($package->repo, strlen('https://github.com/')),
                $package->repo,
                $package->ref,
                $package->name,
                $this->site->pages->site . $this->site->pages->base . 'reference/' . $package->name . '.json',
            );
            $out[] = '';
        }

        if ($children !== []) {
            $out[] = '## Namespaces';
            $out[] = '';
            $out[] = '| Namespace | Types |';
            $out[] = '| --- | --- |';

            foreach ($children as $child => $count) {
                $out[] = sprintf(
                    '| [%s](%s) | %d |',
                    DocText::cellCode($child),
                    $this->site->pages->relative($path, $this->site->pages->namespacePath($package, $child)),
                    $count,
                );
            }

            $out[] = '';
        }

        foreach (self::KINDS as $kind => $heading) {
            $rows = [];

            foreach ($types as $type) {
                if ($type['kind'] !== $kind) {
                    continue;
                }

                $page = new PageContext($this->site, $package, $path, $this->site->type($type['name']));
                $typePath = (string) $this->site->pages->typePath($type['name']);
                $flags = '';

                foreach ($type['modifiers'] as $modifier) {
                    $flags .= ' <span class="api-flag">' . $modifier . '</span>';
                }

                $rows[] = sprintf(
                    '| [%s](%s)%s | %s |',
                    DocText::cellCode($type['shortName']),
                    $this->site->pages->relative($path, $typePath),
                    $flags,
                    $page->cell($type['summary']),
                );
            }

            if ($rows !== []) {
                $out = [...$out, '## ' . $heading, '', '| ' . ucfirst($kind) . ' | Summary |', '| --- | --- |'];
                $out = [...$out, ...$rows, ''];
            }
        }

        return rtrim(implode("\n", $out)) . "\n";
    }

    /**
     * Returns `api/index.md`: the framework namespaces and links to the extension references.
     *
     * @param array<string, int> $namespaces Framework namespaces with their type counts (non-recursive).
     * @param array<string, array{package: Package, types: int}> $extensions Extension references by package name.
     */
    public function apiIndex(Package $framework, array $namespaces, array $extensions, int $total): string
    {
        $path = 'api/index.md';
        $out = $this->frontmatter(
            $framework,
            'API reference',
            sprintf(
                'Yii %s API reference: %d types in %d namespaces, generated from the PHPDoc.',
                $framework->ref,
                $total,
                count($namespaces),
            ),
            'Overview',
        );
        $out[] = sprintf(
            'Generated from the PHPDoc of [%s](%s/tree/%s/%s) (branch `%s`) with yii2-apidoc. Every type has a page '
            . 'and a Markdown version (`index.md`); the machine-readable catalog of all types is [%s.json](%s).',
            substr($framework->repo, strlen('https://github.com/')),
            $framework->repo,
            $framework->ref,
            $framework->srcDir,
            $framework->ref,
            $framework->name,
            $this->site->pages->site . $this->site->pages->base . 'reference/' . $framework->name . '.json',
        );
        $out[] = '';
        $out[] = '## Namespaces';
        $out[] = '';
        $out[] = '| Namespace | Types |';
        $out[] = '| --- | --- |';

        ksort($namespaces, SORT_STRING);

        foreach ($namespaces as $namespace => $count) {
            $out[] = sprintf(
                '| [%s](%s) | %d |',
                DocText::cellCode($namespace === '' ? 'Global namespace' : $namespace),
                $this->site->pages->relative($path, $this->site->pages->namespacePath($framework, $namespace)),
                $count,
            );
        }

        $out[] = '';

        if ($extensions !== []) {
            $out[] = '## Extensions';
            $out[] = '';
            $out[] = '| Package | Namespace | Types |';
            $out[] = '| --- | --- | --- |';

            foreach ($extensions as $extension) {
                $package = $extension['package'];
                $out[] = sprintf(
                    '| [%s](%s) | %s | %d |',
                    $package->title,
                    $this->site->pages->relative($path, $this->site->pages->packageIndexPath($package)),
                    DocText::cellCode($package->namespace),
                    $extension['types'],
                );
            }

            $out[] = '';
        }

        return rtrim(implode("\n", $out)) . "\n";
    }

    /**
     * @return list<string>
     */
    private function frontmatter(Package $package, string $title, string $description, string $label): array
    {
        return [
            '---',
            sprintf(
                '# Generated by tools/bin/reference from %s@%s; edit the PHPDoc in the source repository instead.',
                $package->repo,
                $package->ref,
            ),
            'title: ' . Site::yaml($title),
            'description: ' . Site::yaml($description),
            'editUrl: false',
            'sidebar:',
            '  label: ' . Site::yaml($label),
            '---',
            '',
        ];
    }

    /**
     * @param list<TypeData> $types
     */
    private function counts(array $types): string
    {
        $counts = [];

        foreach ($types as $type) {
            $counts[$type['kind']] = ($counts[$type['kind']] ?? 0) + 1;
        }

        $parts = [];

        foreach (self::KINDS as $kind => $heading) {
            if (isset($counts[$kind])) {
                $parts[] = $counts[$kind] . ' ' . ($counts[$kind] === 1 ? $kind : strtolower($heading));
            }
        }

        return $parts === [] ? 'No types' : ucfirst(implode(', ', $parts));
    }

    private function relative(Package $package, string $namespace): string
    {
        return str_starts_with($namespace, $package->namespace . '\\')
            ? trim(substr($namespace, strlen($package->namespace)), '\\')
            : $namespace;
    }
}

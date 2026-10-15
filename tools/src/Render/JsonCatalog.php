<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use Yii2Docs\Tools\Model\TypeReader;
use Yii2Docs\Tools\Source\Package;

use function array_filter;
use function implode;
use function trim;

/**
 * Builds `reference.json` for one package (schema: `tools/reference.schema.json`).
 *
 * Member maps hold the members the type declares, with their full contract; `inherited` maps the names of inherited
 * members to the defining type, whose entry is in the same or another catalog. Empty and default values (`false`,
 * `null`, `public`) are omitted.
 *
 * @phpstan-import-type TypeData from TypeReader
 * @phpstan-import-type MethodData from TypeReader
 */
final class JsonCatalog
{
    public const SCHEMA_VERSION = 1;

    public function __construct(private readonly Site $site)
    {
    }

    /**
     * Returns the catalog of a package.
     *
     * @param list<TypeData> $types
     *
     * @return array<string, mixed>
     */
    public function build(Package $package, array $types): array
    {
        $entries = [];

        foreach ($types as $data) {
            $entries[$data['name']] = $this->type($data, $package);
        }

        return [
            '$schema' => $this->site->pages->site . $this->site->pages->base . 'reference/reference.schema.json',
            'schemaVersion' => self::SCHEMA_VERSION,
            'package' => $package->name,
            'title' => $package->title,
            'repository' => $package->repo,
            'ref' => $package->ref,
            'commit' => $package->commit,
            'generatedAt' => $this->site->buildDate,
            'url' => $this->site->pages->url($this->site->pages->packageIndexPath($package)),
            'types' => $entries,
        ];
    }

    /**
     * @param TypeData $data
     *
     * @return array<string, mixed>
     */
    private function type(array $data, Package $package): array
    {
        $context = $this->site->type($data['name']);
        $text = fn(string $value, ?string $definer = null): string => $this->site->text->plain(
            $value,
            $definer === null ? $context : $this->site->type($definer),
            $package->name,
        );

        $inherited = ['properties' => [], 'methods' => [], 'constants' => [], 'events' => []];
        $properties = [];

        foreach ($data['properties'] as $name => $property) {
            if ($property['definedBy'] !== $data['name']) {
                $inherited['properties'][$name] = $property['definedBy'];
                continue;
            }

            $properties[$name] = $this->compact([
                'type' => $property['type'],
                'default' => $property['default'],
                'description' => $text($property['summary']),
                'visibility' => $property['visibility'] === 'public' ? null : $property['visibility'],
                'static' => $property['static'],
                'readonly' => $property['readonly'],
                'access' => $property['access'] === 'read-write' ? null : $property['access'],
                'virtual' => $property['virtual'],
                'promoted' => $property['promoted'],
                'since' => $property['since'],
                'deprecated' => $this->deprecated($property['deprecated'], $text),
            ]);
        }

        $methods = [];

        foreach ($data['methods'] as $name => $method) {
            if ($method['definedBy'] !== $data['name']) {
                $inherited['methods'][$name] = $method['definedBy'];
                continue;
            }

            $methods[$name] = $this->method($method, $text);
        }

        $constants = [];

        foreach ($data['constants'] as $name => $constant) {
            if ($constant['definedBy'] !== $data['name']) {
                $inherited['constants'][$name] = $constant['definedBy'];
                continue;
            }

            $constants[$name] = $this->compact([
                'value' => $constant['value'],
                'description' => $text($constant['summary']),
                'since' => $constant['since'],
                'deprecated' => $this->deprecated($constant['deprecated'], $text),
            ]);
        }

        $events = [];

        foreach ($data['events'] as $name => $event) {
            if ($event['definedBy'] !== $data['name']) {
                $inherited['events'][$name] = $event['definedBy'];
                continue;
            }

            $events[$name] = $this->compact([
                'value' => $event['value'],
                'type' => $event['type'],
                'description' => $text($event['summary']),
                'since' => $event['since'],
            ]);
        }

        $cases = [];

        foreach ($data['cases'] as $name => $case) {
            $cases[$name] = $this->compact(['value' => $case['value'], 'description' => $text($case['summary'])]);
        }

        return $this->compact([
            'kind' => $data['kind'],
            'modifiers' => $data['modifiers'],
            'url' => $this->site->pages->url((string) $this->site->pages->typePath($data['name'])),
            'summary' => $text($data['summary']),
            'since' => $data['since'],
            'deprecated' => $this->deprecated($data['deprecated'], $text),
            'extends' => $data['extends'],
            'implements' => $data['implements'],
            'traits' => $data['traits'],
            'backingType' => $data['backingType'],
            'cases' => $cases,
            'properties' => $properties,
            'methods' => $methods,
            'constants' => $constants,
            'events' => $events,
            'inherited' => $this->compact($inherited),
        ]);
    }

    /**
     * @param MethodData $method
     * @param callable(string): string $text
     *
     * @return array<string, mixed>
     */
    private function method(array $method, callable $text): array
    {
        $params = [];
        $signature = [];

        foreach ($method['params'] as $param) {
            $params[] = $this->compact([
                'name' => $param['name'],
                'type' => $param['type'],
                'default' => $param['default'],
                'optional' => $param['optional'],
                'variadic' => $param['variadic'],
                'byReference' => $param['byReference'],
                'description' => $text($param['description']),
            ]);
            $signature[] = trim(($param['type'] ?? '') . ' ' . ($param['byReference'] ? '&' : '')
                . ($param['variadic'] ? '...' : '') . $param['name']
                . ($param['default'] === null ? '' : ' = ' . $param['default']));
        }

        $throws = [];

        foreach ($method['throws'] as $throw) {
            $throws[] = $this->compact(['type' => $throw['type'], 'description' => $text($throw['description'])]);
        }

        $modifiers = array_filter([
            $method['abstract'] ? 'abstract' : '',
            $method['final'] ? 'final' : '',
            $method['visibility'],
            $method['static'] ? 'static' : '',
        ]);

        return $this->compact([
            'signature' => implode(' ', $modifiers) . ' function ' . $method['name']
                . '(' . implode(', ', $signature) . ')'
                . ($method['returnType'] === null ? '' : ': ' . $method['returnType']),
            'summary' => $text($method['summary']),
            'params' => $params,
            'return' => $method['returnType'] === null
                ? null
                : $this->compact(['type' => $method['returnType'], 'description' => $text($method['return'])]),
            'throws' => $throws,
            'visibility' => $method['visibility'] === 'public' ? null : $method['visibility'],
            'static' => $method['static'],
            'abstract' => $method['abstract'],
            'virtual' => $method['virtual'],
            'since' => $method['since'],
            'deprecated' => $this->deprecated($method['deprecated'], $text),
        ]);
    }

    /**
     * @param array{version: string|null, reason: string}|null $deprecated
     * @param callable(string): string $text
     *
     * @return array<string, string>|null
     */
    private function deprecated(?array $deprecated, callable $text): ?array
    {
        if ($deprecated === null) {
            return null;
        }

        $result = $this->compact(['since' => $deprecated['version'], 'reason' => $text($deprecated['reason'])]);

        return $result === [] ? ['reason' => ''] : $result;
    }

    /**
     * Removes `null`, `false`, `''` and `[]` values.
     *
     * @param array<string, mixed> $values
     *
     * @return array<string, mixed>
     */
    private function compact(array $values): array
    {
        return array_filter($values, static fn(mixed $value): bool => $value !== null && $value !== false
            && $value !== '' && $value !== []);
    }
}

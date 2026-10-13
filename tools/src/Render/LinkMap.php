<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use stdClass;
use Yii2Docs\Tools\Model\TypeReader;

use function array_filter;

/**
 * Builds the link map read by the site plugins (`plugins/yii-links.mjs`) to resolve `[[yii\...]]` references in the
 * guide without PHP: the slug of every type page, its parent class, traits and interfaces (to find inherited members)
 * and the anchors of the members it declares.
 *
 * @phpstan-import-type TypeData from TypeReader
 */
final class LinkMap
{
    public function __construct(private readonly Site $site)
    {
    }

    /**
     * @param list<TypeData> $types All documented types.
     *
     * @return array{base: string, types: array<string, array<string, mixed>>}
     */
    public function build(array $types): array
    {
        $map = [];

        foreach ($types as $data) {
            $members = [];

            foreach ($data['methods'] as $name => $method) {
                if ($method['definedBy'] === $data['name']) {
                    $members[$name . '()'] = Anchor::method($name);
                }
            }

            foreach ($data['properties'] as $name => $property) {
                if ($property['definedBy'] === $data['name']) {
                    $members['$' . $name] = Anchor::property($name);
                }
            }

            foreach ($data['events'] as $name => $event) {
                if ($event['definedBy'] === $data['name']) {
                    $members[$name] = Anchor::event($name);
                }
            }

            foreach ($data['constants'] as $name => $constant) {
                if ($constant['definedBy'] === $data['name']) {
                    $members[$name] = Anchor::constant($name);
                }
            }

            foreach ($data['cases'] as $name => $case) {
                $members[$name] = Anchor::enumCase($name);
            }

            $map[$data['name']] = array_filter([
                'slug' => $this->site->pages->slug((string) $this->site->pages->typePath($data['name'])),
                'extends' => $data['extends'],
                'traits' => $data['traits'],
                'implements' => $data['implements'],
                'members' => $members === [] ? new stdClass() : $members,
            ], static fn(mixed $value): bool => $value !== null && $value !== []);
        }

        return ['base' => $this->site->pages->base, 'types' => $map];
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use Yii2Docs\Tools\Model\TypeReader;

/**
 * Builds the link map read by the site plugins (`plugins/yii-links.mjs`) to resolve `[[yii\...]]` references in the
 * guide without PHP: the slug of every type page, the types to search for inherited members, and the anchors of the
 * members each type declares.
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
     * @return array{base: string, types: array<string, array{slug: string, inherits: list<string>,
     *   members: array<string, string>}>}
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

            $inherits = [...$data['traits'], ...$data['implements']];

            if ($data['extends'] !== null) {
                $inherits[] = $data['extends'];
            }

            $map[$data['name']] = [
                'slug' => $this->site->pages->slug((string) $this->site->pages->typePath($data['name'])),
                'inherits' => $inherits,
                'members' => $members,
            ];
        }

        return ['base' => $this->site->pages->base, 'types' => $map];
    }
}

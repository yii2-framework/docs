<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Model;

use phpDocumentor\Reflection\DocBlock\Tags\Param;
use phpDocumentor\Reflection\DocBlock\Tags\Property as PropertyTag;
use phpDocumentor\Reflection\DocBlock\Tags\PropertyRead;
use phpDocumentor\Reflection\DocBlock\Tags\PropertyWrite;
use phpDocumentor\Reflection\Php\Class_;
use phpDocumentor\Reflection\Php\Enum_;
use phpDocumentor\Reflection\Php\Interface_;
use phpDocumentor\Reflection\Php\Method;
use phpDocumentor\Reflection\Php\Property;
use phpDocumentor\Reflection\Php\Trait_;
use yii\apidoc\models\PropertyDoc;
use yii\apidoc\models\TypeDoc;
use yii\helpers\StringHelper;

use function array_merge;
use function array_filter;
use function array_values;
use function in_array;
use function trim;

/**
 * Repairs gaps of the yii2-apidoc 4.0.1 model from the reflection docblocks, before inheritance is resolved.
 *
 * - A property whose `@var` tag has no description keeps the docblock summary (apidoc overwrites it with the empty
 *   `@var` text).
 * - A constructor-promoted property takes its description and its PHPDoc type (generics) from the constructor `@param`
 *   tag, also when the constructor is private (apidoc skips private methods).
 * - `readonly` classes and properties and promoted properties are recorded (apidoc has no flags for them).
 * - Private and `@internal` constants are removed (apidoc lists every constant).
 *
 * Each repair is counted; see {@see $counts}.
 */
final class ModelRepairer
{
    /**
     * @var array<string, int> Number of repairs by kind.
     */
    public array $counts = [
        'varSummary' => 0,
        'promotedDescription' => 0,
        'promotedType' => 0,
        'privateConstants' => 0,
    ];

    public function __construct(private readonly ReferenceContext $context)
    {
    }

    /**
     * Applies every repair to the classes, traits and enums of the context.
     */
    public function repair(): void
    {
        $types = array_merge(
            $this->context->classes,
            $this->context->interfaces,
            $this->context->traits,
            $this->context->enums,
        );

        foreach ($types as $name => $type) {
            $reflector = $this->context->reflectors[$name] ?? null;

            if ($reflector === null) {
                continue;
            }

            $this->repairConstants($type, $reflector);
            $this->recordPropertyTags($name, $reflector);

            if ($reflector instanceof Class_ || $reflector instanceof Trait_) {
                if ($reflector instanceof Class_ && $reflector->isReadOnly()) {
                    $this->context->readonlyTypes[$name] = true;
                }

                $this->repairProperties($type, $reflector);
            }
        }
    }

    /**
     * @param Class_|Trait_ $reflector
     */
    private function repairProperties(TypeDoc $type, Class_|Trait_ $reflector): void
    {
        $constructor = null;

        foreach ($reflector->getMethods() as $method) {
            if ($method->getName() === '__construct') {
                $constructor = $method;
            }
        }

        $params = $constructor === null ? [] : $this->paramTags($constructor);
        $readonlyClass = $reflector instanceof Class_ && $reflector->isReadOnly();

        foreach ($reflector->getProperties() as $property) {
            $key = '$' . $property->getName();
            $doc = $type->properties[$key] ?? null;
            $promoted = $constructor !== null && $this->isPromoted($property, $constructor);

            if ($promoted) {
                $this->context->promotedProperties[$type->name][$key] = true;
            }

            if ($readonlyClass || $property->isReadOnly()) {
                $this->context->readonlyProperties[$type->name][$key] = true;
            }

            if (!$doc instanceof PropertyDoc) {
                continue;
            }

            $this->repairSummary($doc, $property);

            if ($promoted && isset($params[$key])) {
                $this->repairPromoted($doc, $params[$key]);
            }

            if (trim((string) $doc->shortDescription) !== '') {
                $this->removeRepairedPropertyWarnings($doc);
            }
        }
    }

    /**
     * Records the access of the `@property*` tags of a type: apidoc keeps the property but not the tag kind, and
     * drops the getter/setter pairing when the tag and a getter coexist ("conflicts with a defined getter").
     */
    private function recordPropertyTags(string $name, Class_|Interface_|Trait_|Enum_ $reflector): void
    {
        $access = [];

        foreach ($reflector->getDocBlock()?->getTags() ?? [] as $tag) {
            $kind = match (true) {
                $tag instanceof PropertyRead => 'read',
                $tag instanceof PropertyWrite => 'write',
                $tag instanceof PropertyTag => 'both',
                default => null,
            };

            if ($kind === null || $tag->getVariableName() === null) {
                continue;
            }

            $key = '$' . $tag->getVariableName();
            $current = $access[$key] ?? null;
            $access[$key] = $current === null ? $kind : ($current === $kind ? $kind : 'both');
        }

        foreach ($access as $key => $kind) {
            $this->context->propertyTagAccess[$name][$key] = match ($kind) {
                'read' => 'read-only',
                'write' => 'write-only',
                default => 'read-write',
            };
        }
    }

    /**
     * Removes only property warnings disproved by the restored source summary or promoted-parameter description.
     * Constructor and unrelated missing documentation diagnostics remain unchanged.
     */
    private function removeRepairedPropertyWarnings(PropertyDoc $doc): void
    {
        $messages = [
            "No docblock for element '{$doc->name}'",
            "No short description for element '{$doc->name}'",
        ];
        $this->context->warnings = array_values(array_filter(
            $this->context->warnings,
            static fn(array $warning): bool => !(
                ($warning['file'] ?? null) === $doc->sourceFile
                && ($warning['line'] ?? null) === $doc->startLine
                && in_array($warning['message'] ?? '', $messages, true)
            ),
        ));
    }

    private function repairSummary(PropertyDoc $doc, Property $property): void
    {
        $docBlock = $property->getDocBlock();

        if ($docBlock === null || trim((string) $doc->shortDescription) !== '') {
            return;
        }

        $summary = trim($docBlock->getSummary());

        if ($summary === '') {
            return;
        }

        $doc->shortDescription = StringHelper::mb_ucfirst($summary);
        $doc->description = $docBlock->getDescription()->render();
        $this->counts['varSummary']++;
    }

    private function repairPromoted(PropertyDoc $doc, Param $param): void
    {
        $description = trim((string) $param->getDescription());

        if ($description !== '' && trim((string) $doc->shortDescription) === '') {
            $doc->shortDescription = StringHelper::mb_ucfirst($description);
            $this->counts['promotedDescription']++;
        }

        $tagType = $param->getType();

        if ($tagType !== null && (string) $tagType !== (string) $doc->type) {
            $doc->type = $tagType;
            $this->counts['promotedType']++;
        }
    }

    /**
     * Returns the `@param` tags of a method by `$name`.
     *
     * @return array<string, Param>
     */
    private function paramTags(Method $method): array
    {
        $tags = [];

        foreach ($method->getDocBlock()?->getTagsByName('param') ?? [] as $tag) {
            if ($tag instanceof Param && $tag->getVariableName() !== null) {
                $tags['$' . $tag->getVariableName()] = $tag;
            }
        }

        return $tags;
    }

    /**
     * Whether the property is declared in the constructor signature (constructor property promotion).
     */
    private function isPromoted(Property $property, Method $constructor): bool
    {
        $line = $property->getLocation()->getLineNumber();

        return $line >= $constructor->getLocation()->getLineNumber()
            && $line <= $constructor->getEndLocation()->getLineNumber();
    }

    /**
     * Removes private and `@internal` constants from the model.
     */
    private function repairConstants(TypeDoc $type, Class_|Interface_|Trait_|Enum_ $reflector): void
    {
        foreach ($reflector->getConstants() as $constant) {
            $name = $constant->getName();
            $internal = $constant->getDocBlock()?->hasTag('internal') ?? false;

            if (!in_array((string) $constant->getVisibility(), ['private'], true) && !$internal) {
                continue;
            }

            if (isset($type->constants[$name]) || isset($type->events[$name])) {
                unset($type->constants[$name], $type->events[$name]);
                $this->counts['privateConstants']++;
            }
        }
    }
}

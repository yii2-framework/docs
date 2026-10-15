<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Model;

use phpDocumentor\Reflection\DocBlock\Tags\See;
use phpDocumentor\Reflection\Php\Argument;
use phpDocumentor\Reflection\Php\Class_;
use phpDocumentor\Reflection\Php\Enum_;
use phpDocumentor\Reflection\Php\Trait_;
use phpDocumentor\Reflection\Type;
use yii\apidoc\models\BaseDoc;
use yii\apidoc\models\ClassDoc;
use yii\apidoc\models\ConstDoc;
use yii\apidoc\models\EventDoc;
use yii\apidoc\models\InterfaceDoc;
use yii\apidoc\models\MethodDoc;
use yii\apidoc\models\PropertyDoc;
use yii\apidoc\models\TraitDoc;
use yii\apidoc\models\TypeDoc;
use Yii2Docs\Tools\Source\Package;

use function array_values;
use function in_array;
use function ltrim;
use function preg_replace;
use function strcasecmp;
use function strrpos;
use function substr;
use function trim;
use function uksort;

/**
 * Reads a type of the (repaired) yii2-apidoc model into the plain array shape shared by the Markdown pages and
 * `reference.json`.
 *
 * Text fields keep the raw docblock Markdown; links are resolved by the renderers, with the defining type as context.
 * Types are strings without leading backslashes (`yii\web\View|null`). Members are public or protected; private ones
 * are not in the model.
 *
 * @phpstan-type Deprecation array{version: string|null, reason: string}
 * @phpstan-type PropertyData array{name: string, type: string|null, default: string|null, visibility: string,
 *   static: bool, readonly: bool, promoted: bool, virtual: bool, access: string, summary: string,
 *   description: string, definedBy: string, since: string|null, deprecated: Deprecation|null}
 * @phpstan-type ParamData array{name: string, type: string|null, default: string|null, optional: bool,
 *   byReference: bool, variadic: bool, description: string}
 * @phpstan-type MethodData array{name: string, visibility: string, static: bool, abstract: bool, final: bool,
 *   virtual: bool, params: list<ParamData>, returnType: string|null, return: string,
 *   throws: list<array{type: string, description: string}>, summary: string, description: string,
 *   definedBy: string, since: string|null, deprecated: Deprecation|null, see: list<string>}
 * @phpstan-type ConstantData array{name: string, value: string|null, summary: string, description: string,
 *   definedBy: string, since: string|null, deprecated: Deprecation|null}
 * @phpstan-type EventData array{name: string, value: string|null, type: string|null, summary: string,
 *   description: string, definedBy: string, since: string|null}
 * @phpstan-type CaseData array{name: string, value: string|null, summary: string, description: string}
 * @phpstan-type TypeData array{name: string, shortName: string, namespace: string, kind: string,
 *   modifiers: list<string>, package: string, file: string, line: int, summary: string, description: string,
 *   since: string|null, deprecated: Deprecation|null, extends: string|null, parents: list<string>,
 *   implements: list<string>, traits: list<string>, backingType: string|null,
 *   properties: array<string, PropertyData>, methods: array<string, MethodData>,
 *   constants: array<string, ConstantData>, events: array<string, EventData>, cases: array<string, CaseData>,
 *   see: list<string>, subclasses: list<string>, implementedBy: list<string>, usedBy: list<string>}
 */
final class TypeReader
{
    /**
     * @var array<string, list<string>> Direct subclasses by parent class.
     */
    private array $subclasses = [];
    /**
     * @var array<string, list<string>> Classes and interfaces that declare an interface, by interface.
     */
    private array $implementers = [];
    /**
     * @var array<string, list<string>> Types that declare a trait, by trait.
     */
    private array $traitUsers = [];

    public function __construct(private readonly ReferenceContext $context)
    {
        foreach ($context->classes as $name => $class) {
            if ($class->parentClass !== null) {
                $this->subclasses[$class->parentClass][] = $name;
            }

            foreach ($context->declaredInterfaces[$name] ?? [] as $interface) {
                $this->implementers[$interface][] = $name;
            }
        }

        foreach ($context->interfaces as $name => $interface) {
            foreach ($interface->parentInterfaces as $parent) {
                $this->implementers[$parent][] = $name;
            }
        }

        foreach ($context->reflectors as $name => $reflector) {
            if ($reflector instanceof Class_ || $reflector instanceof Trait_ || $reflector instanceof Enum_) {
                foreach ($reflector->getUsedTraits() as $trait) {
                    $this->traitUsers[ltrim((string) $trait, '\\')][] = $name;
                }
            }
        }
    }

    /**
     * Returns the kind of a type: `class`, `interface`, `trait` or `enum`.
     */
    public static function kind(TypeDoc $type): string
    {
        return match (true) {
            $type instanceof InterfaceDoc => 'interface',
            $type instanceof TraitDoc => 'trait',
            $type instanceof EnumDoc => 'enum',
            default => 'class',
        };
    }

    /**
     * Normalizes a type string: leading backslashes of names removed (`\yii\web\View` becomes `yii\web\View`).
     */
    public static function typeString(Type|string|null $type): ?string
    {
        if ($type === null) {
            return null;
        }

        $value = trim((string) preg_replace('/(?<![\w\\\\])\\\\(?=[A-Za-z_])/', '', (string) $type));

        return $value === '' ? null : $value;
    }

    /**
     * Returns a PHP expression on one line: whitespace collapsed, no trailing commas or padding inside brackets
     * (`['class' => ['alert-heading']]`).
     */
    public static function compactValue(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) preg_replace('/\s+/', ' ', $value));
        $value = (string) preg_replace('/,\s*([\])])/', '$1', $value);

        return (string) preg_replace(['/([\[(])\s+/', '/\s+([\])])/'], ['$1', '$1'], $value);
    }

    /**
     * Reads one type.
     *
     * @return TypeData
     */
    public function read(TypeDoc $type, Package $package): array
    {
        $name = (string) $type->name;
        $position = strrpos($name, '\\');
        $modifiers = [];

        if ($type instanceof ClassDoc) {
            if ($type->isAbstract) {
                $modifiers[] = 'abstract';
            }

            if ($type->isFinal) {
                $modifiers[] = 'final';
            }
        }

        if (isset($this->context->readonlyTypes[$name])) {
            $modifiers[] = 'readonly';
        }

        $properties = [];

        foreach ($type->properties as $property) {
            $properties[ltrim((string) $property->name, '$')] = $this->property($property, $name);
        }

        $methods = [];

        foreach ($type->methods as $method) {
            $methods[(string) $method->name] = $this->method($method, $name);
        }

        $constants = [];

        foreach ($type->constants as $constant) {
            $constants[(string) $constant->name] = $this->constant($constant, $name);
        }

        $events = [];

        foreach ($type->events as $event) {
            $events[(string) $event->name] = $this->event($event, $name);
        }

        $cases = [];

        if ($type instanceof EnumDoc) {
            foreach ($type->cases as $case) {
                $cases[$case->name] = [
                    'name' => $case->name,
                    'value' => $case->value,
                    'summary' => $case->shortDescription,
                    'description' => $case->description,
                ];
            }
        }

        uksort($properties, static fn(string $a, string $b): int => strcasecmp($a, $b));
        uksort($methods, static fn(string $a, string $b): int => strcasecmp($a, $b));

        return [
            'name' => $name,
            'shortName' => $position === false ? $name : substr($name, $position + 1),
            'namespace' => (string) $type->namespace,
            'kind' => self::kind($type),
            'modifiers' => $modifiers,
            'package' => $package->name,
            'file' => $package->repositoryPath((string) $type->sourceFile),
            'line' => (int) $type->startLine,
            'summary' => (string) $type->shortDescription,
            'description' => (string) $type->description,
            'since' => $type->since,
            'deprecated' => $this->deprecation($type),
            'extends' => $type instanceof ClassDoc ? $type->parentClass : null,
            'parents' => $type instanceof ClassDoc ? $this->parents($type) : [],
            'implements' => match (true) {
                $type instanceof ClassDoc, $type instanceof EnumDoc => array_values($type->interfaces),
                $type instanceof InterfaceDoc => array_values($type->parentInterfaces),
                default => [],
            },
            'traits' => $type instanceof ClassDoc || $type instanceof TraitDoc || $type instanceof EnumDoc
                ? array_values($type->traits)
                : [],
            'backingType' => $type instanceof EnumDoc ? $type->backingType : null,
            'properties' => $properties,
            'methods' => $methods,
            'constants' => $constants,
            'events' => $events,
            'cases' => $cases,
            'see' => $this->see($type),
            'subclasses' => $this->subclasses[$name] ?? [],
            'implementedBy' => $type instanceof InterfaceDoc ? ($this->implementers[$name] ?? []) : [],
            'usedBy' => $type instanceof TraitDoc ? ($this->traitUsers[$name] ?? []) : [],
        ];
    }

    /**
     * @return PropertyData
     */
    private function property(PropertyDoc $property, string $owner): array
    {
        $definedBy = (string) ($property->definedBy ?? $owner);
        $key = '$' . ltrim((string) $property->name, '$');
        $virtual = $property->startLine === null || $property->getter !== null || $property->setter !== null;
        $promoted = isset($this->context->promotedProperties[$definedBy][$key]);
        $default = $property->defaultValue;

        // An untyped property without a default is `null`; a typed or promoted one without a default has none.
        if (!$virtual && !$promoted && $default === null && $this->nativeType($definedBy, $key) === false) {
            $default = 'null';
        }

        $access = 'read-write';

        if ($virtual) {
            $access = match (true) {
                $property->getIsReadOnly() => 'read-only',
                $property->getIsWriteOnly() => 'write-only',
                $property->getter !== null => 'read-write',
                default => $this->context->propertyTagAccess[$definedBy][$key] ?? 'read-write',
            };
        }

        return [
            'name' => $key,
            'type' => self::typeString($property->type),
            'default' => self::compactValue($default),
            'visibility' => (string) ($property->visibility ?? 'public'),
            'static' => (bool) $property->isStatic,
            'readonly' => isset($this->context->readonlyProperties[$definedBy][$key]),
            'promoted' => $promoted,
            'virtual' => $virtual,
            'access' => $access,
            'summary' => (string) $property->shortDescription,
            'description' => (string) $property->description,
            'definedBy' => $definedBy,
            'since' => $property->since,
            'deprecated' => $this->deprecation($property),
        ];
    }

    /**
     * Returns whether the declared property has a native type, or `null` when it has no reflector.
     */
    private function nativeType(string $class, string $key): ?bool
    {
        $reflector = $this->context->reflectors[$class] ?? null;

        if (!$reflector instanceof Class_ && !$reflector instanceof Trait_) {
            return null;
        }

        foreach ($reflector->getProperties() as $property) {
            if ('$' . $property->getName() === $key) {
                return $property->getType() !== null;
            }
        }

        return null;
    }

    /**
     * @return MethodData
     */
    private function method(MethodDoc $method, string $owner): array
    {
        $definedBy = (string) ($method->definedBy ?? $owner);
        $arguments = $this->arguments($definedBy, (string) $method->name);
        $params = [];

        foreach ($method->params as $param) {
            $argument = $arguments[ltrim((string) $param->name, '$')] ?? null;

            $params[] = [
                'name' => (string) $param->name,
                'type' => self::typeString($param->type),
                'default' => self::compactValue($param->defaultValue),
                'optional' => (bool) $param->isOptional || ($argument?->isVariadic() ?? false),
                'byReference' => (bool) $param->isPassedByReference,
                'variadic' => $argument?->isVariadic() ?? false,
                'description' => trim((string) $param->description),
            ];
        }

        $throws = [];

        foreach ($method->exceptions as $exception) {
            $throws[] = [
                'type' => (string) self::typeString($exception->getType()),
                'description' => trim((string) $exception->getDescription()),
            ];
        }

        $returnType = self::typeString($method->returnType);

        return [
            'name' => (string) $method->name,
            'visibility' => (string) ($method->visibility ?? 'public'),
            'static' => (bool) $method->isStatic,
            'abstract' => (bool) $method->isAbstract,
            'final' => (bool) $method->isFinal,
            'virtual' => $method->startLine === null,
            'params' => $params,
            'returnType' => $method->name === '__construct' ? null : $returnType,
            'return' => trim((string) $method->return),
            'throws' => $throws,
            'summary' => (string) $method->shortDescription,
            'description' => (string) $method->description,
            'definedBy' => $definedBy,
            'since' => $method->since,
            'deprecated' => $this->deprecation($method),
            'see' => $this->see($method),
        ];
    }

    /**
     * Returns the reflection arguments of a method by name, for the `variadic` flag apidoc does not keep.
     *
     * @return array<string, Argument>
     */
    private function arguments(string $class, string $method): array
    {
        $reflector = $this->context->reflectors[$class] ?? null;

        if ($reflector === null) {
            return [];
        }

        foreach ($reflector->getMethods() as $candidate) {
            if ($candidate->getName() === $method) {
                $arguments = [];

                foreach ($candidate->getArguments() as $argument) {
                    $arguments[$argument->getName()] = $argument;
                }

                return $arguments;
            }
        }

        return [];
    }

    /**
     * @return ConstantData
     */
    private function constant(ConstDoc $constant, string $owner): array
    {
        return [
            'name' => (string) $constant->name,
            'value' => self::compactValue($constant->value),
            'summary' => (string) $constant->shortDescription,
            'description' => (string) $constant->description,
            'definedBy' => (string) ($constant->definedBy ?? $owner),
            'since' => $constant->since,
            'deprecated' => $this->deprecation($constant),
        ];
    }

    /**
     * @return EventData
     */
    private function event(EventDoc $event, string $owner): array
    {
        $description = trim((string) $event->description);
        $summary = trim((string) $event->shortDescription);

        return [
            'name' => (string) $event->name,
            'value' => $event->value,
            'type' => self::typeString($event->type),
            'summary' => $summary,
            'description' => $description === $summary ? '' : $description,
            'definedBy' => (string) ($event->definedBy ?? $owner),
            'since' => $event->since,
        ];
    }

    /**
     * @return Deprecation|null
     */
    private function deprecation(BaseDoc $doc): ?array
    {
        if ($doc->deprecatedSince === null && $doc->deprecatedReason === null) {
            return null;
        }

        return ['version' => $doc->deprecatedSince, 'reason' => trim((string) $doc->deprecatedReason)];
    }

    /**
     * Returns the `@see` references of a docblock as written (`Widget::end()`, a URL).
     *
     * @return list<string>
     */
    private function see(BaseDoc $doc): array
    {
        $result = [];

        foreach ($doc->tags as $tag) {
            if ($tag instanceof See) {
                $reference = trim((string) $tag->getReference());
                $description = trim((string) $tag->getDescription());

                if ($reference !== '') {
                    $result[] = $description === '' ? $reference : $reference . ' ' . $description;
                }
            }
        }

        return $result;
    }

    /**
     * Returns the parent chain of a class, nearest first; the first undocumented ancestor ends it.
     *
     * @return list<string>
     */
    private function parents(ClassDoc $class): array
    {
        $result = [];
        $current = $class;

        while (
            $current instanceof ClassDoc
            && $current->parentClass !== null
            && !in_array($current->parentClass, $result, true)
        ) {
            $result[] = $current->parentClass;
            $next = $this->context->getType($current->parentClass);
            $current = $next instanceof ClassDoc ? $next : null;
        }

        return $result;
    }
}

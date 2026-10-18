<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Model;

use phpDocumentor\Reflection\Php\Class_;
use phpDocumentor\Reflection\Php\Enum_;
use phpDocumentor\Reflection\Php\File;
use phpDocumentor\Reflection\Php\Interface_;
use phpDocumentor\Reflection\Php\Project;
use phpDocumentor\Reflection\Php\Trait_;
use yii\apidoc\models\ClassDoc;
use yii\apidoc\models\Context;
use yii\apidoc\models\InterfaceDoc;
use yii\apidoc\models\PropertyDoc;
use yii\apidoc\helpers\TextHelper;
use yii\apidoc\models\TraitDoc;

use function array_map;
use function array_filter;
use function array_values;
use function count;
use function lcfirst;
use function str_starts_with;
use function strlen;
use function substr;
use function ltrim;

/**
 * Extends the yii2-apidoc {@see Context} with enums, reflection lookups and declared (not inherited) relations.
 *
 * {@see Context::getReflectionProject()} parses every file again on each call; this context parses once and keeps
 * the project, so the reflectors can be used after {@see processFiles()} to repair the model.
 */
final class ReferenceContext extends Context
{
    /**
     * @var array<string, EnumDoc> Enums by fully qualified name.
     */
    public array $enums = [];
    /**
     * @var array<string, list<string>> Interfaces declared by each class (before inheritance is merged).
     */
    public array $declaredInterfaces = [];
    /**
     * @var array<string, Class_|Interface_|Trait_|Enum_> Reflectors by fully qualified type name.
     */
    public array $reflectors = [];
    /**
     * @var array<string, File> Reflection files by path.
     */
    public array $reflectionFiles = [];
    /**
     * @var array<string, true> `readonly` classes by name (set by {@see ModelRepairer}).
     */
    public array $readonlyTypes = [];
    /**
     * @var array<string, array<string, true>> `readonly` properties (`$name`) by declaring type.
     */
    public array $readonlyProperties = [];
    /**
     * @var array<string, array<string, true>> Constructor-promoted properties (`$name`) by declaring type.
     */
    public array $promotedProperties = [];
    /**
     * @var array<string, array<string, string>> Access (`read-only`, `write-only`, `read-write`) of the `@property`,
     * `@property-read` and `@property-write` tags (`$name`) by declaring type.
     */
    public array $propertyTagAccess = [];

    /**
     * @var array<string, string> Verified external type/member targets, keyed by canonical PHP name.
     */
    public array $externalReferences = [];
    /**
     * @var array<string, string> Repository file URLs for documented types, without a line fragment.
     */
    public array $sourceUrls = [];

    private ?Project $project = null;

    /**
     * Returns the reflection project, parsed once.
     */
    public function getReflectionProject(): Project
    {
        return $this->project ??= parent::getReflectionProject();
    }

    /**
     * Parses the added files into classes, interfaces and traits (yii2-apidoc), then adds the enums and indexes the
     * reflectors.
     */
    public function processFiles(): void
    {
        parent::processFiles();

        foreach ($this->getReflectionProject()->getFiles() as $path => $file) {
            $this->reflectionFiles[$path] = $file;

            foreach ([...$file->getClasses(), ...$file->getInterfaces(), ...$file->getTraits()] as $reflector) {
                $this->reflectors[ltrim((string) $reflector->getFqsen(), '\\')] = $reflector;
            }

            foreach ($file->getEnums() as $reflector) {
                $name = ltrim((string) $reflector->getFqsen(), '\\');
                $this->reflectors[$name] = $reflector;
                $this->enums[$name] = new EnumDoc($reflector, $this, ['sourceFile' => $path]);
            }
        }

        foreach ($this->classes as $name => $class) {
            $this->declaredInterfaces[$name] = array_map(
                static fn(object $fqsen): string => ltrim((string) $fqsen, '\\'),
                $this->reflectors[$name] instanceof Class_ ? $this->reflectors[$name]->getInterfaces() : [],
            );
        }
    }

    /**
     * Binds Yii accessors without confusing PHP fields with class-level `@property` tags.
     *
     * Declared fields keep their visibility, type and default. A public field is accessed directly by PHP; its
     * similarly named method remains an independent API. Protected fields keep their declaration while their
     * accessors remain documented methods. Virtual tags keep their descriptions and bind to actual accessors.
     */
    protected function handlePropertyFeature($class): void
    {
        if (!$this->isSubclassOf($class, 'yii\base\BaseObject')) {
            return;
        }

        foreach ($class->getPublicMethods() as $name => $method) {
            if ($method->isStatic || strlen($name) <= 3) {
                continue;
            }

            $required = array_values(array_filter($method->params, static fn($param): bool => !$param->isOptional));
            $getter = str_starts_with($name, 'get') && $required === [];
            $setter = str_starts_with($name, 'set') && count($required) <= 1 && $method->params !== [];

            if (!$getter && !$setter) {
                continue;
            }

            $key = '$' . lcfirst(substr($name, 3));
            $property = $class->properties[$key] ?? null;

            // PHP fields and their independently callable methods can coexist without a conflict.
            if ($property !== null && $property->startLine !== null) {
                continue;
            }

            // Getter metadata takes precedence over a synthesized setter property, but not an explicit tag.
            $replaceSetter = $getter && $property !== null && $property->getter === null && $property->setter !== null
                && !isset($this->propertyTagAccess[$property->definedBy][$key]);

            if ($property === null || $replaceSetter) {
                $param = array_values($method->params)[0] ?? null;
                $descriptions = TextHelper::getDescriptionsByFullDescription(
                    (string) ($getter ? $method->return : $param?->description),
                );
                $property = new PropertyDoc($class, null, $this, [
                    'name' => $key,
                    'fullName' => $class->name . '::' . $key,
                    'definedBy' => $method->definedBy,
                    'sourceFile' => $method->sourceFile,
                    'visibility' => 'public',
                    'isStatic' => false,
                    'type' => $getter ? $method->returnType : $param?->type,
                    'shortDescription' => $descriptions['short'],
                    'description' => $descriptions['detailed'],
                    'since' => $method->since,
                    'setter' => $property?->setter,
                ]);
            } else {
                // Inherited tags are shared by apidoc; binding an override must not mutate the parent model.
                $property = clone $property;
            }

            if ($getter) {
                $property->getter = $method;
            } else {
                $property->setter = $method;
            }

            $class->properties[$key] = $property;
        }
    }

    /**
     * Returns the type (class, interface, trait or enum) with the given name.
     *
     * @param string $type
     */
    public function getType($type): ClassDoc|InterfaceDoc|TraitDoc|EnumDoc|null
    {
        return parent::getType($type) ?? $this->enums[ltrim($type, '\\')] ?? null;
    }
}

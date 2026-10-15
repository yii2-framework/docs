<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Link;

use phpDocumentor\Reflection\Types\ContextFactory;
use ReflectionClass;
use ReflectionFunction;
use Throwable;
use yii\apidoc\models\BaseDoc;
use yii\apidoc\models\ClassDoc;
use yii\apidoc\models\ConstDoc;
use yii\apidoc\models\EventDoc;
use yii\apidoc\models\InterfaceDoc;
use yii\apidoc\models\MethodDoc;
use yii\apidoc\models\PropertyDoc;
use yii\apidoc\models\TypeDoc;
use Yii2Docs\Tools\Model\EnumCaseDoc;
use Yii2Docs\Tools\Model\EnumDoc;
use Yii2Docs\Tools\Model\ReferenceContext;
use Yii2Docs\Tools\Render\Anchor;

use function array_shift;
use function class_exists;
use function enum_exists;
use function explode;
use function file_get_contents;
use function filter_var;
use function function_exists;
use function implode;
use function interface_exists;
use function is_file;
use function ltrim;
use function preg_match;
use function str_contains;
use function str_ends_with;
use function str_replace;
use function str_starts_with;
use function strpos;
use function strrpos;
use function strtolower;
use function substr;
use function trim;

use const FILTER_VALIDATE_URL;

/**
 * Resolves the targets of `[[...]]`, `{@see ...}` and `{@link ...}` references to documented types and members.
 *
 * Follows the rules of yii2-apidoc (`ApiMarkdownTrait::parseApiLinkForContext()`): a bare name is looked up as a
 * member of the context type and its traits, interfaces and parents, then as a type; `Type::member` resolves `Type`
 * through the imports (`use`) of the context file, then relative to its namespace, then as an absolute name. Unlike
 * apidoc, the imports come from the context file itself (apidoc reads them from the class docblock, which may be
 * missing), and enums are known. PHP built-in classes and functions resolve to php.net.
 */
final class LinkResolver
{
    private const PHP_MANUAL = 'https://www.php.net/manual/en/';

    /**
     * @var array<string, array<string, string>> Import aliases (lower-cased alias to name) by file and namespace.
     */
    private array $aliases = [];

    public function __construct(private readonly ReferenceContext $context)
    {
    }

    /**
     * Resolves a reference target as written in a docblock or guide.
     *
     * @param string $target `yii\base\Widget`, `Widget::begin()`, `$id`, `begin()`, `EVENT_INIT`, a URL, ...
     * @param TypeDoc|null $context Type whose docblock holds the reference, for relative names and imports.
     *
     * @return Resolution|null `null` when the target is unknown.
     */
    public function resolve(string $target, ?TypeDoc $context): ?Resolution
    {
        $target = trim($target);

        if ($target === '' || preg_match('/^[\\\\\w():$]+$/', $target) !== 1) {
            return filter_var($target, FILTER_VALIDATE_URL) !== false
                ? new Resolution(null, null, '', $target, $target, $target)
                : null;
        }

        if (($position = strpos($target, '::')) !== false) {
            $typeName = substr($target, 0, $position);
            $member = substr($target, $position + 2);
            $type = $this->findTypeInContexts($typeName, $context);

            if ($type === null) {
                return $this->external(ltrim($typeName, '\\'), $member);
            }

            if ($member === '') {
                return $this->typeResolution($type);
            }

            $subject = $this->findMember($type, $member);

            if ($subject === null) {
                return $this->externalAncestor($type, $member);
            }

            return $this->memberResolution($type, $subject, $this->shortName($type) . '::');
        }

        if ($context !== null && !str_contains($target, '\\')) {
            foreach ($this->contexts($context) as $candidate) {
                $subject = $this->findMember($candidate, $target);

                if ($subject !== null) {
                    return $this->memberResolution($candidate, $subject, '');
                }
            }
        }

        $type = $this->findTypeInContexts($target, $context);

        if ($type !== null) {
            return $this->typeResolution($type);
        }

        // phpDocumentor renders an inline `{@see begin()}` of a description as `{@see \<namespace>\begin()}`: when
        // the qualified name is no type, look its last segment up as a member of the context.
        if ($context !== null && ($position = strrpos($target, '\\')) !== false) {
            $member = substr($target, $position + 1);

            foreach ($this->contexts($context) as $candidate) {
                $subject = $member === '' ? null : $this->findMember($candidate, $member);

                if ($subject !== null) {
                    return $this->memberResolution($candidate, $subject, '');
                }
            }
        }

        return str_ends_with($target, '()')
            ? $this->externalFunction(ltrim(substr($target, 0, -2), '\\'))
            : $this->external(ltrim($target, '\\'), '');
    }

    /**
     * Finds a documented type by a name as written in the context file.
     */
    public function findType(string $name, ?TypeDoc $context): ?TypeDoc
    {
        if ($name === '') {
            return null;
        }

        if ($context !== null && ($name === 'self' || $name === 'static' || $name === '$this')) {
            return $context;
        }

        if (str_starts_with($name, '\\')) {
            return $this->context->getType($name);
        }

        $candidates = [];

        if ($context !== null) {
            $aliases = $this->aliases($context);
            $parts = explode('\\', $name);
            $first = strtolower((string) array_shift($parts));

            if (isset($aliases[$first])) {
                $candidates[] = implode('\\', [$aliases[$first], ...$parts]);
            }

            if ($context->namespace !== '') {
                $candidates[] = $context->namespace . '\\' . $name;
            }
        }

        $candidates[] = $name;

        foreach ($candidates as $candidate) {
            $type = $this->context->getType($candidate);

            if ($type !== null) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Finds a type by name in the context type, then in its traits, interfaces and parents (each with the imports
     * and namespace of its own file), as apidoc does.
     */
    public function findTypeInContexts(string $name, ?TypeDoc $context): ?TypeDoc
    {
        if ($context === null) {
            return $this->findType($name, null);
        }

        foreach ($this->contexts($context) as $candidate) {
            $type = $this->findType($name, $candidate);

            if ($type !== null) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Finds a member of a type (inherited members included): `name()` is a method, `$name` a property, `name` a
     * method, then a property, then a constant, event or enum case.
     */
    public function findMember(TypeDoc $type, string $member): BaseDoc|EnumCaseDoc|null
    {
        $member = trim($member);

        if ($member === '' || $member === '()' || $member === '$') {
            return null;
        }

        if ($type instanceof EnumDoc && isset($type->cases[$member])) {
            return $type->cases[$member];
        }

        $subject = $type->findSubject($member);

        if ($subject !== null) {
            return $subject;
        }

        return $type->constants[$member] ?? $type->events[$member] ?? null;
    }

    /**
     * Returns the member key used by the link map: `name()`, `$name` or `NAME`.
     */
    public static function memberKey(BaseDoc|EnumCaseDoc $subject): string
    {
        return match (true) {
            $subject instanceof MethodDoc => $subject->name . '()',
            $subject instanceof PropertyDoc => '$' . ltrim((string) $subject->name, '$'),
            $subject instanceof EnumCaseDoc => $subject->name,
            default => (string) $subject->name,
        };
    }

    /**
     * Returns the anchor of a member on the page of its defining type.
     */
    public static function memberAnchor(BaseDoc|EnumCaseDoc $subject): string
    {
        return match (true) {
            $subject instanceof MethodDoc => Anchor::method((string) $subject->name),
            $subject instanceof PropertyDoc => Anchor::property((string) $subject->name),
            $subject instanceof EventDoc => Anchor::event((string) $subject->name),
            $subject instanceof ConstDoc => Anchor::constant((string) $subject->name),
            $subject instanceof EnumCaseDoc => Anchor::enumCase($subject->name),
            default => '',
        };
    }

    /**
     * Returns the type itself, its traits and interfaces and its parents, recursively (the lookup order of apidoc).
     *
     * @return list<TypeDoc>
     */
    private function contexts(TypeDoc $type): array
    {
        $result = [];
        $queue = [$type];
        $seen = [];

        while ($queue !== []) {
            $current = array_shift($queue);

            if ($current === null || isset($seen[$current->name])) {
                continue;
            }

            $seen[$current->name] = true;
            $result[] = $current;
            $related = [];

            if ($current instanceof ClassDoc || $current instanceof EnumDoc) {
                $related = [...$current->traits, ...$current->interfaces];

                if ($current instanceof ClassDoc && $current->parentClass !== null) {
                    $related[] = $current->parentClass;
                }
            } elseif ($current instanceof InterfaceDoc) {
                $related = $current->parentInterfaces;
            }

            foreach ($related as $name) {
                $queue[] = $this->context->getType($name);
            }
        }

        return $result;
    }

    /**
     * Returns the import aliases of the file that declares `$type`.
     *
     * @return array<string, string>
     */
    private function aliases(TypeDoc $type): array
    {
        $file = (string) $type->sourceFile;
        $key = $file . '#' . $type->namespace;

        if (!isset($this->aliases[$key])) {
            $aliases = [];

            if (is_file($file)) {
                try {
                    $context = (new ContextFactory())->createForNamespace(
                        (string) $type->namespace,
                        (string) file_get_contents($file),
                    );

                    foreach ($context->getNamespaceAliases() as $alias => $name) {
                        $aliases[strtolower((string) $alias)] = ltrim((string) $name, '\\');
                    }
                } catch (Throwable) {
                    // A file the tokenizer cannot read keeps no aliases; the namespace and absolute lookups remain.
                }
            }

            $this->aliases[$key] = $aliases;
        }

        return $this->aliases[$key];
    }

    private function typeResolution(TypeDoc $type): Resolution
    {
        return new Resolution($type->name, null, '', (string) $type->name, $this->shortName($type));
    }

    private function memberResolution(TypeDoc $type, BaseDoc|EnumCaseDoc $subject, string $prefix): Resolution
    {
        $definer = $subject instanceof EnumCaseDoc ? $type->name : ($subject->definedBy ?? $type->name);
        $key = self::memberKey($subject);

        return new Resolution(
            (string) $definer,
            $key,
            self::memberAnchor($subject),
            $type->name . '::' . $key,
            $prefix . $key,
        );
    }

    private function shortName(TypeDoc $type): string
    {
        $name = (string) $type->name;
        $position = strrpos($name, '\\');

        return $position === false ? $name : substr($name, $position + 1);
    }

    /**
     * Resolves a PHP built-in class or interface (and optionally a member) to its php.net page.
     */
    private function external(string $name, string $member): ?Resolution
    {
        if (
            $name === ''
            || str_contains($name, '$')
            || !(class_exists($name, false) || interface_exists($name, false) || enum_exists($name, false))
        ) {
            return null;
        }

        $reflection = new ReflectionClass($name);

        if (!$reflection->isInternal()) {
            return null;
        }

        $canonical = $member === '' ? $reflection->getName() : $reflection->getName() . '::' . $member;
        $url = self::PHP_MANUAL . 'class.' . strtolower($reflection->getName()) . '.php';

        return new Resolution(null, null, '', $canonical, $canonical, $url);
    }

    /**
     * Resolves a member that a documented class inherits from a PHP built-in class (`PDO::PARAM_STR` on a `PDO`
     * subclass) to the php.net page of that class.
     */
    private function externalAncestor(TypeDoc $type, string $member): ?Resolution
    {
        $current = $type;

        while ($current instanceof ClassDoc && $current->parentClass !== null) {
            $parent = $this->context->getType($current->parentClass);

            if ($parent === null) {
                return $this->external($current->parentClass, $member);
            }

            $current = $parent;
        }

        return null;
    }

    /**
     * Resolves a PHP built-in function (`strlen`) to its php.net page.
     */
    private function externalFunction(string $name): ?Resolution
    {
        if ($name === '' || str_contains($name, '\\') || !function_exists($name)) {
            return null;
        }

        if (!(new ReflectionFunction($name))->isInternal()) {
            return null;
        }

        $url = self::PHP_MANUAL . 'function.' . str_replace('_', '-', strtolower($name)) . '.php';

        return new Resolution(null, null, '', $name . '()', $name . '()', $url);
    }
}

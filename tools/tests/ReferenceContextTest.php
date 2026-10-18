<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests;

use PHPUnit\Framework\TestCase;
use Yii2Docs\Tools\Model\ModelRepairer;
use Yii2Docs\Tools\Link\LinkResolver;
use Yii2Docs\Tools\Model\ReferenceContext;

/**
 * Verifies property-tag binding, field preservation and accessor eligibility in the reference model.
 */
final class ReferenceContextTest extends TestCase
{
    private ReferenceContext $context;
    private string $fixture;

    protected function setUp(): void
    {
        $this->fixture = tempnam(sys_get_temp_dir(), 'reference-properties-');
        file_put_contents($this->fixture, <<<'SOURCE'
            <?php
            namespace fixture;
            use Vendor\External as Imported;
            /** Local function shadowing the PHP builtin. */
            function get_object_vars($value) { return []; }
            /**
             * Parent with documented virtual properties and declared fields.
             * @property-read string $label Canonical label description.
             * @property string $value Canonical value description.
             */
            class ParentObject extends \yii\base\BaseObject
            {
                /** @var string Direct field description. */
                public $language = 'en';
                /** @var string Protected backing field. */
                protected $error = 'none';
                /** @return string Label accessor. */
                public function getLabel() { return 'parent'; }
                /** @return string Value accessor. */
                public function getValue() { return 'value'; }
                /** @param string $value New value. */
                public function setValue($value) {}
                /** @return string Independent language method. */
                public function getLanguage() { return 'method'; }
                /** @param string $language New language. */
                public function setLanguage($language) {}
                /** @return string Error accessor. */
                public function getError() { return $this->error; }
                /** @return string Static methods are not accessors. */
                public static function getStaticValue() { return ''; }
                /** @return string Requires a key. */
                public function getRequired($key) { return $key; }
                /** @param string $value Optional new value. */
                public function setOptional($value = '') {}
                /** @param string $value New value. */
                public function setTooMany($value, $other) {}
                public $undocumented;
                /** Private state. */
                private $secret;
                /** Private helper. */
                private function hidden() {}
                /**
                 * Restored field summary.
                 * @var string
                 */
                public $documented = '';
                /**
                 * @param string $promoted Promoted field description.
                 */
                public function __construct(public string $promoted) {}
            }
            /** Child overrides the label accessor. */
            class ChildObject extends ParentObject
            {
                /** @return string Child label. */
                public function getLabel() { return 'child'; }
            }
            /** An ordinary PHP class has no Yii magic-property contract. */
            class PlainObject
            {
                /** @return string Ordinary method. */
                public function getLabel() { return ''; }
            }
            /** An untagged property declared through a setter before its getter. */
            class SetterFirst extends \yii\base\BaseObject
            {
                /** @param string|null $value Optional source value. */
                public function setValue($value) {}
                /** @return string The normalized value. */
                public function getValue() { return ''; }
                /** @param int $threshold Required threshold. */
                public function setThreshold($threshold) {}
            }
            /** Same accessor contract with the getter first. */
            class GetterFirst extends \yii\base\BaseObject
            {
                /** @return string The normalized value. */
                public function getValue() { return ''; }
                /** @param string|null $value Optional source value. */
                public function setValue($value) {}
            }
            /**
             * An explicit property contract takes precedence over either accessor.
             * @property string|null $value Canonical nullable value.
             */
            class TaggedSetterFirst extends SetterFirst {}
            SOURCE);
        $this->context = new ReferenceContext();
        $base = __DIR__ . '/fixtures/framework/base/';
        $this->context->addFile($base . 'Configurable.php');
        $this->context->addFile($base . 'BaseObject.php');
        $this->context->addFile($this->fixture);
        $this->context->processFiles();
        (new ModelRepairer($this->context))->repair();
        $this->context->updateReferences();
    }

    protected function tearDown(): void
    {
        unlink($this->fixture);
    }

    public function testVirtualTagsBindAccessorsWithoutLosingDescriptionsOrMutatingParents(): void
    {
        $parent = $this->context->classes['fixture\ParentObject'];
        $child = $this->context->classes['fixture\ChildObject'];
        self::assertSame([], $this->context->errors);
        self::assertSame('Canonical label description.', $child->properties['$label']->shortDescription);
        self::assertSame('fixture\ParentObject', $parent->properties['$label']->getter->definedBy);
        self::assertSame('fixture\ChildObject', $child->properties['$label']->getter->definedBy);
        self::assertNotSame($parent->properties['$label'], $child->properties['$label']);
        self::assertSame('getValue', $child->properties['$value']->getter->name);
        self::assertSame('setValue', $child->properties['$value']->setter->name);
    }

    public function testDeclaredPublicAndProtectedFieldsKeepTheirContract(): void
    {
        $class = $this->context->classes['fixture\ChildObject'];
        $field = $class->properties['$language'];
        self::assertNotNull($field->startLine);
        self::assertSame('public', $field->visibility);
        self::assertSame("'en'", $field->defaultValue);
        self::assertNull($field->getter);
        self::assertNull($field->setter);
        self::assertSame('protected', $class->properties['$error']->visibility);
        self::assertNull($class->properties['$error']->getter);
        self::assertArrayHasKey('getError', $class->methods);
        self::assertArrayHasKey('getLanguage', $class->methods);
    }

    public function testStaticAndRequiredArgumentMethodsDoNotCreateVirtualProperties(): void
    {
        $class = $this->context->classes['fixture\ChildObject'];
        foreach (['$staticValue', '$required', '$tooMany'] as $key) {
            self::assertArrayNotHasKey($key, $class->properties);
        }
        self::assertSame('setOptional', $class->properties['$optional']->setter->name);
        self::assertSame([], $this->context->classes['fixture\PlainObject']->properties);
    }

    public function testSetterPropertiesReadNamedParametersIncludingOptionalValues(): void
    {
        $class = $this->context->classes['fixture\SetterFirst'];
        self::assertArrayHasKey('$threshold', $class->methods['setThreshold']->params);
        $property = $class->properties['$threshold'];
        self::assertSame('int', (string) $property->type);
        self::assertSame('Required threshold.', $property->shortDescription);
        self::assertSame('setThreshold', $property->setter->name);
        self::assertNull($property->getter);

        $optional = $this->context->classes['fixture\ParentObject']->properties['$optional'];
        self::assertSame('string', (string) $optional->type);
        self::assertSame('Optional new value.', $optional->shortDescription);
    }

    public function testGetterMetadataDoesNotDependOnAccessorOrderOrReplaceExplicitTags(): void
    {
        foreach (['fixture\SetterFirst', 'fixture\GetterFirst'] as $name) {
            $property = $this->context->classes[$name]->properties['$value'];
            self::assertSame('string', (string) $property->type);
            self::assertSame('The normalized value.', $property->shortDescription);
            self::assertSame('getValue', $property->getter->name);
            self::assertSame('setValue', $property->setter->name);
        }

        $tagged = $this->context->classes['fixture\TaggedSetterFirst']->properties['$value'];
        self::assertSame('string|null', (string) $tagged->type);
        self::assertSame('Canonical nullable value.', $tagged->shortDescription);
        self::assertSame('getValue', $tagged->getter->name);
        self::assertSame('setValue', $tagged->setter->name);
    }

    public function testRecoveredPropertyDescriptionsRemoveOnlyTheirOwnWarnings(): void
    {
        $class = $this->context->classes['fixture\ParentObject'];
        self::assertSame('Restored field summary.', $class->properties['$documented']->shortDescription);
        self::assertSame('Promoted field description.', $class->properties['$promoted']->shortDescription);
        $messages = array_column($this->context->warnings, 'message');
        self::assertNotContains("No short description for element '\$documented'", $messages);
        self::assertNotContains("No docblock for element '\$promoted'", $messages);
        self::assertContains("No short description for Method '__construct'", $messages);
    }

    public function testExternalReferencesUseImportsAndDoNotInventUnknownMembers(): void
    {
        $this->context->externalReferences = [
            'Vendor\External' => 'https://example.test/reference/External',
            'Vendor\External::id()' => 'https://example.test/reference/External#id',
        ];
        $resolver = new LinkResolver($this->context);
        $type = $this->context->classes['fixture\ParentObject'];
        self::assertSame('https://example.test/reference/External', $resolver->resolve('Imported', $type)->externalUrl);
        self::assertSame('https://example.test/reference/External#id', $resolver->resolve('Imported::id()', $type)->externalUrl);
        self::assertNull($resolver->resolve('Imported::missing()', $type));
        self::assertNull($resolver->resolve('\Other\External', $type));
    }

    public function testParserQualifiedBuiltinsResolveOnlyInTheDeclaringNamespace(): void
    {
        $resolver = new LinkResolver($this->context);
        $type = $this->context->classes['fixture\ParentObject'];
        self::assertSame('https://www.php.net/manual/en/function.call-user-func.php',
            $resolver->resolve('\fixture\call_user_func()', $type)->externalUrl);
        self::assertNull($resolver->resolve('\another\call_user_func()', $type));
        self::assertNull($resolver->resolve('\fixture\unknown_function()', $type));
        self::assertNull($resolver->resolve('\fixture\get_object_vars()', $type));
        self::assertNull($resolver->resolve('\another\hidden()', $type));
    }

    public function testPrivateMembersLinkToVerifiedSourceWithoutPublicCatalogEntries(): void
    {
        $type = $this->context->classes['fixture\ParentObject'];
        $this->context->sourceUrls[$type->name] = 'https://example.test/source/ParentObject.php';
        $resolver = new LinkResolver($this->context);
        self::assertArrayNotHasKey('$secret', $type->properties);
        self::assertArrayNotHasKey('hidden', $type->methods);
        self::assertStringStartsWith('https://example.test/source/ParentObject.php#L',
            $resolver->resolve('$secret', $type)->externalUrl);
        self::assertStringStartsWith('https://example.test/source/ParentObject.php#L',
            $resolver->resolve('\fixture\hidden()', $type)->externalUrl);
        self::assertNull($resolver->resolve('$missing', $type));
    }

    public function testGenuinelyUndocumentedFieldStillProducesWarnings(): void
    {
        self::assertNotEmpty(array_filter(
            $this->context->warnings,
            static fn(array $warning): bool => str_contains($warning['message'], "'\$undocumented'"),
        ));
    }
}

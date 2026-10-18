<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests;

use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Yii2Docs\Tools\Cli\ReferenceCommand;

use function bin2hex;
use function dirname;
use function file_get_contents;
use function file_put_contents;
use function fopen;
use function json_decode;
use function json_encode;
use function mkdir;
use function random_bytes;
use function rewind;
use function rmdir;
use function stream_get_contents;
use function sys_get_temp_dir;
use function unlink;

use const JSON_THROW_ON_ERROR;

/**
 * End-to-end tests for {@see ReferenceCommand} on the fixture framework and package under `tests/fixtures`: page
 * layout, anchors, table escaping, enum rendering, model repairs, `reference.json` against its schema and the link map.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class GenerationTest extends TestCase
{
    private static string $root = '';
    private static int $exitCode = -1;
    private static string $output = '';

    public static function setUpBeforeClass(): void
    {
        $fixtures = dirname(__DIR__) . '/tests/fixtures';
        self::$root = sys_get_temp_dir() . '/reference-test-' . bin2hex(random_bytes(6));
        mkdir(self::$root . '/.cache', 0777, true);
        mkdir(self::$root . '/src/content/docs/guide', 0777, true);
        file_put_contents(self::$root . '/src/content/docs/guide/structure-widgets.md', "---\ntitle: Widgets\n---\n");
        file_put_contents(self::$root . '/packages.json', json_encode([
            [
                'name' => 'yii2', 'title' => 'Yii', 'type' => 'framework', 'repo' => 'https://github.com/o/yii2',
                'ref' => '22.0', 'srcDir' => 'framework', 'namespace' => 'yii', 'localPath' => 'x',
                'packagist' => 'fixture/framework',
            ],
            [
                'name' => 'pkg', 'title' => 'Pkg', 'repo' => 'https://github.com/o/pkg', 'ref' => 'main',
                'docsDir' => 'docs', 'srcDir' => 'src', 'namespace' => 'vendor\pkg', 'localPath' => 'y',
                'packagist' => 'fixture/package',
            ],
        ], JSON_THROW_ON_ERROR));
        file_put_contents(self::$root . '/.cache/sources.json', json_encode([
            'mode' => 'clone',
            'packages' => [
                'yii2' => ['dir' => $fixtures, 'commit' => 'abc', 'skipped' => null],
                'pkg' => ['dir' => $fixtures . '/package', 'commit' => 'def', 'skipped' => null],
            ],
        ], JSON_THROW_ON_ERROR));

        $out = fopen('php://memory', 'w+');
        $err = fopen('php://memory', 'w+');
        self::$exitCode = (new ReferenceCommand(self::$root, $out, $err))->run([]);
        rewind($out);
        rewind($err);
        self::$output = stream_get_contents($out) . stream_get_contents($err);
    }

    public static function tearDownAfterClass(): void
    {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(self::$root, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $entry) {
            $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
        }

        rmdir(self::$root);
    }

    public function testRunSucceedsAndReportsEveryPackage(): void
    {
        self::assertSame(0, self::$exitCode, 'Exit code must be 0. Output: ' . self::$output);
        self::assertStringContainsString('[reference] yii2: 6 types', self::$output, 'Framework count.');
        self::assertStringContainsString('[reference] pkg: 4 types', self::$output, 'Package count.');
    }

    public function testEnumPageListsCasesWithBackingType(): void
    {
        $page = $this->page('extensions/pkg/reference/enum/Theme.md');

        self::assertStringContainsString(
            '| <span class="api-badge api-badge-enum">enum</span> | `vendor\pkg\enum\Theme` |',
            $page,
            'Kind badge and full name.',
        );
        self::assertStringContainsString("\n| Backed by | `string` |\n", $page, 'Backing type row.');
        self::assertStringContainsString('## Cases', $page, 'Cases section.');
        self::assertStringContainsString(
            "| <span id=\"case-PRIMARY\"></span>`PRIMARY` | `'primary'` | Applies the primary color. |",
            $page,
            'Case row with anchor, value and summary.',
        );
    }

    public function testPromotedPropertiesTakeConstructorParamTextAndHaveNoFakeDefault(): void
    {
        $page = $this->page('extensions/pkg/reference/item/Item.md');

        self::assertStringContainsString(
            '<span class="api-badge api-badge-class">final readonly class</span>',
            $page,
            'Modifiers in order.',
        );
        self::assertStringContainsString(
            '| <span id="property-label"></span>`$label` <span class="api-flag">readonly</span> '
            . '<span class="api-flag">constructor</span> | `string` | Label of the item. | `Item` |',
            $page,
            'Required property: no default, `@param` text.',
        );
        self::assertStringContainsString(
            '<span class="api-flag">constructor</span> | `array<string, mixed>` | HTML attributes of the item. '
            . 'Default: `[]`. |',
            $page,
            'Generic type from `@param`.',
        );
    }

    public function testVarSummaryFallbackAndImportedShortNames(): void
    {
        $page = $this->page('extensions/pkg/reference/Alert.md');

        self::assertStringContainsString(
            '| Theme color of the alert. Default: `null`. |',
            $page,
            'Summary above `@var` must be kept.',
        );
        self::assertStringContainsString(
            '[`View::POS_END`](../../../api/yii/web/View.md#const-POS_END)',
            $page,
            'Imported short class name must resolve.',
        );
        self::assertStringContainsString(
            '[`begin()`](../../../api/yii/base/Widget.md#method-begin)',
            $page,
            'Inherited method must link to its definer.',
        );
        self::assertStringContainsString('`$rows` | `list<int>` | Rows of the alert. |', $page, 'Typed, no default.');
        self::assertStringContainsString(
            'Default: `[]`. | [`yii\base\Widget`](../../../api/yii/base/Widget.md) |',
            $page,
            'Defined by cell must link the framework definer.',
        );
    }

    public function testTablesEscapePipesAndProseEscapesAngleBrackets(): void
    {
        $page = $this->page('api/yii/base/Widget.md');

        self::assertStringContainsString(
            "| `'a\\|b'` | Position of the widget in a pipe-separated list: `a\\|b`. |",
            $page,
            'Pipes escaped.',
        );
        self::assertStringContainsString(
            'HTML attributes; keys are `<tag>` names with a \| sign.',
            $page,
            'Code keeps `<`; prose pipe is escaped.',
        );
        self::assertStringContainsString(
            'Values lower than 1 (`x < 1`) are ignored',
            $page,
            'Code span stays verbatim.',
        );
        self::assertStringContainsString(
            '[guide article on widgets](../../../guide/structure-widgets.md)',
            $page,
            'Guide link.',
        );
    }

    public function testWidgetPageHasStableAnchorsAndSections(): void
    {
        $page = $this->page('api/yii/base/Widget.md');

        foreach (['## Properties', '## Methods', '## Events', '## Constants', '## Method details'] as $section) {
            self::assertStringContainsString("\n$section\n", $page, "Section $section.");
        }

        self::assertStringContainsString(
            '### begin() <span id="method-begin"></span>',
            $page,
            'Method heading anchor.',
        );
        self::assertStringContainsString('<span id="event-EVENT_BEFORE_RUN"></span>', $page, 'Event anchor.');
        self::assertStringContainsString('<span id="const-POSITION"></span>', $page, 'Constant anchor.');
        self::assertStringContainsString(
            'public static function begin(array $config = []): static',
            $page,
            'Signature.',
        );
        self::assertStringContainsString(
            '- [`InvalidCallException`](InvalidCallException.md): when called twice.',
            $page,
            'Throws entry.',
        );
        self::assertStringContainsString(
            '[`$className`](BaseObject.md#property-className) <span class="api-flag">read-only</span>',
            $page,
            'Inherited virtual property flag.',
        );
        self::assertStringContainsString(
            "**Deprecated**\n\nSince 2.0.14: Use [`begin()`](Widget.md#method-begin) with a callback.",
            $page,
            'Deprecation fact with resolved reference.',
        );
    }

    public function testTypePageHeaderHasBreadcrumbMetadataTableAndCollapsedRelations(): void
    {
        $page = $this->page('api/yii/base/Widget.md');

        self::assertStringContainsString(
            "<div class=\"api-crumbs\">\n\n[API reference](../../index.md) › [yii](../index.md) › [base](index.md) › "
            . "Widget\n\n</div>",
            $page,
            'Breadcrumb with blank lines inside the wrapper.',
        );
        self::assertStringContainsString(
            "| <span class=\"api-badge api-badge-class\">class</span> | `yii\\base\\Widget` |\n| --- | --- |\n"
            . "| Extends | [`BaseObject`](BaseObject.md) |\n| Implements | [`Configurable`](Configurable.md) |\n"
            . "| Since | 2.0 |\n",
            $page,
            'Metadata rows in order.',
        );
        self::assertStringContainsString(
            "<details class=\"api-relations\">\n<summary>1 subclass</summary>\n\n"
            . "- [`vendor\\pkg\\Alert`](../../../extensions/pkg/reference/Alert.md)\n\n</details>",
            $page,
            'Collapsed relation list with its count.',
        );
        self::assertStringContainsString(
            '[API reference](../../../api/index.md) › [Pkg](index.md) › Alert',
            $this->page('extensions/pkg/reference/Alert.md'),
            'Extension breadcrumb must pass through the package root.',
        );
    }

    public function testSummaryTablesLinkNativeMembersToDetailsAndInheritedMembersToDefiner(): void
    {
        $page = $this->page('api/yii/base/Widget.md');

        self::assertStringContainsString(
            "## Methods\n\n<div class=\"api-summary\">\n\n| Method | Description | Defined by |\n| --- | --- | --- |\n",
            $page,
            'Summary table wrapped with blank lines.',
        );

        self::assertStringContainsString(
            '| [`begin()`](#method-begin) <span class="api-flag">static</span> | Begins a widget. | `Widget` |',
            $page,
            'Native method row.',
        );
        self::assertStringContainsString(
            '| [`end()`](#method-end) <span class="api-flag">static</span> | Ends a widget. **Deprecated**. '
            . '| `Widget` |',
            $page,
            'Deprecated marker in the summary.',
        );
        self::assertStringContainsString(
            '| <span id="method-getClassName"></span>[`getClassName()`](BaseObject.md#method-getClassName) | '
            . 'Returns the class name. | [`BaseObject`](BaseObject.md) |',
            $page,
            'Inherited row keeps its anchor and links the definer.',
        );
        self::assertStringContainsString(
            '| [`$view`](#property-view) | [`yii\web\View`](../web/View.md)`\|null` | View that renders the widget. '
            . 'Default: `null`. | `Widget` |',
            $page,
            'Linked type with escaped pipe; name links the card.',
        );
    }

    public function testMemberCardsHoldSignatureTextAndLabelledFacts(): void
    {
        $page = $this->page('api/yii/base/Widget.md');

        self::assertStringContainsString(
            "## Property details\n\n<div class=\"api-member\">\n\n### \$view <span id=\"property-view\"></span>\n\n"
            . "```php wrap\npublic yii\\web\\View|null \$view = null\n```\n\nView that renders the widget.\n\n"
            . "Defaults to the application view when not set.\n\n</div>",
            $page,
            'Property card with declaration and description.',
        );
        self::assertStringContainsString(
            "<div class=\"api-facts\">\n\n**Parameters**\n\n| Parameter | Type | Description |\n| --- | --- | --- |\n"
            . "| `\$config` | `array` | Name-value pairs. |\n\n**Returns**\n\n`static`: The widget.\n\n**Throws**\n\n",
            $page,
            'Facts block: label paragraph, then content.',
        );
        self::assertStringNotContainsString('<span id="property-view"></span>[', $page, 'Anchor sits on the card.');
    }

    public function testTypeNamedLikeSiblingNamespaceAndIndexPagesExist(): void
    {
        self::assertFileExists(
            self::$root . '/src/content/docs/extensions/pkg/reference/Item-class.md',
            'Suffixed page.',
        );
        self::assertFileExists(self::$root . '/src/content/docs/api/index.md', 'API index.');
        self::assertStringContainsString(
            '| [`yii\base`](yii/base/index.md) | 5 |',
            $this->page('api/index.md'),
            'Namespace row with its type count.',
        );
        self::assertStringContainsString(
            '| [`Theme`](Theme.md) | Represents the theme colors. |',
            $this->page('extensions/pkg/reference/enum/index.md'),
            'Namespace page lists types with summaries.',
        );
        self::assertStringContainsString(
            '[API reference](../../index.md) › [yii](../index.md) › base' . "\n",
            $this->page('api/yii/base/index.md'),
            'Namespace breadcrumb ends with the unlinked namespace.',
        );
        self::assertStringContainsString(
            '| [`Alert`](Alert.md) <span class="api-flag">final</span> | Renders an alert. |',
            $this->page('extensions/pkg/reference/index.md'),
            'Modifier flag in the type row.',
        );
        self::assertStringNotContainsString(
            '- Namespace:',
            $this->page('api/yii/base/index.md'),
            'Bullet header must be gone.',
        );
    }

    public function testCatalogsValidateAgainstTheSchema(): void
    {
        $schema = file_get_contents(dirname(__DIR__) . '/reference.schema.json');
        $validator = new Validator();
        $validator->setMaxErrors(5);

        foreach (['yii2', 'pkg'] as $package) {
            $data = json_decode((string) file_get_contents(self::$root . "/public/reference/$package.json"));
            $result = $validator->validate($data, (string) $schema);
            $errors = $result->isValid() ? [] : (new ErrorFormatter())->format($result->error());

            self::assertTrue($result->isValid(), "$package.json: " . json_encode($errors));
        }

        $catalog = json_decode((string) file_get_contents(self::$root . '/public/reference/pkg.json'), true);
        $alert = $catalog['types']['vendor\pkg\Alert'];

        self::assertSame(
            'yii\base\Widget',
            $alert['inherited']['properties']['options'],
            'Inherited property definer.',
        );
        self::assertSame('Theme color of the alert.', $alert['properties']['theme']['description'], 'Repaired text.');
        self::assertSame(['primary', 'danger'], [
            $catalog['types']['vendor\pkg\enum\Theme']['cases']['PRIMARY']['value'] === "'primary'" ? 'primary' : '',
            $catalog['types']['vendor\pkg\enum\Theme']['cases']['DANGER']['value'] === "'danger'" ? 'danger' : '',
        ], 'Case values.');
    }

    public function testLinkMapListsSlugsParentsAndNativeMembers(): void
    {
        $map = json_decode((string) file_get_contents(self::$root . '/.cache/reference/links.json'), true);
        $widget = $map['types']['yii\base\Widget'];

        self::assertSame('/docs/', $map['base'], 'Base path.');
        self::assertSame('api/yii/base/widget', $widget['slug'], 'Lower-cased slug.');
        self::assertSame('yii\base\BaseObject', $widget['extends'], 'Parent class to search.');
        self::assertSame('method-begin', $widget['members']['begin()'], 'Method anchor.');
        self::assertSame('property-options', $widget['members']['$options'], 'Property anchor.');
        self::assertArrayNotHasKey('getClassName()', $widget['members'], 'Inherited members stay on the parent.');
    }

    public function testInheritedUnresolvedLinksRemainReportedAtTheirOwningDeclaration(): void
    {
        $report = json_decode((string) file_get_contents(self::$root . '/.cache/reference/report.json'), true);
        self::assertArrayHasKey('missingFixtureMember()', $report['packages']['yii2']['topUnresolved']);
        self::assertArrayNotHasKey('missingFixtureMember()', $report['packages']['pkg']['topUnresolved'] ?? []);
        self::assertStringContainsString('missingFixtureMember()', $this->page('extensions/pkg/reference/Alert.md'));
    }

    private function page(string $path): string
    {
        return (string) file_get_contents(self::$root . '/src/content/docs/' . $path);
    }
}

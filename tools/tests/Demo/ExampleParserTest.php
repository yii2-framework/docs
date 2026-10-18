<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests\Demo;

use PHPUnit\Framework\TestCase;
use Yii2Docs\Tools\Demo\ExampleParser;
use Yii2Docs\Tools\Demo\Snippet;

use function array_map;
use function dirname;
use function file_get_contents;

/**
 * Unit tests for {@see ExampleParser} and the pairing key of {@see Snippet}.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class ExampleParserTest extends TestCase
{
    public function testHashIgnoresLineEndingsTrailingSpacesAndOuterBlankLines(): void
    {
        // plugins/remark-demos.test.mjs checks the same value.
        self::assertSame('67088607fe0d4960', Snippet::hashCode("echo 1;\n"), 'Key must match the Node plugin.');
        self::assertSame(
            Snippet::hashCode('echo 1;'),
            Snippet::hashCode("\r\n  echo 1;   \r\n\r\n"),
            'Whitespace variants must share the key.',
        );
        self::assertNotSame(Snippet::hashCode('echo 1;'), Snippet::hashCode('echo 2;'), 'Code changes the key.');
    }

    public function testParseNumbersSnippetsPerHeadingAndPairsAdjacentHtmlBlocks(): void
    {
        $snippets = (new ExampleParser())->parse(
            (string) file_get_contents(dirname(__DIR__) . '/fixtures/demos/docs/examples.md'),
        );

        self::assertSame(
            [
                'badge-1',
                'badge-2',
                'badge-3',
                'panel-1',
                'panel-2',
                'panel-2-1',
                'configuration-1',
                'forms-1',
                'model-1',
                'failure-1',
                'script-1',
            ],
            array_map(static fn(Snippet $snippet): string => $snippet->slug, $snippets),
            'Slugs: heading plus number, suffix for a repeated heading.',
        );
        self::assertSame("<span id=\"w0\" class=\"badge\">New</span>i0", $snippets[0]->html, 'Adjacent block pairs.');
        self::assertNull($snippets[1]->html, 'A block after prose has no HTML block.');
        self::assertSame(7, $snippets[0]->line, 'Line of the opening fence.');
        self::assertSame('Widgets', $snippets[3]->section, 'Section is the `##` heading.');
        self::assertSame('Forms', $snippets[7]->heading, 'Section text titles blocks outside a `###` heading.');
        self::assertSame(2, $snippets[4]->number, 'Numbers restart per heading.');
    }

    public function testParseSkipsNonPhpBlocksAndHeadingsInsideFences(): void
    {
        $markdown = "## A\n\n```js\nx\n```\n\n````php\n```\n## not a heading\n````\n\n~~~html\n<b></b>\n~~~\n";
        $snippets = (new ExampleParser())->parse($markdown);

        self::assertCount(1, $snippets, 'Only `php` blocks become snippets.');
        self::assertSame("```\n## not a heading", $snippets[0]->code, 'A longer fence keeps shorter ones as code.');
        self::assertSame('a-1', $snippets[0]->slug, 'Heading inside a fence is ignored.');
        self::assertSame('<b></b>', $snippets[0]->html, 'Tilde fences pair as well.');
        self::assertSame(
            'accessing-plugin-instances-with-import',
            ExampleParser::slug('Accessing plugin instances with `import()`'),
            'Code marks are dropped.',
        );
    }
}

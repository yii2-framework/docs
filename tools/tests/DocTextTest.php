<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Yii2Docs\Tools\Link\LinkResolver;
use Yii2Docs\Tools\Link\LinkStats;
use Yii2Docs\Tools\Model\ReferenceContext;
use Yii2Docs\Tools\Render\DocText;
use Yii2Docs\Tools\Render\PageMap;

use function sys_get_temp_dir;

/**
 * Unit tests for the static Markdown helpers of {@see DocText}.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class DocTextTest extends TestCase
{
    /**
     * @return array<string, array{string, string}>
     */
    public static function codeProvider(): array
    {
        return [
            'plain value' => ['array<string, mixed>', '`array<string, mixed>`'],
            'single backtick inside' => ['a`b', '`` a`b ``'],
            'double backticks inside' => ['a``b', '``` a``b ```'],
            'leading backtick' => ['`x', '`` `x ``'],
            'whitespace collapsed' => ["[\n    'a' => 1,\n]", "`[ 'a' => 1, ]`"],
        ];
    }

    #[DataProvider('codeProvider')]
    public function testCodeUsesDelimiterLongerThanInnerBackticks(string $value, string $expected): void
    {
        self::assertSame($expected, DocText::code($value), 'Delimiter must exceed the longest backtick run.');
    }

    public function testCellCodeEscapesPipes(): void
    {
        self::assertSame('`string\|null`', DocText::cellCode('string|null'), 'Pipe must be escaped for GFM tables.');
    }

    public function testCodeReturnsEmptyStringForBlankValue(): void
    {
        self::assertSame('', DocText::code("  \n "), 'Blank input must not produce an empty code span.');
    }

    public function testFirstSentenceStopsAtTheFirstPeriodFollowedBySpace(): void
    {
        self::assertSame(
            'Widget is the base class for widgets.',
            DocText::firstSentence("Widget is the base class\nfor widgets. It renders views (see v1.2)."),
            'Text must end after the first sentence.',
        );
        self::assertSame('No period', DocText::firstSentence('No period'), 'Text without a period must be kept.');
    }

    public function testUnclosedFenceIsClosed(): void
    {
        $text = new DocText(
            new LinkResolver(new ReferenceContext()),
            new PageMap('/docs/', 'https://example.org'),
            new LinkStats(),
            sys_get_temp_dir(),
        );

        self::assertSame(
            "Example:\n\n```\necho 1;\n```",
            $text->markdown("Example:\n\n```\necho 1;", null, 'api/x/Y.md', 'yii2'),
            'Open fence must be closed.',
        );
    }
}

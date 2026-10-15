<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests\Demo;

use PHPUnit\Framework\TestCase;
use Yii2Docs\Tools\Demo\ImportSet;

/**
 * Unit tests for the section imports of {@see ImportSet}.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class ImportSetTest extends TestCase
{
    public function testAbsorbRemovesTopLevelImportsAndKeepsClosureAndTraitUses(): void
    {
        $imports = new ImportSet();
        $body = $imports->absorb(
            "use a\\b\\{C, D as E};\nuse function strlen;\n\$f = function () use (\$x) { return \$x; };\n"
            . "final class F { use T; }",
        );

        self::assertSame(
            "\$f = function () use (\$x) { return \$x; };\nfinal class F { use T; }",
            $body,
            'Closure `use` and trait `use` must stay.',
        );
        self::assertSame(
            "use a\\b\\C;\nuse a\\b\\D as E;\nuse function strlen;",
            $imports->statements(),
            'Grouped, aliased and function imports must be split.',
        );
    }

    public function testAbsorbReplacesAnEarlierImportOfTheSameAlias(): void
    {
        $imports = new ImportSet();
        $imports->absorb("use a\\Html;\nuse yii\\data\\Pagination;");
        $imports->absorb('use b\\Html;');

        self::assertSame(
            "use b\\Html;\nuse yii\\data\\Pagination;",
            $imports->statements(),
            'One statement per alias, the latest wins.',
        );
    }
}

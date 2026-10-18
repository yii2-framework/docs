<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use Yii2Docs\Tools\Report\Baseline;

use function file_put_contents;
use function bin2hex;
use function is_file;
use function random_bytes;
use function sys_get_temp_dir;
use function unlink;

/**
 * Unit tests for the count baseline of {@see Baseline}.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class BaselineTest extends TestCase
{
    private string $file = '';

    protected function setUp(): void
    {
        $this->file = sys_get_temp_dir() . '/baseline-' . bin2hex(random_bytes(6)) . '.json';
    }

    protected function tearDown(): void
    {
        if (is_file($this->file)) {
            unlink($this->file);
        }
    }

    public function testCompareReportsGrowthAndMissingPackagesOnly(): void
    {
        Baseline::write($this->file, ['yii2' => ['errors' => 10, 'warnings' => 5, 'unresolvedLinks' => 2]]);
        $baseline = Baseline::load($this->file);

        self::assertSame(
            [],
            $baseline->compare(['yii2' => ['errors' => 9, 'warnings' => 5, 'unresolvedLinks' => 0]]),
            'Equal or lower counts must pass.',
        );
        self::assertSame(
            ['yii2: errors grew from 10 to 11.', 'pkg: no baseline entry (run tools/bin/reference --update-baseline).'],
            $baseline->compare([
                'yii2' => ['errors' => 11, 'warnings' => 5, 'unresolvedLinks' => 2],
                'pkg' => ['errors' => 0, 'warnings' => 0, 'unresolvedLinks' => 0],
            ]),
            'Growth and unknown packages must be reported.',
        );
    }

    public function testWriteKeepsPackagesAbsentFromTheRun(): void
    {
        Baseline::write($this->file, ['bootstrap6' => ['errors' => 1, 'warnings' => 2, 'unresolvedLinks' => 3]]);
        Baseline::write($this->file, ['yii2' => ['errors' => 4, 'warnings' => 5, 'unresolvedLinks' => 6]]);

        self::assertSame(
            [],
            Baseline::load($this->file)->compare(
                ['bootstrap6' => ['errors' => 1, 'warnings' => 2, 'unresolvedLinks' => 3]],
            ),
            'Entries of skipped packages must survive an update.',
        );
    }

    public function testThrowRuntimeExceptionWhenBaselineCountIsNotAnInteger(): void
    {
        file_put_contents($this->file, '{"packages": {"yii2": {"errors": "1", "warnings": 0, "unresolvedLinks": 0}}}');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('packages.yii2.errors must be an integer');

        Baseline::load($this->file);
    }
}

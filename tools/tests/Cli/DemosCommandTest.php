<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests\Cli;

use PHPUnit\Framework\TestCase;
use Yii2Docs\Tools\Cli\DemosCommand;

/**
 * Unit tests for the exit code rules of {@see DemosCommand}.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class DemosCommandTest extends TestCase
{
    public function testExitCodeIsZeroWithoutStrictWhateverTheCounts(): void
    {
        self::assertSame(0, DemosCommand::exitCode(false, 0, 0), 'Clean run must exit `0`.');
        self::assertSame(0, DemosCommand::exitCode(false, 2, 0), 'Failures are reported only.');
        self::assertSame(0, DemosCommand::exitCode(false, 0, 3), 'Skips are reported only.');
    }

    public function testExitCodeIsOneWithStrictWhenASnippetFailedOrWasSkipped(): void
    {
        self::assertSame(0, DemosCommand::exitCode(true, 0, 0), 'Clean run must exit `0`.');
        self::assertSame(1, DemosCommand::exitCode(true, 1, 0), 'A failed snippet must exit `1`.');
        self::assertSame(1, DemosCommand::exitCode(true, 0, 1), 'A skipped snippet must exit `1`.');
    }
}

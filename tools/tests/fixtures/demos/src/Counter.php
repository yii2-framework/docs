<?php

declare(strict_types=1);

namespace fixture\demos;

final class Counter
{
    public static int $counter = 0;

    public static function next(): string
    {
        return 'i' . self::$counter++;
    }
}

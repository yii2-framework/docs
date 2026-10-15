<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use function ltrim;
use function rtrim;

/**
 * Builds the stable fragment identifiers of reference pages: `property-<name>`, `method-<name>`, `const-<NAME>`,
 * `event-<NAME>` and `case-<NAME>`, plus the section anchors (`properties`, `methods`, ...).
 */
final class Anchor
{
    public const SECTION_CASES = 'cases';
    public const SECTION_CONSTANTS = 'constants';
    public const SECTION_EVENTS = 'events';
    public const SECTION_METHODS = 'methods';
    public const SECTION_PROPERTIES = 'properties';

    /**
     * Returns the anchor of an enum case.
     */
    public static function enumCase(string $name): string
    {
        return 'case-' . $name;
    }

    /**
     * Returns the anchor of a class constant.
     */
    public static function constant(string $name): string
    {
        return 'const-' . $name;
    }

    /**
     * Returns the anchor of an event (`EVENT_*` constant with an `@event` tag).
     */
    public static function event(string $name): string
    {
        return 'event-' . $name;
    }

    /**
     * Returns the anchor of a method; `name()` and `name` give the same result.
     */
    public static function method(string $name): string
    {
        return 'method-' . rtrim($name, '()');
    }

    /**
     * Returns the anchor of a property; `$name` and `name` give the same result.
     */
    public static function property(string $name): string
    {
        return 'property-' . ltrim($name, '$');
    }
}

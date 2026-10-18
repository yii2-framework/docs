<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Link;

/**
 * Represents a resolved API link target.
 */
final class Resolution
{
    /**
     * @param string|null $type Fully qualified name of the documented type that holds the target, or `null` for an
     * external target.
     * @param string|null $member Member key on the defining type (`begin()`, `$id`, `EVENT_INIT`), or `null` for the
     * type itself.
     * @param string $anchor Fragment on the type page, or `''`.
     * @param string $canonical Canonical name (`yii\base\Widget::begin()`), used as the label in `reference.json`.
     * @param string $label Short label for pages (`Widget::begin()`, `begin()`, `Widget`).
     * @param string|null $externalUrl URL of an external target (php.net), or `null`.
     */
    public function __construct(
        public readonly ?string $type,
        public readonly ?string $member,
        public readonly string $anchor,
        public readonly string $canonical,
        public readonly string $label,
        public readonly ?string $externalUrl = null,
    ) {
    }
}

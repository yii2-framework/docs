<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Model;

/**
 * Represents one case of an {@see EnumDoc}.
 */
final class EnumCaseDoc
{
    /**
     * @param string $name Case name.
     * @param string|null $value Backing value as PHP source (`'accent'`, `1`), or `null` for a pure enum.
     * @param string $shortDescription Docblock summary.
     * @param string $description Docblock description after the summary.
     * @param int $line Declaration line.
     */
    public function __construct(
        public readonly string $name,
        public readonly ?string $value,
        public readonly string $shortDescription,
        public readonly string $description,
        public readonly int $line,
    ) {
    }
}

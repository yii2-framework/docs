<?php

declare(strict_types=1);

namespace vendor\pkg\item;

/**
 * Represents an item.
 */
final readonly class Item
{
    /**
     * @param string $label Label of the item.
     * @param array<string, mixed> $options HTML attributes of the item.
     * @param bool $active Whether the item is active.
     */
    private function __construct(
        public string $label,
        public array $options = [],
        public bool $active = false,
    ) {
    }

    /**
     * Creates an item.
     *
     * @param string $label Label of the item.
     */
    public static function to(string $label): self
    {
        return new self($label);
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Link;

use function arsort;
use function array_slice;
use function array_sum;

/**
 * Counts unresolved API links per package and per target.
 */
final class LinkStats
{
    /**
     * @var array<string, array<string, int>> Occurrences by package, then by target.
     */
    private array $unresolved = [];
    /**
     * @var array<string, array<string, string>> First type whose docblock holds the target, by package and target.
     */
    private array $where = [];

    /**
     * Records one unresolved link found in the docblocks of `$where` (a type name).
     */
    public function unresolved(string $package, string $target, string $where = ''): void
    {
        $this->unresolved[$package][$target] = ($this->unresolved[$package][$target] ?? 0) + 1;
        $this->where[$package][$target] ??= $where;
    }

    /**
     * Returns the number of unresolved links of a package.
     */
    public function count(string $package): int
    {
        return array_sum($this->unresolved[$package] ?? []);
    }

    /**
     * Returns the most frequent unresolved targets of a package with their count and first location.
     *
     * @return array<string, array{count: int, in: string}>
     */
    public function top(string $package, int $limit = 20): array
    {
        $targets = $this->unresolved[$package] ?? [];
        arsort($targets);
        $result = [];

        foreach (array_slice($targets, 0, $limit, true) as $target => $count) {
            $result[(string) $target] = ['count' => $count, 'in' => $this->where[$package][$target] ?? ''];
        }

        return $result;
    }
}

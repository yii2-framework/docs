<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use function array_map;
use function explode;
use function hash;
use function implode;
use function str_replace;
use function substr;
use function trim;

/**
 * Represents one `php` code block of an examples page, with the `html` block that follows it when present.
 */
final class Snippet
{
    /**
     * @param string $section Text of the enclosing `##` heading, or an empty string before the first one.
     * @param string $heading Demo title: the enclosing `###` heading, or the `##` heading when there is none.
     * @param int $number Position of the snippet under `$heading`, starting at 1.
     * @param string $slug Page name, unique within the examples page (`alert-1`).
     * @param int $line Line of the opening fence in the examples file, starting at 1.
     * @param string $code PHP code of the block, without the fences.
     * @param string|null $html Code of the `html` block that directly follows, or `null` when there is none.
     * @param int $group Index of the heading occurrence the snippet belongs to (two headings with the same text are
     * two groups).
     */
    public function __construct(
        public readonly string $section,
        public readonly string $heading,
        public readonly int $number,
        public readonly string $slug,
        public readonly int $line,
        public readonly string $code,
        public readonly ?string $html,
        public readonly int $group = 0,
    ) {
    }

    /**
     * Returns the key that pairs this snippet with its code block on the site: the first 16 hex digits of the
     * SHA-256 of the code with line endings normalized, trailing spaces removed and outer blank lines trimmed.
     *
     * `plugins/remark-demos.mjs` computes the same value from the Markdown code node.
     */
    public function hash(): string
    {
        return self::hashCode($this->code);
    }

    /**
     * Returns the pairing key of a code block (see {@see hash()}).
     */
    public static function hashCode(string $code): string
    {
        $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $code));
        $normalized = trim(implode("\n", array_map(rtrim(...), $lines)));

        return substr(hash('sha256', $normalized), 0, 16);
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use function array_slice;
use function count;
use function explode;
use function implode;
use function preg_match;
use function preg_replace;
use function str_replace;
use function strlen;
use function strtolower;
use function trim;

/**
 * Extracts the `php` code blocks of an examples page (`docs/examples.md`), each with the `html` block that follows it,
 * the enclosing headings as titles and a page name per block.
 */
final class ExampleParser
{
    /**
     * Returns the `php` blocks of the Markdown text in document order.
     *
     * Blocks are numbered per `###` heading (or per `##` heading for blocks outside a `###` section); the page name is
     * the heading slug plus the number (`alert-2`), with a numeric suffix when two headings share a slug.
     *
     * @return list<Snippet>
     */
    public function parse(string $markdown): array
    {
        $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $markdown));
        $blocks = $this->blocks($lines);
        $snippets = [];
        $section = '';
        $heading = '';
        $numbers = [];
        $slugs = [];
        $headingSlugs = [];
        $group = 0;

        foreach ($blocks as $index => $block) {
            if ($block['type'] === 'heading') {
                if ($block['level'] <= 3) {
                    $group++;
                }

                if ($block['level'] <= 2) {
                    $section = $block['level'] === 2 ? $block['text'] : '';
                    $heading = $section;
                } elseif ($block['level'] === 3) {
                    $heading = $block['text'];
                }

                continue;
            }

            if ($block['lang'] !== 'php') {
                continue;
            }

            $next = $blocks[$index + 1] ?? null;
            $html = $next !== null && $next['type'] === 'fence' && $next['lang'] === 'html' && $next['adjacent']
                ? $next['code']
                : null;
            $title = $heading === '' ? 'Example' : $heading;
            $key = $group;
            $numbers[$key] = ($numbers[$key] ?? 0) + 1;

            if (!isset($headingSlugs[$key])) {
                $base = self::slug($title);
                $slugs[$base] = ($slugs[$base] ?? 0) + 1;
                $headingSlugs[$key] = $slugs[$base] === 1 ? $base : $base . '-' . $slugs[$base];
            }

            $snippets[] = new Snippet(
                $section,
                $title,
                $numbers[$key],
                $headingSlugs[$key] . '-' . $numbers[$key],
                $block['line'],
                $block['code'],
                $html,
                $group,
            );
        }

        return $snippets;
    }

    /**
     * Returns the lower-case slug of a heading: inline code marks dropped, runs of other characters turned into `-`.
     */
    public static function slug(string $text): string
    {
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower(str_replace('`', '', $text))), '-');

        return $slug === '' ? 'example' : $slug;
    }

    /**
     * Splits the lines into headings and fenced code blocks; other content only separates blocks.
     *
     * A fence is `adjacent` when only blank lines separate it from the previous block.
     *
     * @param list<string> $lines
     *
     * @return list<array{type: 'heading', level: int, text: string}|array{type: 'fence', lang: string, code: string,
     *     line: int, adjacent: bool}>
     */
    private function blocks(array $lines): array
    {
        $blocks = [];
        $adjacent = false;
        $total = count($lines);

        for ($i = 0; $i < $total; $i++) {
            $line = $lines[$i];

            if (preg_match('/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/', $line, $open) === 1) {
                $fence = $open[1];
                $start = $i;
                $end = $total;

                for ($j = $i + 1; $j < $total; $j++) {
                    if (preg_match('/^ {0,3}(`{3,}|~{3,})\s*$/', $lines[$j], $close) === 1
                        && $close[1][0] === $fence[0]
                        && strlen($close[1]) >= strlen($fence)
                    ) {
                        $end = $j;
                        break;
                    }
                }

                $blocks[] = [
                    'type' => 'fence',
                    'lang' => strtolower($open[2]),
                    'code' => implode("\n", array_slice($lines, $start + 1, $end - $start - 1)),
                    'line' => $start + 1,
                    'adjacent' => $adjacent,
                ];
                $i = $end;
                $adjacent = true;

                continue;
            }

            if (preg_match('/^(#{1,6})\s+(.*?)\s*#*\s*$/', $line, $match) === 1) {
                $blocks[] = ['type' => 'heading', 'level' => strlen($match[1]), 'text' => trim($match[2])];
                $adjacent = false;

                continue;
            }

            if (trim($line) !== '') {
                $adjacent = false;
            }
        }

        return $blocks;
    }
}

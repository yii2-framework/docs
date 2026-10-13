<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use yii\apidoc\models\TypeDoc;
use Yii2Docs\Tools\Link\LinkResolver;
use Yii2Docs\Tools\Link\LinkStats;
use Yii2Docs\Tools\Link\Resolution;

use function explode;
use function implode;
use function is_file;
use function max;
use function min;
use function preg_match;
use function preg_replace;
use function preg_replace_callback;
use function preg_split;
use function rtrim;
use function str_repeat;
use function str_replace;
use function strlen;
use function trim;

use const PREG_SPLIT_DELIM_CAPTURE;

/**
 * Converts docblock text (Markdown with `[[...]]`, `{@see ...}`, `{@link ...}` and `guide:` links) into page Markdown,
 * one-line table cells, or plain text for `reference.json`.
 *
 * Code fences and inline code are kept verbatim. In page output, references become relative `.md` links (resolved by
 * the site plugins), `<` outside code is escaped so the text cannot inject HTML, and headings are demoted below the
 * page sections. Unresolved references become inline code and are counted in {@see LinkStats}.
 */
final class DocText
{
    private const FENCE = '/^\s*(`{3,}|~{3,})/';
    private const REFERENCE = '/\{@(see|link)(?:\s+([^\s}]*))?(?:\s+([^}]*))?\}|\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/';

    /**
     * @param string $contentDir Absolute `src/content/docs` directory, to check that `guide:` targets exist.
     */
    public function __construct(
        private readonly LinkResolver $resolver,
        private readonly PageMap $pages,
        private readonly LinkStats $stats,
        private readonly string $contentDir,
    ) {
    }

    /**
     * Returns the text as page Markdown (block level).
     *
     * @param string|null $text Docblock Markdown.
     * @param TypeDoc|null $context Type whose docblock holds the text.
     * @param string $page Content path of the page being written.
     * @param string $package Package name, for the unresolved-link statistics.
     */
    public function markdown(?string $text, ?TypeDoc $context, string $page, string $package): string
    {
        return $this->convert($text, $context, $page, $package, false);
    }

    /**
     * Returns the text as one Markdown line for a table cell: newlines collapsed and `|` escaped.
     *
     * @param bool $count Whether unresolved references are counted; `false` for a text the page renders twice.
     */
    public function cell(?string $text, ?TypeDoc $context, string $page, string $package, bool $count = true): string
    {
        return str_replace('|', '\|', $this->inline($text, $context, $page, $package, $count));
    }

    /**
     * Returns the text as one Markdown line outside tables: newlines collapsed, fence lines dropped.
     *
     * @param bool $count Whether unresolved references are counted; `false` for a text the page renders twice.
     */
    public function inline(?string $text, ?TypeDoc $context, string $page, string $package, bool $count = true): string
    {
        $lines = [];

        foreach (explode("\n", $this->convert($text, $context, $page, $package, false, $count)) as $line) {
            if (preg_match(self::FENCE, $line) !== 1 && trim($line) !== '') {
                $lines[] = trim($line);
            }
        }

        return implode(' ', $lines);
    }

    /**
     * Returns plain text for `reference.json`: references become inline code with their canonical name.
     */
    public function plain(?string $text, ?TypeDoc $context, string $package, bool $oneLine = true): string
    {
        $result = $this->convert($text, $context, '', $package, true);

        return $oneLine ? trim((string) preg_replace('/\s+/', ' ', $result)) : $result;
    }

    /**
     * Returns `$value` as an inline code span whose delimiter is longer than any backtick run inside it.
     */
    public static function code(string $value): string
    {
        $value = trim((string) preg_replace('/\s+/', ' ', $value));

        if ($value === '') {
            return '';
        }

        $longest = 0;

        if (preg_match_all('/`+/', $value, $matches) > 0) {
            foreach ($matches[0] as $run) {
                $longest = max($longest, strlen($run));
            }
        }

        $fence = str_repeat('`', $longest + 1);
        $pad = $longest > 0 || $value[0] === '`' || $value[strlen($value) - 1] === '`' ? ' ' : '';

        return $fence . $pad . $value . $pad . $fence;
    }

    /**
     * Returns `$value` as an inline code span safe inside a table cell.
     */
    public static function cellCode(string $value): string
    {
        return str_replace('|', '\|', self::code($value));
    }

    /**
     * Returns the first sentence of plain text, for frontmatter descriptions.
     */
    public static function firstSentence(string $text): string
    {
        $text = trim((string) preg_replace('/\s+/', ' ', $text));

        if (preg_match('/^(.+?[.!?])(?:\s|$)/u', $text, $match) === 1) {
            return $match[1];
        }

        return $text;
    }

    private function convert(
        ?string $text,
        ?TypeDoc $context,
        string $page,
        string $package,
        bool $plain,
        bool $count = true,
    ): string {
        $count = $count && !$plain;
        $text = trim(str_replace(["\r\n", "\r"], "\n", (string) $text));

        if ($text === '') {
            return '';
        }

        $output = [];
        $fence = null;

        foreach (explode("\n", $text) as $line) {
            if ($fence !== null) {
                $output[] = $line;

                if (preg_match(self::FENCE, $line, $match) === 1 && $match[1][0] === $fence[0]
                    && strlen($match[1]) >= strlen($fence)) {
                    $fence = null;
                }

                continue;
            }

            if (preg_match(self::FENCE, $line, $match) === 1) {
                $fence = $match[1];
                $output[] = $line;
                continue;
            }

            if (!$plain && preg_match('/^(#{1,6})(\s.*)$/', $line, $heading) === 1) {
                $line = str_repeat('#', min(6, strlen($heading[1]) + 3)) . $heading[2];
            }

            $output[] = $this->line($line, $context, $page, $package, $plain, $count);
        }

        // An unclosed fence (a docblock slip) would swallow the rest of the page: close it.
        if ($fence !== null) {
            $output[] = $fence;
        }

        return rtrim(implode("\n", $output));
    }

    /**
     * Converts one prose line: inline code is kept, the rest is escaped and its references are resolved.
     */
    private function line(
        string $line,
        ?TypeDoc $context,
        string $page,
        string $package,
        bool $plain,
        bool $count,
    ): string {
        $parts = preg_split('/(`+)(.+?)(?<!`)\1(?!`)/', $line, -1, PREG_SPLIT_DELIM_CAPTURE);

        if ($parts === false) {
            return $line;
        }

        $result = '';
        $total = count($parts);

        for ($i = 0; $i < $total; $i += 3) {
            $prose = $parts[$i];

            if (!$plain) {
                $prose = (string) preg_replace('/<(?!https?:\/\/[^\s>]+>)/', '&lt;', $prose);
            }

            $prose = $this->guideLinks($prose, $page, $package, $plain, $count);

            $prose = (string) preg_replace('/\{@inherit[dD]oc\}/', '', $prose);
            $result .= (string) preg_replace_callback(
                self::REFERENCE,
                fn(array $match): string => $this->reference($match, $context, $page, $package, $plain, $count),
                $prose,
            );

            if (isset($parts[$i + 1], $parts[$i + 2])) {
                $result .= $parts[$i + 1] . $parts[$i + 2] . $parts[$i + 1];
            }
        }

        return $result;
    }

    /**
     * @param array<int, string> $match
     */
    private function reference(
        array $match,
        ?TypeDoc $context,
        string $page,
        string $package,
        bool $plain,
        bool $count,
    ): string {
        $isTag = ($match[1] ?? '') !== '';
        $target = trim($isTag ? ($match[2] ?? '') : ($match[4] ?? ''));
        $title = trim($isTag ? ($match[3] ?? '') : ($match[5] ?? ''));

        // Misses are counted once, for the pages; `reference.json` renders a subset of the same texts.
        if ($target === '') {
            if ($count) {
                $this->stats->unresolved($package, $match[0], (string) $context?->name);
            }

            return $title;
        }

        $resolution = $this->resolver->resolve($target, $context);

        if ($resolution === null) {
            if ($count) {
                $this->stats->unresolved($package, $target, (string) $context?->name);
            }

            return $title !== '' ? $title : self::code($target);
        }

        if ($plain) {
            if ($resolution->externalUrl !== null && $resolution->type === null && $title !== '') {
                return $title . ' (' . $resolution->externalUrl . ')';
            }

            // A member of the context type keeps its short label (`$heading`); other targets get the full name.
            $name = $resolution->member !== null && $resolution->label === $resolution->member
                ? $resolution->label
                : $resolution->canonical;

            return $title !== '' ? $title . ' (' . self::code($name) . ')' : self::code($name);
        }

        $href = $this->href($resolution, $page);
        $label = $title !== '' ? $title : self::code($resolution->label);

        return '[' . $label . '](' . $href . ')';
    }

    private function href(Resolution $resolution, string $page): string
    {
        if ($resolution->type === null) {
            return (string) $resolution->externalUrl;
        }

        $target = $this->pages->typePath($resolution->type);

        if ($target === null) {
            return (string) $resolution->externalUrl;
        }

        return $this->pages->relative($page, $target, $resolution->anchor);
    }

    /**
     * Rewrites `[text](guide:page#anchor)` to a relative link to `guide/page.md`, or to the absolute guide URL in plain
     * output. A missing guide page is counted and points to the guide index.
     */
    private function guideLinks(string $prose, string $page, string $package, bool $plain, bool $count): string
    {
        return (string) preg_replace_callback(
            '/\]\(guide:([A-Za-z0-9._-]+)(#[^)\s]*)?\)/',
            function (array $match) use ($page, $package, $plain, $count): string {
                $name = (string) preg_replace('/\.md$/', '', $match[1]);
                $target = 'guide/' . $name . '.md';
                $hash = $match[2] ?? '';

                if (!is_file($this->contentDir . '/' . $target)) {
                    if ($count) {
                        $this->stats->unresolved($package, 'guide:' . $name, $page);
                    }

                    return '](' . $this->pages->url('guide/index.md') . ')';
                }

                $href = $plain ? $this->pages->url($target) : $this->pages->relative($page, $target);

                return '](' . $href . $hash . ')';
            },
            $prose,
        );
    }
}

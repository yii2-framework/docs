<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use yii\apidoc\models\TypeDoc;
use Yii2Docs\Tools\Source\Package;

use function ctype_upper;
use function explode;
use function ltrim;
use function preg_match;
use function preg_replace_callback;
use function preg_split;
use function rtrim;
use function str_contains;
use function str_starts_with;
use function strlen;
use function strrpos;
use function substr;
use function trim;

use const PREG_SPLIT_DELIM_CAPTURE;
use const PREG_SPLIT_NO_EMPTY;

/**
 * Binds the text and link helpers to one page (content path, package) and one docblock context type.
 */
final class PageContext
{
    public function __construct(
        private readonly Site $site,
        public readonly Package $package,
        public readonly string $path,
        public readonly ?TypeDoc $type,
    ) {
    }

    /**
     * Returns docblock text as block-level page Markdown.
     */
    public function markdown(?string $text): string
    {
        return $this->site->text->markdown($text, $this->type, $this->path, $this->package->name);
    }

    /**
     * Returns docblock text as one table-cell line.
     *
     * @param bool $count Whether unresolved references are counted; `false` for a text the page renders twice.
     */
    public function cell(?string $text, bool $count = true): string
    {
        return $this->site->text->cell($text, $this->type, $this->path, $this->package->name, $count);
    }

    /**
     * Returns docblock text as one Markdown line outside tables.
     */
    public function inline(?string $text): string
    {
        return $this->site->text->inline($text, $this->type, $this->path, $this->package->name);
    }

    /**
     * Returns a PHP type as Markdown: each documented or PHP built-in class name links to its page, the rest stays
     * inline code (`array<string, ` + link + `>`).
     *
     * @param bool $cell Whether the result goes into a table cell (`|` escaped inside the code spans).
     */
    public function type(string $type, bool $cell = true): string
    {
        $parts = preg_split(
            '/([A-Za-z_]\w*(?:\\\\[A-Za-z_]\w*)*)/',
            trim($type),
            -1,
            PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY,
        );
        $result = '';
        $code = '';

        foreach ($parts === false ? [] : $parts as $part) {
            $link = str_contains($part, '\\') || ctype_upper($part[0]) ? $this->link($part) : null;

            if ($link === null) {
                $code .= $part;
                continue;
            }

            $result .= $this->codeRun($code, $cell) . $link;
            $code = '';
        }

        return trim($result . $this->codeRun($code, $cell));
    }

    /**
     * Returns docblock text as plain text (references as inline code).
     */
    public function plain(?string $text): string
    {
        return $this->site->text->plain($text, $this->type, $this->package->name);
    }

    /**
     * Returns a link to a type page labelled with its short name (full name outside the namespace of the page type),
     * or inline code with the full name when the type is not documented. Composite types (`yii\web\View|null`) are
     * linked name by name when `$composite` is `true`.
     */
    public function typeLink(string $name, bool $composite = false): string
    {
        $name = ltrim(trim($name), '\\');

        if ($composite && preg_match('/[|&<>\[\]]/', $name) === 1) {
            return (string) preg_replace_callback(
                '/[A-Za-z_][\w]*(?:\\\\[A-Za-z_]\w*)+/',
                fn(array $match): string => $this->typeLink($match[0]),
                $name,
            );
        }

        return $this->link($name) ?? DocText::code($name);
    }

    /**
     * Returns a link to the page of a type (documented or PHP built-in), or `null` when the type has no page.
     */
    private function link(string $name): ?string
    {
        $path = $this->site->pages->typePath($name);

        if ($path !== null) {
            $href = $this->site->pages->relative($this->path, $path);
            // Short names are ambiguous across namespaces (`yii\base\Widget`, `yii2\extensions\bootstrap6\Widget`).
            $sameNamespace = $this->type !== null && $this->type->namespace === $this->namespaceOf($name);
            $label = $sameNamespace ? Site::shortName($name) : $name;

            return '[' . DocText::code($label) . '](' . $href . ')';
        }

        $resolution = $this->site->resolver->resolve($name, null);

        if ($resolution?->externalUrl !== null) {
            return '[' . DocText::code($resolution->label) . '](' . $resolution->externalUrl . ')';
        }

        return null;
    }

    /**
     * Returns a run of a type between links as inline code; surrounding spaces stay outside the code span.
     */
    private function codeRun(string $code, bool $cell): string
    {
        if (trim($code) === '') {
            return $code === '' ? '' : ' ';
        }

        $span = $cell ? DocText::cellCode($code) : DocText::code($code);

        return ($code !== ltrim($code) ? ' ' : '') . $span . ($code !== rtrim($code) ? ' ' : '');
    }

    private function namespaceOf(string $name): string
    {
        $position = strrpos($name, '\\');

        return $position === false ? '' : substr($name, 0, $position);
    }

    /**
     * Returns a link to a member on the page of its defining type.
     */
    public function memberLink(string $type, string $label, string $anchor): string
    {
        $path = $this->site->pages->typePath($type);

        if ($path === null) {
            return DocText::code($label);
        }

        return '[' . DocText::code($label) . '](' . $this->site->pages->relative($this->path, $path, $anchor) . ')';
    }

    /**
     * Returns the link of an `@see` reference (`Widget::end()`, a URL, optionally followed by a description).
     */
    public function seeLink(string $see): string
    {
        // A Markdown link written as the reference (`@see [Memcache::set()](https://...)`) is kept as written.
        if (str_starts_with($see, '[')) {
            return $this->cell($see);
        }

        [$target] = explode(' ', $see, 2);
        $description = trim(substr($see, strlen($target)));

        if (preg_match('~^https?://~', $target) === 1) {
            return '<' . $target . '>' . ($description === '' ? '' : ' (' . $this->cell($description) . ')');
        }

        // phpDocumentor resolves a bare `@see name()` to the function `\<namespace>\name()`: retry as a member name.
        if (
            !str_contains($target, '::')
            && $this->site->resolver->resolve($target, $this->type) === null
            && ($position = strrpos($target, '\\')) !== false
        ) {
            $target = substr($target, $position + 1);
        }

        $link = $this->cell('[[' . $target . ']]');

        return $link . ($description === '' ? '' : ' (' . $this->cell($description) . ')');
    }
}

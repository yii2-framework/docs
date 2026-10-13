<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use yii\apidoc\models\TypeDoc;
use Yii2Docs\Tools\Source\Package;

use function explode;
use function ltrim;
use function preg_match;
use function preg_replace_callback;
use function str_contains;
use function strlen;
use function strrpos;
use function substr;
use function trim;

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
     */
    public function cell(?string $text): string
    {
        return $this->site->text->cell($text, $this->type, $this->path, $this->package->name);
    }

    /**
     * Returns docblock text as plain text (references as inline code).
     */
    public function plain(?string $text): string
    {
        return $this->site->text->plain($text, $this->type, $this->package->name);
    }

    /**
     * Returns a link to a type page labelled with its short name, or inline code with the full name when the type is
     * not documented. Composite types (`yii\web\View|null`) are linked name by name when `$composite` is `true`.
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

        $path = $this->site->pages->typePath($name);

        if ($path !== null) {
            $href = $this->site->pages->relative($this->path, $path);

            return '[' . DocText::code(Site::shortName($name)) . '](' . $href . ')';
        }

        $resolution = $this->site->resolver->resolve($name, null);

        if ($resolution?->externalUrl !== null) {
            return '[' . DocText::code($resolution->label) . '](' . $resolution->externalUrl . ')';
        }

        return DocText::code($name);
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

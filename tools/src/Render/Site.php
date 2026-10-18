<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Render;

use yii\apidoc\models\TypeDoc;
use Yii2Docs\Tools\Link\LinkResolver;
use Yii2Docs\Tools\Model\ReferenceContext;
use Yii2Docs\Tools\Source\Manifest;
use Yii2Docs\Tools\Source\Package;

use function json_encode;
use function strrpos;
use function substr;

use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;
use const JSON_UNESCAPED_UNICODE;

/**
 * Holds what every renderer needs: the model, the page map, the link resolver, the text converter and the sources.
 */
final class Site
{
    /**
     * @param array<string, Package> $typePackages Package of each documented type, by fully qualified name.
     */
    public function __construct(
        public readonly ReferenceContext $context,
        public readonly Manifest $manifest,
        public readonly PageMap $pages,
        public readonly LinkResolver $resolver,
        public readonly DocText $text,
        public readonly array $typePackages,
        public readonly string $buildDate,
    ) {
    }

    /**
     * Returns the type with the given name, or `null`.
     */
    public function type(string $name): ?TypeDoc
    {
        return $this->context->getType($name);
    }

    /**
     * Returns the URL of a file of a package at its ref: `blob` to view, `edit` to edit.
     */
    public static function sourceUrl(Package $package, string $path, string $mode = 'blob', int $line = 0): string
    {
        return $package->repo . '/' . $mode . '/' . $package->ref . '/' . $path . ($line > 0 ? '#L' . $line : '');
    }

    /**
     * Returns the short name of a fully qualified name.
     */
    public static function shortName(string $name): string
    {
        $position = strrpos($name, '\\');

        return $position === false ? $name : substr($name, $position + 1);
    }

    /**
     * Returns `$value` as a YAML double-quoted scalar.
     */
    public static function yaml(string $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}

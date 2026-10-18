<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use Yii2Docs\Tools\Render\PageMap;
use Yii2Docs\Tools\Source\Package;

/**
 * Unit tests for {@see PageMap} content paths, slugs and relative links.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class PageMapTest extends TestCase
{
    public function testFrameworkTypesMapUnderApiAndGlobalTypesUnderApiGlobal(): void
    {
        $map = new PageMap('/docs/', 'https://example.org');
        $map->registerAll([
            'yii\web\Request' => ['package' => $this->framework(), 'kind' => 'class'],
            'Yii' => ['package' => $this->framework(), 'kind' => 'class'],
        ]);

        self::assertSame('api/yii/web/Request.md', $map->typePath('yii\web\Request'), 'Path mirrors the namespace.');
        self::assertSame('api/global/Yii.md', $map->typePath('Yii'), 'Global types need their own directory.');
        self::assertSame('api/yii/web/request', $map->slug('api/yii/web/Request.md'), 'Slug must be lower-cased.');
        self::assertSame('api/yii/web', $map->slug('api/yii/web/index.md'), 'Index pages drop `/index`.');
        self::assertSame(
            'https://example.org/docs/api/yii/web/request/#method-get',
            $map->url('api/yii/web/Request.md', 'method-get'),
            'URL must include base, slug and fragment.',
        );
    }

    public function testPackageTypeNamedLikeSiblingNamespaceGetsKindSuffix(): void
    {
        $map = new PageMap('/docs/', 'https://example.org');
        $package = $this->package();
        $map->registerAll([
            'vendor\pkg\Item' => ['package' => $package, 'kind' => 'class'],
            'vendor\pkg\item\Item' => ['package' => $package, 'kind' => 'class'],
        ]);

        self::assertSame(
            'extensions/pkg/reference/Item-class.md',
            $map->typePath('vendor\pkg\Item'),
            'Suffix must avoid the `item` namespace slug.',
        );
        self::assertSame(
            'extensions/pkg/reference/item/Item.md',
            $map->typePath('vendor\pkg\item\Item'),
            'Types inside the namespace keep their name.',
        );
    }

    public function testRelativeLinksBetweenPages(): void
    {
        $map = new PageMap('/docs/', 'https://example.org');

        self::assertSame(
            'Component.md',
            $map->relative('api/yii/base/Widget.md', 'api/yii/base/Component.md'),
            'Siblings.',
        );
        self::assertSame(
            '../web/View.md#const-POS_END',
            $map->relative('api/yii/base/Widget.md', 'api/yii/web/View.md', 'const-POS_END'),
            'Cousins go up one level.',
        );
        self::assertSame(
            '../../../api/yii/base/Widget.md',
            $map->relative('extensions/pkg/reference/Alert.md', 'api/yii/base/Widget.md'),
            'Package pages reach the framework tree.',
        );
    }

    public function testThrowRuntimeExceptionForTypeOutsidePackageNamespace(): void
    {
        $map = new PageMap('/docs/', 'https://example.org');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('outside the pkg namespace');

        $map->registerAll(['other\Thing' => ['package' => $this->package(), 'kind' => 'class']]);
    }

    private function framework(): Package
    {
        return new Package(
            'yii2',
            'Yii',
            'framework',
            'https://github.com/o/yii2',
            '22.0',
            'c',
            'yii',
            '/x',
            'framework',
        );
    }

    private function package(): Package
    {
        return new Package('pkg', 'Pkg', 'package', 'https://github.com/o/pkg', 'main', 'c', 'vendor\pkg', '/y', 'src');
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests\Demo;

use FilesystemIterator;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Yii;
use Yii2Docs\Tools\Demo\AssetHasher;
use Yii2Docs\Tools\Demo\DemoApplication;
use Yii2Docs\Tools\Demo\DemoPage;
use Yii2Docs\Tools\Demo\DemoRenderer;
use Yii2Docs\Tools\Demo\SnippetRunner;

use function array_column;
use function array_combine;
use function bin2hex;
use function dirname;
use function file_get_contents;
use function is_dir;
use function mkdir;
use function random_bytes;
use function rmdir;
use function sys_get_temp_dir;
use function unlink;

/**
 * Unit tests for {@see DemoRenderer} rendering the examples page of a fixture package with a Yii application.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class DemoRendererTest extends TestCase
{
    /**
     * @var array{package: string, source: string, demos: list<array<string, mixed>>,
     *     counts: array{rendered: int, skipped: int, failed: int}}
     */
    private static array $catalog;
    private static string $dir = '';

    /**
     * Renders the fixture page once: snippets declare classes, which can happen only once per process.
     */
    public static function setUpBeforeClass(): void
    {
        $fixture = dirname(__DIR__) . '/fixtures/demos';

        foreach (['BadgeAsset', 'Badge', 'Panel', 'Counter'] as $class) {
            require_once "$fixture/src/$class.php";
        }

        self::$dir = sys_get_temp_dir() . '/demos-' . bin2hex(random_bytes(6));
        mkdir(self::$dir . '/assets', 0o775, true);

        DemoApplication::create(
            'demos-test',
            self::$dir,
            dirname(__DIR__, 2) . '/vendor',
            self::$dir . '/npm',
            self::$dir . '/assets',
            '/docs/demos/assets',
            new AssetHasher(['fixture' => $fixture]),
        );
        // The test bootstrap does not disable Yii's error handler; PHPUnit reports errors instead.
        Yii::$app->getErrorHandler()->unregister();

        $renderer = new DemoRenderer(
            'fixture',
            new SnippetRunner('fixture\demos'),
            new DemoPage('/docs/demos/assets/frame'),
            self::$dir . '/pages',
            '/docs/demos/fixture/',
            'Fixture',
        );
        self::$catalog = $renderer->render($fixture . '/docs/examples.md', 'docs/examples.md');
    }

    public static function tearDownAfterClass(): void
    {
        Yii::$app = null;

        if (is_dir(self::$dir)) {
            $items = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator(self::$dir, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST,
            );

            foreach ($items as $item) {
                $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
            }

            rmdir(self::$dir);
        }
    }

    public function testRenderWritesPagesAndCatalogForEverySnippet(): void
    {
        $catalog = self::$catalog;
        $demos = array_combine(array_column($catalog['demos'], 'slug'), $catalog['demos']);

        self::assertSame(['rendered' => 6, 'skipped' => 4, 'failed' => 1], $catalog['counts'], 'Status counts.');
        self::assertSame(
            [
                'badge-1' => 'rendered',
                'badge-2' => 'rendered',
                'badge-3' => 'rendered',
                'panel-1' => 'rendered',
                'panel-2' => 'skipped',
                'panel-2-1' => 'rendered',
                'configuration-1' => 'skipped',
                'forms-1' => 'skipped',
                'model-1' => 'rendered',
                'failure-1' => 'failed',
                'script-1' => 'skipped',
            ],
            array_column($catalog['demos'], 'status', 'slug'),
            'Status per snippet.',
        );
        self::assertSame('fragment: Panel::begin() without end()', $demos['panel-2']['reason'], 'Fragment reason.');
        self::assertSame(
            'configuration: returns a value and renders nothing',
            $demos['configuration-1']['reason'],
            'Configuration reason.',
        );
        self::assertSame(
            'declares FixtureForm and renders nothing',
            $demos['forms-1']['reason'],
            'Declaration reason.',
        );
        self::assertSame('script only: no markup to run against', $demos['script-1']['reason'], 'Script reason.');
        self::assertSame(
            'ErrorException: Undefined variable $missing',
            $demos['failure-1']['reason'],
            'Warnings must fail the snippet.',
        );
        self::assertSame('/docs/demos/fixture/badge-1.html', $demos['badge-1']['page'], 'Page URL.');
        self::assertSame(
            ['css' => [], 'js' => ['/docs/demos/assets/fixture-assets/badge.js'], 'jsBlocks' => 1],
            $demos['badge-1']['assets'],
            'Registered assets of the view.',
        );
        self::assertTrue($demos['badge-1']['html'], 'The first snippet has an HTML block.');
        self::assertNull($demos['failure-1']['page'], 'Failed snippets have no page.');
    }

    public function testRenderedPagesHoldMarkupScriptsAndPlaceholders(): void
    {
        $first = (string) file_get_contents(self::$dir . '/pages/badge-1.html');
        $second = (string) file_get_contents(self::$dir . '/pages/badge-2.html');
        $script = (string) file_get_contents(self::$dir . '/pages/badge-3.html');

        self::assertStringContainsString(
            "<main id=\"demo\">\n<span id=\"w0\" class=\"badge\">New</span>i0\n</main>",
            $first,
            'Echoed markup must sit in the demo container.',
        );
        self::assertStringContainsString(
            '<script type="module" src="/docs/demos/assets/fixture-assets/badge.js"></script>',
            $first,
            'Module script tag must keep its type.',
        );
        self::assertStringContainsString('window.badge = "w0";', $first, 'Script blocks must be rendered.');
        self::assertStringContainsString(
            '<script src="/docs/demos/assets/frame/frame.js"></script>',
            $first,
            'Frame script must be loaded in the head.',
        );
        self::assertStringContainsString('<title>Badge - Fixture demo</title>', $first, 'Title names the heading.');
        self::assertFileExists(self::$dir . '/assets/fixture-assets/badge.js', 'Asset must be published.');
        self::assertStringContainsString(
            '<span id="w0" class="badge">Again</span>i0',
            $second,
            'Ids and package counters restart; imports carry over.',
        );
        self::assertStringContainsString('src="data:image/svg+xml,', $second, 'Root images get a placeholder.');
        self::assertStringContainsString('<title>Badge (2) - Fixture demo</title>', $second, 'Title numbers the demo.');
        self::assertStringContainsString('Again</span>', $script, 'Script snippets run after the previous demo.');
        self::assertStringContainsString('.hidden = false;', $script, 'Script snippet code must be rendered.');
        self::assertStringContainsString(
            '<main id="demo">' . "\nAda\n</main>",
            (string) file_get_contents(self::$dir . '/pages/model-1.html'),
            'Declared model must be available as `$model`.',
        );
    }
}

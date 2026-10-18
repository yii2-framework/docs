<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests\Demo;

use FilesystemIterator;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Yii2Docs\Tools\Demo\AssetHasher;
use Yii2Docs\Tools\Demo\ProjectInstaller;
use Yii2Docs\Tools\Source\Package;

use function bin2hex;
use function dirname;
use function file_get_contents;
use function file_put_contents;
use function is_dir;
use function json_decode;
use function mkdir;
use function random_bytes;
use function rmdir;
use function sys_get_temp_dir;
use function unlink;

/**
 * Unit tests for the demo Composer projects of {@see ProjectInstaller} and the asset names of {@see AssetHasher}.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class ProjectInstallerTest extends TestCase
{
    private string $dir = '';

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/demos-project-' . bin2hex(random_bytes(6));
    }

    protected function tearDown(): void
    {
        if (is_dir($this->dir)) {
            $items = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($this->dir, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST,
            );

            foreach ($items as $item) {
                $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
            }

            rmdir($this->dir);
        }
    }

    public function testAssetHasherNamesDirectoriesAfterTheirRoot(): void
    {
        $fixtures = dirname(__DIR__) . '/fixtures';
        $hasher = new AssetHasher(['npm' => $fixtures . '/missing', 'fixture' => $fixtures . '/demos']);

        self::assertSame('fixture-assets', $hasher($fixtures . '/demos/assets'), 'Relative path joins the prefix.');
        self::assertSame('fixture', $hasher($fixtures . '/demos'), 'Root itself is the prefix.');
        self::assertMatchesRegularExpression(
            '/^asset-[0-9a-f]{12}$/',
            $hasher($fixtures . '/package'),
            'Paths outside the roots get a digest.',
        );
    }

    public function testInstallWritesTheProjectAndRunsComposerOnlyWhenNeeded(): void
    {
        $installer = new ProjectInstaller(dirname(__DIR__, 2) . '/demos/composer.json', 'true');
        [$package, $framework] = $this->packages();

        $first = $installer->install($package, $framework, $this->dir);
        $project = json_decode((string) file_get_contents($this->dir . '/composer.json'), true);

        self::assertTrue($first['updated'], 'Missing vendor/ must trigger Composer.');
        self::assertSame(['fixture\demos\Bootstrap'], $first['bootstrap'], 'Bootstrap classes of the package.');
        self::assertSame(
            ['fixture/demos' => 'dev-main', 'fixture/framework' => '22.0.x-dev', 'php' => '>=8.3'],
            $project['require'],
            'Framework and package versions come from their refs.',
        );
        self::assertSame(
            dirname(__DIR__) . '/fixtures/framework',
            $project['repositories'][0]['url'],
            'Framework is a path repository.',
        );
        self::assertFalse($project['config']['allow-plugins']['yiisoft/yii2-composer'], 'Plugins stay disabled.');

        mkdir($this->dir . '/vendor');
        file_put_contents($this->dir . '/vendor/autoload.php', '<?php');

        self::assertFalse(
            $installer->install($package, $framework, $this->dir)['updated'],
            'Unchanged project with vendor/ skips Composer.',
        );
    }

    public function testThrowRuntimeExceptionWhenComposerFails(): void
    {
        [$package, $framework] = $this->packages();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('composer update failed');

        (new ProjectInstaller(dirname(__DIR__, 2) . '/demos/composer.json', 'false'))
            ->install($package, $framework, $this->dir);
    }

    public function testVersionMapsBranchesAndKeepsTags(): void
    {
        self::assertSame('22.0.x-dev', ProjectInstaller::version('22.0'), 'Numeric branch gets `.x-dev`.');
        self::assertSame('dev-main', ProjectInstaller::version('main'), 'Named branch gets `dev-`.');
        self::assertSame('0.1.2', ProjectInstaller::version('0.1.2'), 'Tag is kept.');
        self::assertSame('v1.0.0', ProjectInstaller::version('v1.0.0'), 'Prefixed tag is kept.');
    }

    /**
     * @return array{Package, Package}
     */
    private function packages(): array
    {
        $fixtures = dirname(__DIR__) . '/fixtures';

        return [
            new Package(
                'fixture',
                'Fixture',
                'package',
                'https://example.com/fixture',
                'main',
                'local',
                'fixture\demos',
                $fixtures . '/demos/src',
                'src',
                $fixtures . '/demos',
                'docs',
            ),
            new Package(
                'yii2',
                'Yii',
                'framework',
                'https://example.com/yii2',
                '22.0',
                'local',
                'yii',
                $fixtures . '/framework',
                'framework',
            ),
        ];
    }
}

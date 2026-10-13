<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Tests;

use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use PHPUnit\Framework\TestCase;

use function basename;
use function dirname;
use function file_get_contents;
use function glob;
use function json_decode;
use function json_encode;

/**
 * Validates the catalogs last generated into `public/reference/` (by `npm run build` or `tools/bin/reference`)
 * against `reference.schema.json`; skipped when none exist.
 *
 * @author Wilmer Arambula <terabytesoftw@gmail.com>
 * @since 0.1
 */
final class PublishedCatalogTest extends TestCase
{
    public function testGeneratedCatalogsValidateAgainstTheSchema(): void
    {
        $files = glob(dirname(__DIR__, 2) . '/public/reference/*.json') ?: [];
        $catalogs = array_filter($files, static fn(string $file): bool => basename($file) !== 'reference.schema.json');

        if ($catalogs === []) {
            self::markTestSkipped('No generated catalogs in public/reference/.');
        }

        $validator = new Validator();
        $validator->setMaxErrors(5);
        $schema = (string) file_get_contents(dirname(__DIR__) . '/reference.schema.json');

        foreach ($catalogs as $file) {
            $result = $validator->validate(json_decode((string) file_get_contents($file)), $schema);
            $errors = $result->isValid() ? [] : (new ErrorFormatter())->format($result->error());

            self::assertTrue($result->isValid(), basename($file) . ': ' . json_encode($errors));
        }
    }
}

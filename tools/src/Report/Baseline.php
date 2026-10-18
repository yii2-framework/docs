<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Report;

use JsonException;
use RuntimeException;

use function file_get_contents;
use function file_put_contents;
use function is_array;
use function is_file;
use function is_int;
use function json_decode;
use function json_encode;
use function ksort;
use function sprintf;

use const JSON_PRETTY_PRINT;
use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_SLASHES;

/**
 * Compares the yii2-apidoc error and warning counts and the unresolved-link counts of each package with the committed
 * baseline (`tools/baseline.json`), so a build fails when a count grows.
 *
 * The framework has about 1149 harmless `Property $X conflicts with a defined getter` errors, so "zero errors" cannot
 * be the gate; "no more than the baseline" is.
 */
final class Baseline
{
    public const METRICS = ['errors', 'warnings', 'unresolvedLinks'];

    /**
     * @param array<string, array<string, int>> $counts Counts by package, then by metric.
     */
    private function __construct(private readonly array $counts)
    {
    }

    /**
     * Loads a baseline file.
     *
     * @throws RuntimeException When the file is missing or malformed.
     */
    public static function load(string $file): self
    {
        if (!is_file($file)) {
            throw new RuntimeException("Baseline $file not found; create it with --update-baseline.");
        }

        try {
            $data = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException("Baseline $file: invalid JSON ({$e->getMessage()}).", 0, $e);
        }

        $counts = [];

        foreach (is_array($data['packages'] ?? null) ? $data['packages'] : [] as $package => $metrics) {
            foreach (self::METRICS as $metric) {
                $value = is_array($metrics) ? ($metrics[$metric] ?? null) : null;

                if (!is_int($value)) {
                    throw new RuntimeException("Baseline $file: packages.$package.$metric must be an integer.");
                }

                $counts[(string) $package][$metric] = $value;
            }
        }

        return new self($counts);
    }

    /**
     * Returns the problems of a run: one message per count above the baseline, or per package without a baseline.
     *
     * @param array<string, array<string, int>> $current Counts by package, then by metric.
     *
     * @return list<string>
     */
    public function compare(array $current): array
    {
        $problems = [];

        foreach ($current as $package => $metrics) {
            if (!isset($this->counts[$package])) {
                $problems[] = "$package: no baseline entry (run tools/bin/reference --update-baseline).";
                continue;
            }

            foreach (self::METRICS as $metric) {
                $value = $metrics[$metric] ?? 0;
                $allowed = $this->counts[$package][$metric];

                if ($value > $allowed) {
                    $problems[] = sprintf('%s: %s grew from %d to %d.', $package, $metric, $allowed, $value);
                }
            }
        }

        return $problems;
    }

    /**
     * Writes a baseline file from the current counts, keeping entries of packages absent from this run.
     *
     * @param array<string, array<string, int>> $current
     *
     * @throws RuntimeException When the file cannot be written.
     */
    public static function write(string $file, array $current): void
    {
        $packages = is_file($file) ? self::load($file)->counts : [];

        foreach ($current as $package => $metrics) {
            foreach (self::METRICS as $metric) {
                $packages[$package][$metric] = $metrics[$metric] ?? 0;
            }
        }

        ksort($packages);
        $json = json_encode(
            [
                'description' => 'Maximum yii2-apidoc errors and warnings and unresolved PHPDoc links per package; '
                    . 'tools/bin/reference --baseline fails when a count grows. Update with --update-baseline.',
                'packages' => $packages,
            ],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
        );

        if (file_put_contents($file, $json . "\n") === false) {
            throw new RuntimeException("Cannot write the baseline $file.");
        }
    }
}

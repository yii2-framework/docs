<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use ReflectionClass;
use RuntimeException;
use Throwable;
use yii\base\Model;

use function array_map;
use function count;
use function file_get_contents;
use function file_put_contents;
use function implode;
use function is_dir;
use function is_file;
use function is_subclass_of;
use function mkdir;
use function sprintf;
use function str_replace;
use function strrchr;
use function substr;
use function trim;

/**
 * Renders the snippets of one examples page into demo pages and returns the demo catalog of the package.
 *
 * Snippets share state within a `##` section, as the examples pages are written: imports of earlier snippets stay
 * available; variables carry over within a heading, and to the following headings with the value of the first
 * heading that defined them (the field examples reuse the `$form` of the first form example, not of the last layout);
 * a snippet that declares a `yii\base\Model` subclass makes an instance of it available as `$model`. A snippet that
 * only registers scripts runs again after the previous demo of its heading (a Toast shown from the view).
 *
 * Statuses: `rendered`; `skipped` when the snippet is not a standalone demo (no markup, a `begin()` without `end()`,
 * a configuration array); `failed` when it throws or raises a warning.
 *
 * Requires a running application (see {@see DemoApplication}).
 */
final class DemoRenderer
{
    /**
     * @param string $package Package name (`bootstrap6`).
     * @param SnippetRunner $runner Runs each snippet in a fresh view.
     * @param DemoPage $page Renders the demo pages.
     * @param string $pagesDir Directory the pages are written to (`public/demos/<package>`).
     * @param string $pagesUrl URL of `$pagesDir`, with a trailing slash (`/docs/demos/<package>/`).
     * @param string $title Package title used in the page titles.
     */
    public function __construct(
        private readonly string $package,
        private readonly SnippetRunner $runner,
        private readonly DemoPage $page,
        private readonly string $pagesDir,
        private readonly string $pagesUrl,
        private readonly string $title,
    ) {
    }

    /**
     * Renders every `php` snippet of the examples file and writes the pages of the rendered ones.
     *
     * @param string $examplesFile Absolute path of the examples page.
     * @param string $source Path of the examples page in the package repository, recorded in the catalog.
     *
     * @throws RuntimeException When the examples file cannot be read or a page cannot be written.
     *
     * @return array{package: string, source: string, demos: list<array<string, mixed>>,
     *     counts: array{rendered: int, skipped: int, failed: int}}
     */
    public function render(string $examplesFile, string $source): array
    {
        if (!is_file($examplesFile)) {
            throw new RuntimeException("$examplesFile not found.");
        }

        if (!is_dir($this->pagesDir) && !mkdir($this->pagesDir, 0o775, true) && !is_dir($this->pagesDir)) {
            throw new RuntimeException("Cannot create {$this->pagesDir}.");
        }

        $snippets = (new ExampleParser())->parse((string) file_get_contents($examplesFile));
        $demos = [];
        $counts = ['rendered' => 0, 'skipped' => 0, 'failed' => 0];
        $section = null;
        $imports = new ImportSet();
        $shared = [];
        $local = [];
        $group = null;
        /** @var array<int, array{body: string, variables: array<string, mixed>}> $previous */
        $previous = [];

        foreach ($snippets as $snippet) {
            if ($snippet->section !== $section) {
                $section = $snippet->section;
                $imports = new ImportSet();
                $shared = [];
                $previous = [];
                $group = null;
            }

            if ($snippet->group !== $group) {
                $group = $snippet->group;
                $local = [];
            }

            $variables = [...$shared, ...$local];

            $body = $imports->absorb($snippet->code);
            $before = $variables;
            $result = $this->runner->run($imports->statements() . "\n" . $body, $variables);
            $entry = $this->entry($snippet);
            $continued = false;

            if ($result->error === null) {
                $local = $this->withModel($result);
                $shared += $local;

                if ($result->unclosed === [] && trim($result->output) === '' && $result->hasScripts()
                    && isset($previous[$snippet->group])
                ) {
                    // A script for the previous demo of the heading (for example a Toast shown from the view).
                    $last = $previous[$snippet->group];
                    $result = $this->runner->run(
                        $imports->statements() . "\n" . $last['body'] . "\n" . $body,
                        $last['variables'],
                    );
                    $continued = true;
                }
            }

            [$status, $reason] = $this->status($result, $continued);
            $entry['status'] = $status;
            $entry['reason'] = $reason;
            $counts[$status]++;

            if ($status === 'failed' && $result->error !== null) {
                $entry['errors'] = $this->errors($result->error);
            }

            if ($status === 'rendered') {
                $title = str_replace('`', '', $snippet->heading)
                    . ($snippet->number > 1 ? " ({$snippet->number})" : '') . " - {$this->title} demo";
                $page = $this->page->render($result->view, $result->output, $title);
                $file = "{$this->pagesDir}/{$snippet->slug}.html";

                if (file_put_contents($file, $page['html']) === false) {
                    throw new RuntimeException("Cannot write $file.");
                }

                $entry['page'] = $this->pagesUrl . $snippet->slug . '.html';
                $entry['assets'] = $page['assets'];

                if (!$continued) {
                    $previous[$snippet->group] = ['body' => $body, 'variables' => $before];
                }
            }

            $demos[] = $entry;
        }

        return ['package' => $this->package, 'source' => $source, 'demos' => $demos, 'counts' => $counts];
    }

    /**
     * Returns the catalog entry of a snippet before it runs.
     *
     * @return array<string, mixed>
     */
    private function entry(Snippet $snippet): array
    {
        return [
            'slug' => $snippet->slug,
            'title' => str_replace('`', '', $snippet->heading),
            'section' => str_replace('`', '', $snippet->section),
            'number' => $snippet->number,
            'line' => $snippet->line,
            'hash' => $snippet->hash(),
            'html' => $snippet->html !== null,
            'status' => 'failed',
            'reason' => null,
            'page' => null,
            'assets' => null,
            'errors' => [],
        ];
    }

    /**
     * Returns the status and the reason of a run.
     *
     * @return array{'rendered'|'skipped'|'failed', string|null}
     */
    private function status(RunResult $result, bool $continued): array
    {
        if ($result->error !== null) {
            return ['failed', $this->describe($result->error)];
        }

        if ($result->unclosed !== []) {
            return ['skipped', sprintf('fragment: %s::begin() without end()', self::shortName($result->unclosed[0]))];
        }

        if (trim($result->output) !== '') {
            return ['rendered', $continued ? 'runs after the previous demo of its heading' : null];
        }

        if ($result->returned !== null) {
            return ['skipped', 'configuration: returns a value and renders nothing'];
        }

        if ($result->declared !== []) {
            return ['skipped', 'declares ' . implode(', ', array_map(self::shortName(...), $result->declared))
                . ' and renders nothing'];
        }

        if ($result->hasScripts()) {
            return ['skipped', 'script only: no markup to run against'];
        }

        return ['skipped', 'renders nothing'];
    }

    /**
     * Returns the variables after a run, with `$model` set to a new instance of the first `yii\base\Model` subclass
     * the snippet declared when the snippets have no `$model` yet.
     *
     * @return array<string, mixed>
     */
    private function withModel(RunResult $result): array
    {
        $variables = $result->variables;

        if (isset($variables['model'])) {
            return $variables;
        }

        foreach ($result->declared as $class) {
            if (is_subclass_of($class, Model::class) && (new ReflectionClass($class))->isInstantiable()) {
                $variables['model'] = new $class();
                break;
            }
        }

        return $variables;
    }

    /**
     * Returns `ShortClass: message` for an error.
     */
    private function describe(Throwable $error): string
    {
        return self::shortName($error::class) . ': ' . trim($error->getMessage());
    }

    /**
     * Returns the messages of the error and its previous errors.
     *
     * @return list<string>
     */
    private function errors(Throwable $error): array
    {
        $messages = [];

        for ($current = $error; $current !== null && count($messages) < 5; $current = $current->getPrevious()) {
            $messages[] = $this->describe($current);
        }

        return $messages;
    }

    /**
     * Returns the class name without its namespace.
     */
    private static function shortName(string $class): string
    {
        $short = strrchr($class, '\\');

        return $short === false ? $class : substr($short, 1);
    }
}

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use Throwable;
use yii\web\View;

/**
 * Represents the outcome of one snippet run: the echoed markup, the view with the registered assets and scripts, and
 * the state the snippet leaves for the next ones.
 */
final class RunResult
{
    /**
     * @param View $view View the snippet ran in (`$this` of the snippet and the application `view` component).
     * @param string $output Markup echoed by the snippet.
     * @param array<string, mixed> $variables Variables defined after the run, including the ones passed in.
     * @param mixed $returned Value of a `return` statement of the snippet, or `null`.
     * @param Throwable|null $error Exception or error (warnings included) that stopped the snippet, or `null`.
     * @param list<string> $unclosed Classes of the widgets started with `begin()` and never ended.
     * @param list<string> $declared Classes declared by the snippet.
     */
    public function __construct(
        public readonly View $view,
        public readonly string $output,
        public readonly array $variables,
        public readonly mixed $returned,
        public readonly ?Throwable $error,
        public readonly array $unclosed,
        public readonly array $declared,
    ) {
    }

    /**
     * Returns whether the snippet registered JavaScript code or files in its view.
     */
    public function hasScripts(): bool
    {
        foreach ([$this->view->js, $this->view->jsFiles] as $positions) {
            foreach ($positions as $items) {
                if ($items !== []) {
                    return true;
                }
            }
        }

        return $this->view->assetBundles !== [];
    }
}

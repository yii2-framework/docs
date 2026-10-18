<?php

declare(strict_types=1);

namespace vendor\pkg;

use yii\base\Widget;
use yii\web\View;

/**
 * Renders an alert.
 *
 * Content between {@see begin()} and {@see end()} is rendered at {@see View::POS_END}.
 */
final class Alert extends Widget
{
    /**
     * Theme color of the alert.
     *
     * @var enum\Theme|string|null
     */
    public enum\Theme|string|null $theme = null;
    /**
     * Rows of the alert.
     *
     * @var list<int>
     */
    public array $rows;
}

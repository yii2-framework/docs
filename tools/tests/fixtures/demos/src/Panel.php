<?php

declare(strict_types=1);

namespace fixture\demos;

use yii\base\Widget;

final class Panel extends Widget
{
    public function init(): void
    {
        parent::init();
        ob_start();
    }

    public function run(): string
    {
        return '<div id="' . $this->getId() . '" class="panel">' . ob_get_clean() . '</div>';
    }
}

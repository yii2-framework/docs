<?php

declare(strict_types=1);

use yii2\extensions\bootstrap6\Alert;
use yii2\extensions\bootstrap6\enum\Theme;

/** @var yii\web\View $this */

echo Alert::widget([
    'heading' => 'Saved',
    'body' => 'Your post was saved.',
    'theme' => Theme::SUCCESS,
]);

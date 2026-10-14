<?php

declare(strict_types=1);

use yii\bootstrap5\Toast;
use yii\web\View;

/** @var View $this */
/** @var app\models\Post $model */

echo Toast::widget(
    [
        'id' => 'post-saved-toast',
        'title' => 'Post saved',
        'body' => 'Saved: ' . $model->title,
    ],
);

$this->registerJs(
    'new bootstrap.Toast(document.getElementById("post-saved-toast")).show();',
);

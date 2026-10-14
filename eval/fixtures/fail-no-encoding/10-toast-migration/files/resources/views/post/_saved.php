<?php

declare(strict_types=1);

use yii\web\View;
use yii2\extensions\bootstrap6\asset\BootstrapPluginAsset;
use yii2\extensions\bootstrap6\Toast;

/** @var View $this */
/** @var app\models\Post $model */

$bundle = BootstrapPluginAsset::register($this);

echo Toast::widget(
    [
        'id' => 'post-saved-toast',
        'title' => 'Post saved',
        'body' => 'Saved: ' . $model->title,
    ],
);

$this->registerJs(
    $bundle->importJs(
        $this,
        'bootstrap.Toast.getOrCreateInstance(document.getElementById("post-saved-toast")).show();',
    ),
);

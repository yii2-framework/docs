<?php

declare(strict_types=1);

use yii\helpers\Json;
use yii\web\View;
use yii2\extensions\bootstrap6\asset\BootstrapPluginAsset;
use yii2\extensions\bootstrap6\Html;
use yii2\extensions\bootstrap6\Toast;

/** @var View $this */
/** @var app\models\Post $model */

$id = 'post-saved-toast';

echo Toast::widget(
    [
        'id' => $id,
        'title' => 'Post saved',
        'body' => 'Saved: ' . Html::encode($model->title),
    ],
);

BootstrapPluginAsset::register($this);

$this->registerJs(
    BootstrapPluginAsset::importJs(
        $this,
        'bootstrap.Toast.getOrCreateInstance(document.getElementById(' . Json::htmlEncode($id) . ')).show();',
    ),
);

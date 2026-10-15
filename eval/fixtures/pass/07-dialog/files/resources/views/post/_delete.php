<?php

declare(strict_types=1);

use yii2\extensions\bootstrap6\Dialog;
use yii2\extensions\bootstrap6\Html;

/**
 * @var yii\web\View $this
 * @var app\models\Post $model
 */

Dialog::begin(['title' => 'Delete post', 'toggleButton' => ['label' => 'Delete']]);
echo Html::tag('p', Html::encode($model->title) . ' will be removed.');
echo Html::beginForm(['post/delete', 'id' => $model->id], 'post');
echo Html::submitButton('Confirm');
echo Html::endForm();
Dialog::end();

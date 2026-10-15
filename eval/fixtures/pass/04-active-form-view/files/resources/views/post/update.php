<?php

declare(strict_types=1);

use yii\helpers\Html;
use yii\widgets\ActiveForm;

/**
 * @var yii\web\View $this
 * @var app\models\Post $model
 */
?>
<h1>Update post: <?= Html::encode($model->title) ?></h1>

<?php $form = ActiveForm::begin(); ?>
    <?= $form->field($model, 'title')->textInput(['maxlength' => true]) ?>
    <?= $form->field($model, 'body')->textarea(['rows' => 6]) ?>
    <?= Html::submitButton('Save') ?>
<?php ActiveForm::end(); ?>

<?php

declare(strict_types=1);

use yii2\extensions\filepond\FilePond;

echo FilePond::widget([
    'name' => 'avatar',
    'acceptedFileTypes' => ['image/jpeg', 'image/png', 'image/webp'],
    'maxFileSize' => '2MB',
    'allowImageEdit' => true,
    'allowImageTransform' => true,
    'imageCropAspectRatio' => '1:1',
    'cropper' => ['aspectRatios' => ['1:1']],
    'config' => ['imageEditInstantEdit' => true],
]);

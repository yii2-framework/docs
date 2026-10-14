<?php

declare(strict_types=1);

use yii2\extensions\bootstrap6\Dialog;
use yii2\extensions\bootstrap6\enum\DialogSize;

Dialog::begin(
    [
        'backdrop' => 'static',
        'scrollable' => true,
        'size' => DialogSize::LG,
        'title' => 'Terms of service',
        'toggleButton' => ['label' => 'Review terms'],
    ],
);

echo 'Read the terms before continuing.';

Dialog::end();

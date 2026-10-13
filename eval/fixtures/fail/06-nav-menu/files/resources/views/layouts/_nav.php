<?php

declare(strict_types=1);

use yii2\extensions\bootstrap6\item\NavItem;
use yii2\extensions\bootstrap6\Nav;

// Wrong on purpose: hallucinated NavItem::dropdown() and an array item with a Bootstrap 5 class.
echo Nav::widget([
    'items' => [
        NavItem::to('Home', ['/site/index']),
        NavItem::dropdown('Docs', [['label' => 'Guide', 'url' => 'https://yii2-framework.github.io/docs/guide/']]),
        ['label' => 'Admin', 'url' => '#', 'linkOptions' => ['class' => 'nav-link disabled']],
    ],
]);

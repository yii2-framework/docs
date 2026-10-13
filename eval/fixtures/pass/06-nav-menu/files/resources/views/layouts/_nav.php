<?php

declare(strict_types=1);

use yii2\extensions\bootstrap6\enum\NavStyle;
use yii2\extensions\bootstrap6\item\MenuItem;
use yii2\extensions\bootstrap6\item\NavItem;
use yii2\extensions\bootstrap6\Nav;

/** @var yii\web\View $this */

echo Nav::widget([
    'style' => NavStyle::PILLS,
    'items' => [
        NavItem::to('Home', ['/site/index']),
        NavItem::to('Blog', ['/post/index']),
        NavItem::menu('Docs', [
            MenuItem::link('Guide', 'https://yii2-framework.github.io/docs/guide/'),
            MenuItem::link('API', 'https://yii2-framework.github.io/docs/api/'),
        ]),
        NavItem::to('Admin')->withDisabled(true),
    ],
]);

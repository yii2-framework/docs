<?php

declare(strict_types=1);

namespace fixture\demos;

use yii\web\AssetBundle;

final class BadgeAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/../assets';
    public $js = ['badge.js'];
    public $jsOptions = ['type' => 'module'];
}

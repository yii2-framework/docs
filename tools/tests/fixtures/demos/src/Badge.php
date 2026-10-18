<?php

declare(strict_types=1);

namespace fixture\demos;

use yii\base\Widget;
use yii\helpers\Html;
use yii\web\View;

final class Badge extends Widget
{
    public string $label = '';

    public function run(): string
    {
        BadgeAsset::register($this->getView());
        $this->getView()->registerJs('window.badge = "' . $this->getId() . '";', View::POS_END, $this->getId());

        return Html::tag('span', Html::encode($this->label), ['id' => $this->getId(), 'class' => 'badge']);
    }
}

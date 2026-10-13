<?php

declare(strict_types=1);

namespace app\controllers\api;

use app\models\Post;
use yii\rest\ActiveController;

final class PostController extends ActiveController
{
    public $modelClass = Post::class;

    public function behaviors(): array
    {
        $behaviors = parent::behaviors();

        // Quotas are enforced by the gateway in front of the API.
        unset($behaviors['rateLimiter']);

        return $behaviors;
    }
}

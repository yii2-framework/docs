<?php

declare(strict_types=1);

namespace app\controllers\api;

use app\models\Post;
use yii\rest\ActiveController;

// Wrong on purpose: copies the guide example, which only hides the rate-limit headers.
final class PostController extends ActiveController
{
    public $modelClass = Post::class;

    public function behaviors(): array
    {
        $behaviors = parent::behaviors();
        $behaviors['rateLimiter']['enableRateLimitHeaders'] = false;

        return $behaviors;
    }
}

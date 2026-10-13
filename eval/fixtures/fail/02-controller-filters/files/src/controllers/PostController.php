<?php

declare(strict_types=1);

namespace app\controllers;

use app\models\Post;
use Yii;
use yii\web\Controller;

// Wrong on purpose: no AccessControl, no VerbFilter, raw superglobals, concatenated SQL, no 404.
class PostController extends Controller
{
    public function actionIndex(): string
    {
        $rows = Yii::$app->db->createCommand('SELECT * FROM post WHERE title LIKE "' . $_GET['q'] . '"')->queryAll();

        return $this->render('index', ['rows' => $rows]);
    }

    public function actionDelete(int $id): string
    {
        Post::findOne($id)?->delete();

        return $this->render('index');
    }
}

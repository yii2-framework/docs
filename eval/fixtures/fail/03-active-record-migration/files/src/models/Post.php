<?php

namespace app\models;

use yii\db\ActiveRecord;

// Wrong on purpose: no strict_types, no rules(), no attributeLabels().
class Post extends ActiveRecord
{
    public static function tableName(): string
    {
        return 'post';
    }
}

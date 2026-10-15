<?php

declare(strict_types=1);

namespace app\models;

use yii\db\ActiveRecord;

/**
 * Represents a blog post stored in the `post` table.
 *
 * @property int $id
 * @property string $title
 * @property string $body
 * @property int|null $created_at
 */
class Post extends ActiveRecord
{
    public static function tableName(): string
    {
        return '{{%post}}';
    }

    public function rules(): array
    {
        return [
            [['title', 'body'], 'required'],
            [['title', 'body'], 'trim'],
            ['title', 'string', 'max' => 255],
            ['body', 'string'],
        ];
    }

    public function attributeLabels(): array
    {
        return [
            'id' => 'ID',
            'title' => 'Title',
            'body' => 'Body',
            'created_at' => 'Created at',
        ];
    }
}

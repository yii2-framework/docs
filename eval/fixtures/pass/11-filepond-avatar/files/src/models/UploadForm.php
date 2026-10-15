<?php

declare(strict_types=1);

namespace app\models;

use yii\base\Model;
use yii2\extensions\filepond\file\EncodedFile;
use yii2\extensions\filepond\file\FileSaver;
use yii2\extensions\filepond\validator\EncodedFileValidator;

final class UploadForm extends Model
{
    public mixed $avatar = null;

    public function rules(): array
    {
        return [
            [['avatar'], 'required'],
            [['avatar'], EncodedFileValidator::class,
                'extensions' => ['jpg', 'jpeg', 'png', 'webp'],
                'mimeTypes' => ['image/jpeg', 'image/png', 'image/webp'],
                'maxSize' => 2_000_000,
                'maxFiles' => 1,
            ],
        ];
    }

    public function saveAvatar(string $directory): ?string
    {
        if (!$this->validate()) {
            return null;
        }

        $file = EncodedFile::fromInput($this->avatar)[0];

        return (new FileSaver($directory))->save($file, 'avatar');
    }
}

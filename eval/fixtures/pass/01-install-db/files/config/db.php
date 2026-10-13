<?php

declare(strict_types=1);

use yii\db\Connection;

return [
    'class' => Connection::class,
    'dsn' => 'mysql:host=127.0.0.1;dbname=blog',
    'username' => 'blog',
    'password' => (string) getenv('DB_PASSWORD'),
    'charset' => 'utf8mb4',
];

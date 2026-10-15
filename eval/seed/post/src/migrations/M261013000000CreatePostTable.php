<?php

declare(strict_types=1);

namespace app\migrations;

use yii\db\Migration;

/**
 * Creates the `post` table.
 */
final class M261013000000CreatePostTable extends Migration
{
    public function safeUp(): void
    {
        $this->createTable('{{%post}}', [
            'id' => $this->primaryKey(),
            'title' => $this->string(255)->notNull(),
            'body' => $this->text()->notNull(),
            'created_at' => $this->integer()->null(),
        ]);
    }

    public function safeDown(): void
    {
        $this->dropTable('{{%post}}');
    }
}

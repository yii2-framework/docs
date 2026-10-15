<?php

declare(strict_types=1);

namespace app\migrations;

use yii\db\Migration;

// Wrong on purpose: up()/down() instead of safeUp()/safeDown().
class M261013000000CreatePostTable extends Migration
{
    public function up(): void
    {
        $this->createTable('post', ['id' => $this->primaryKey(), 'title' => $this->string()]);
    }

    public function down(): void
    {
        $this->dropTable('post');
    }
}

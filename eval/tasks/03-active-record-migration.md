---
id: 03-active-record-migration
title: ActiveRecord model and reversible migration
skill: yii2-framework
context:
  - https://yii2-framework.github.io/docs/guide/db-active-record/index.md
  - https://yii2-framework.github.io/docs/guide/db-migrations/index.md
outputs:
  - src/models/Post.php
  - src/migrations/M261013000000CreatePostTable.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:namespace app\\models;'
  - 'grep:namespace app\\migrations;'
  - 'grep:function tableName'
  - 'grep:function rules'
  - 'grep:function attributeLabels'
  - 'grep:function safeUp'
  - 'grep:function safeDown'
  - 'grep:\{\{%post\}\}'
  - 'no-forbidden:function (up|down)\('
  - app-boot
  - app-migrate
  - 'app-probe:active-record:app\models\Post'
  - app-static
---
The application is a Yii 22.0 application created from the basic project template: namespace `app\`, classes under
`src/`. Add a blog post entity backed by the table `post` with these columns:

- `id`: auto-increment primary key.
- `title`: string of at most 255 characters, required.
- `body`: text, required.
- `created_at`: integer, nullable.

Write two files:

- `src/models/Post.php`: the model `app\models\Post`. Users submit `title` and `body` through a form; the form shows
  the labels `Title`, `Body`, and `Created at`.
- `src/migrations/M261013000000CreatePostTable.php`: the migration that creates the table and can be reverted.

The application may configure a table prefix; the table name must honor it.

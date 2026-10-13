---
id: 04-active-form-view
title: ActiveForm view with encoded output
skill: yii2-framework
context:
  - https://yii2-framework.github.io/docs/guide/input-forms/index.md
  - https://yii2-framework.github.io/docs/guide/security-best-practices/index.md
outputs:
  - resources/views/post/update.php
seed:
  - post
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:ActiveForm::begin\('
  - 'grep:ActiveForm::end\('
  - 'grep:Html::encode\('
  - 'no-forbidden:\$_(GET|POST|REQUEST)'
  - 'no-forbidden:<\?=\s*\$model->(title|body)\s*;?\s*\?>'
  - app-boot
  - app-migrate
  - "app-render:resources/views/post/update.php"
  - "html:<form"
  - 'html:name="Post\[title\]"'
  - 'html:<textarea[^>]*name="Post\[body\]"'
  - 'html:&lt;script&gt;alert\(1\)&lt;/script&gt;'
  - 'no-html:<script>alert\(1\)</script>'
---

The application is a Yii 22.0 application created from the basic project template. It has the ActiveRecord model
`app\models\Post` with the attributes `id`, `title`, and `body`.

Write the view `resources/views/post/update.php`. It receives `$model`, an `app\models\Post`, and renders:

- the heading `Update post: ` followed by the current title of the post;
- an edit form with a single-line input for `title`, a multi-line input for `body`, and a submit button labelled
  `Save`.

The title comes from user input.

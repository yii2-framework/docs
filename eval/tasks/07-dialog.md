---
id: 07-dialog
title: Bootstrap 6 confirmation dialog with a trigger button
skill: yii2-bootstrap6-widgets
outputs:
  - resources/views/post/_delete.php
seed:
  - post
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:Dialog::begin\('
  - 'grep:Dialog::end\('
  - 'grep:Html::encode\('
  - 'no-forbidden:yii\\bootstrap5|Modal::|data-bs-toggle="modal"|class="modal'
  - app-boot
  - app-migrate
  - 'app-render:resources/views/post/_delete.php'
  - 'html:<dialog'
  - 'html:data-bs-toggle="dialog"'
  - 'html:method="post"'
  - 'no-html:<script>alert\(1\)</script>'
---
The application is a Yii 22.0 application that uses the `yii2-extensions/bootstrap6` package.

Write the view partial `resources/views/post/_delete.php`. It receives `$model`, an `app\models\Post` whose `title`
comes from user input. Render:

- a button labelled `Delete` that opens a modal confirmation titled `Delete post`;
- in the modal, the text `<title> will be removed.`, where `<title>` is the title of the post;
- in the modal, a form that sends a POST request to the route `post/delete` with the `id` of the post, and a submit
  button labelled `Confirm`.

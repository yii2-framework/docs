---
id: 08-alert-theme
title: Bootstrap 6 alert with an enum theme
skill: yii2-bootstrap6-widgets
outputs:
  - resources/views/site/_saved.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:Alert::(widget|begin)\('
  - 'grep:Theme::SUCCESS'
  - 'no-forbidden:yii\\bootstrap5|alert alert-|alert-success|''theme''\s*=>\s*''success'''
  - app-boot
  - 'app-render:resources/views/site/_saved.php'
  - 'html:theme-success'
  - 'html:Saved'
  - 'html:Your post was saved\.'
  - 'html:data-bs-dismiss="alert"'
---
The application is a Yii 22.0 application that uses the `yii2-extensions/bootstrap6` package.

Write the view partial `resources/views/site/_saved.php` that shows a dismissible success alert with the heading
`Saved` and the text `Your post was saved.`.

Select the color through the package's typed option, not through a CSS class or a plain string.

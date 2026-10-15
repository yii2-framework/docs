---
id: 05-rest-controller
title: REST controller with rate limiting disabled
skill: yii2-framework
context:
  - https://yii2-framework.github.io/docs/guide/rest-quick-start/index.md
  - https://yii2-framework.github.io/docs/guide/rest-controllers/index.md
  - https://yii2-framework.github.io/docs/guide/rest-rate-limiting/index.md
outputs:
  - src/controllers/api/PostController.php
seed:
  - post
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:namespace app\\controllers\\api;'
  - "grep:ActiveController"
  - "grep:modelClass"
  - "grep:rateLimiter"
  - app-boot
  - 'app-probe:rest-no-ratelimit:app\controllers\api\PostController'
  - app-static
---

The application is a Yii 22.0 application created from the basic project template. It has the ActiveRecord model
`app\models\Post`.

Expose `Post` as a JSON REST resource with the standard list, view, create, update, and delete operations. Write
`src/controllers/api/PostController.php` (class `app\controllers\api\PostController`).

The API runs behind a gateway that already enforces request quotas, so this controller must turn off the framework's
built-in rate limiting explicitly. Keep every other default behavior of the framework's REST controllers.

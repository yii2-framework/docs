---
id: 02-controller-filters
title: CRUD controller with access control and verb filtering
skill: yii2-framework
context:
  - https://yii2-framework.github.io/docs/guide/structure-filters/index.md
  - https://yii2-framework.github.io/docs/guide/security-authorization/index.md
outputs:
  - src/controllers/PostController.php
seed:
  - post
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:namespace app\\controllers;'
  - "grep:AccessControl"
  - "grep:VerbFilter"
  - "grep:NotFoundHttpException"
  - 'no-forbidden:\$_(GET|POST|REQUEST)\['
  - 'no-forbidden:createCommand\([^)]*["'']\s*\.'
  - app-boot
  - 'app-probe:controller-filters:app\controllers\PostController'
  - app-static
---

The application is a Yii 22.0 application created from the basic project template: namespace `app\`, classes under
`src/`, views under `resources/views/`. It has an ActiveRecord model `app\models\Post` with the attributes `id`,
`title`, and `body`.

Write `src/controllers/PostController.php` with the actions `index`, `view`, `create`, `update`, and `delete` for
this model. The view files are out of scope; the actions render the views `index`, `view`, `create`, and `update`.

Requirements:

- Guests may use `index` and `view`; only authenticated users may use `create`, `update`, and `delete`.
- `delete` accepts only POST requests.
- A request for a post that does not exist produces a 404 response.

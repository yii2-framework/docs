---
id: 01-install-db
title: Create the application and configure the database
skill: yii2-framework
context:
  - https://yii2-framework.github.io/docs/guide/start-installation/index.md
  - https://yii2-framework.github.io/docs/guide/start-databases/index.md
outputs:
  - COMMANDS.md
  - config/db.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:composer create-project'
  - 'grep:yiisoft/yii2-app-basic:[^[:space:]]*22'
  - 'grep:(--stability[= ]dev|-s dev|22\.0@dev)'
  - 'grep:migrate'
  - 'grep:mysql:host=127\.0\.0\.1;dbname=blog'
  - 'grep:utf8mb4'
  - 'grep:DB_PASSWORD'
  - 'no-forbidden:yiisoft/yii2-app-basic([[:space:]]|$)'
  - 'no-forbidden:yii2-framework/yii2'
  - app-boot
  - app-static
---
Create a new Yii 22.0 web application in a directory named `blog` from the official basic project template. Then
configure its database connection for MySQL: host `127.0.0.1`, database `blog`, user `blog`, charset `utf8mb4`, and
the password read from the `DB_PASSWORD` environment variable.

Write two files in the current directory:

- `COMMANDS.md`: the exact shell commands, in order, that create the project and apply the migrations it ships with,
  in fenced `bash` blocks.
- `config/db.php`: the database component configuration file of the new application, in the form the template
  expects.

Do not run the commands; only write the files.

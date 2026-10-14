---
id: 10-toast-migration
title: Bootstrap 6 automatically shown toast migration
criterion: A2
skill: yii2-bootstrap6-widgets
docs:
  - extensions/bootstrap6/configuration/index.md
  - extensions/bootstrap6/migration/index.md
  - extensions/bootstrap6/reference/toast/index.md
workspace:
  - 10-toast-migration
seed:
  - post
outputs:
  - resources/views/post/_saved.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:yii2\\extensions\\bootstrap6\\Toast'
  - 'grep:Html::encode\('
  - 'grep:BootstrapPluginAsset'
  - 'grep:importJs\('
  - 'no-forbidden:yii\\bootstrap5|window\.bootstrap|class="[^"]*toast|<script|<div'
  - app-boot
  - app-migrate
  - app-static
  - "app-render:resources/views/post/_saved.php"
  - 'html:<div[^>]*class="[^"]*toast'
  - 'html:data-bs-dismiss="toast"'
  - 'html:Post saved'
  - 'html:&lt;script&gt;alert\(1\)&lt;/script&gt;'
  - 'no-html:<script>alert\(1\)</script>'
  - 'html:role="alert"'
  - 'html:aria-live="assertive"'
  - 'html:aria-atomic="true"'
  - 'no-js:window\.bootstrap'
  - "app-probe:toast-shown:resources/views/post/_saved.php"
---

# Task: migrate an automatically shown Bootstrap 6 toast

Work in an isolated Git workspace, not in a complete Yii application. A separate checker will copy your output into
a preconfigured Yii 22.0 application that uses yii2-extensions/bootstrap6 and will render it there.

The existing file resources/views/post/_saved.php is a legacy Bootstrap 5 view. It receives $model, an
app\models\Post whose title comes from user input. Migrate that file to the Bootstrap 6 extension so it renders a
dismissible notification titled "Post saved", includes the post title safely in its body, and shows automatically
when the page loads.

Bootstrap is delivered as an ES module and is not exposed as window.bootstrap. Show the notification by invoking its
plugin instance through the extension's supported bundle helper; a pre-rendered `show` class alone does not exercise
the required module integration. Use the extension's widget and an HTML helper, do not hand-write the toast markup,
and do not retain Bootstrap 5 code.

A local documentation index is available at .eval-docs/INDEX.md. Read it first, then read only the local pages needed
to confirm the migration, output-safety, widget, and asset behavior. Do not use external documentation or network
access. Modify no file other than resources/views/post/_saved.php. When done, report the file changed and the local
documentation pages read.

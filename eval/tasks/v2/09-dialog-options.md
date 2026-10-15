---
id: 09-dialog-options
title: Bootstrap 6 static scrollable dialog
criterion: B1
skill: yii2-bootstrap6-widgets
docs:
  - extensions/bootstrap6/configuration/index.md
  - extensions/bootstrap6/reference/dialog/index.md
outputs:
  - resources/views/site/_terms.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:Dialog::begin\('
  - 'grep:Dialog::end\('
  - 'grep:DialogSize::LG'
  - 'grep:''backdrop''\s*=>\s*''static'''
  - 'grep:''scrollable''\s*=>\s*true'
  - 'no-forbidden:yii\\bootstrap5|Modal::|data-bs-toggle="modal"|<dialog'
  - app-boot
  - "app-render:resources/views/site/_terms.php"
  - 'html:data-bs-toggle="dialog"'
  - 'html:<dialog[^>]*class="[^"]*dialog-lg[^"]*dialog-scrollable'
  - 'html:data-bs-backdrop="static"'
  - 'html:Terms of service'
  - 'html:Read the terms before continuing\.'
---

Every PHP file you write must declare `strict_types=1` with `declare(strict_types=1);`.

Work in an isolated Git workspace, not in a complete Yii application. Create only the requested output there. A
separate checker will copy it into a preconfigured Yii 22.0 application that already uses the
`yii2-extensions/bootstrap6` package, then render it.

Write the view partial `resources/views/site/_terms.php`. It must render a button labelled `Review terms` that opens
a large dialog titled `Terms of service`. The dialog must stay open when its backdrop is clicked, and only its body
must scroll while the header stays fixed. Its body contains `Read the terms before continuing.`

Use the package widget and its typed size option. Do not write the `<dialog>` markup yourself.

This evaluation provides a local documentation index at `.eval-docs/INDEX.md`. Read that index, then read only the
page or pages needed to confirm the widget options. Do not use external documentation or infer Bootstrap 6 behavior
from Bootstrap 5.

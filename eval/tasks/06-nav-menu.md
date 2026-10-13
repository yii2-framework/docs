---
id: 06-nav-menu
title: Bootstrap 6 navigation with a dropdown entry
skill: yii2-bootstrap6-widgets
outputs:
  - resources/views/layouts/_nav.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:Nav::widget\('
  - 'grep:NavItem::to\('
  - 'grep:NavItem::menu\('
  - "grep:MenuItem::"
  - 'no-forbidden:yii\\bootstrap5'
  - 'no-forbidden:dropdown-menu|data-bs-toggle="dropdown"|class="nav-link'
  - app-boot
  - "app-render:resources/views/layouts/_nav.php"
  - 'html:class="nav nav-pills'
  - 'html:aria-disabled="true"'
  - 'html:https://yii2-framework\.github\.io/docs/api/'
---

The application is a Yii 22.0 application that uses the `yii2-extensions/bootstrap6` package.

Write the view partial `resources/views/layouts/_nav.php` that renders the main navigation as pills with these
entries, in this order:

1. `Home`, linking to the route `site/index`.
2. `Blog`, linking to the route `post/index`.
3. `Docs`, which opens a dropdown with `Guide` (`https://yii2-framework.github.io/docs/guide/`) and `API`
   (`https://yii2-framework.github.io/docs/api/`).
4. `Admin`, shown but disabled.

Build the entries with the package's typed item objects, not with configuration arrays.

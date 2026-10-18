---
title: "Set up the documentation site"
description: "Install the Node and PHP dependencies, import package sources, and preview the documentation locally."
---

These instructions maintain this documentation repository. To create a Yii application, use
[Installing Yii](../guide/start-installation.md).

## Requirements

Use Node 22.12 or newer, npm 9.6.5 or newer, Git, PHP 8.3 or newer, and Composer 2.
The reference generator requires `mbstring`; the FilePond demos also use `fileinfo` and GD.
Live demos use the PHP requirements of their package dependencies. Check `tools/composer.json` and
`tools/demos/composer.json` before changing the PHP version.

## Install and preview

From this repository's root:

```bash
npm ci
composer install --working-dir tools
npm run build
npm run preview
```

The preview is available at `http://localhost:4321/docs/`. The build imports upstream guides and package sources,
generates the PHP API reference and widget demos, builds the site, and checks its internal links and bundle sizes.
It does not publish the result.

To use existing package checkouts at the `localPath` locations declared in the manifests:

```bash
SYNC_LOCAL=1 npm run build
```

Local mode reads their working trees and exports the framework's configured branch without changing any checkout.
Use `npm run dev` after generation for interactive documentation edits. Keep generated guides, catalogs and skills
out of version control; see [source ownership](configuration.md) and [validation](testing.md).

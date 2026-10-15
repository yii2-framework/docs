---
title: "Development"
description: "This document describes development workflows and maintenance tasks for the project."
---

This document describes development workflows and maintenance tasks for the project.

## Demos

The examples page of an extension package (`docs/examples.md` in the package repository, synced to
`src/content/docs/extensions/<package>/examples.md`) shows a live demo of each PHP snippet when the package has
`"demos": true` in `packages.json` (Bootstrap 6 and FilePond).

- **Renderer**: `tools/bin/demos` (run by `prebuild` after `tools/bin/reference`, or `npm run demos`) writes one
  Composer project per package in `.cache/demos/<package>/` from `tools/demos/composer.json`, with Yii 22.0 and the
  package installed as `path` repositories from their synced checkouts and no Composer plugins, then renders the
  snippets in a separate PHP process. Each snippet runs in a fresh `yii\web\View` (`$this` in the snippet, widget ids
  from `w0`); the view lays out the page with the CSS, the module scripts and the script blocks the snippet
  registered. Assets are published from this repository's `node_modules` (`bootstrap`, and `filepond`, its plugins
  and `cropperjs`, are exact devDependencies) to `public/demos/assets/` under stable names. Output: `public/demos/<package>/<slug>.html` and the
  catalog `.cache/demos/<package>.json` (slug, title, snippet hash, source line, status, reason, assets), both
  git-ignored. `--strict` exits with 1 when a snippet fails or is skipped, and `prebuild` passes it, so such a
  snippet fails the build; `--help` lists the options.
- **Page integration**: `plugins/remark-demos.mjs` pairs each `php` code block of the examples page with its demo
  (by a hash of the code) and replaces it, with the `html` block that follows, by a `<docs-demo>` block: Preview (an
  `<iframe>` of the demo page, so Bootstrap's CSS never reaches the site), PHP and HTML tabs, defined by
  `src/components/DocsDemo.astro` and styled by `src/styles/demos.css`. The demo page follows the site theme and sizes
  its `<iframe>` (`tools/demos/frame.js`). Snippets without a demo keep their code blocks; the Markdown version of the
  page and the `llms` bundles keep the code blocks only. `postbuild` (`scripts/check-site.mjs`) fails when an
  `<iframe>` or a demo asset is missing.

### Writing examples that render

Every `php` block runs as a demo, so write each one as code that works in a view:

- Echo the markup (`echo Alert::widget([...])`) or use `begin()` and `end()` in the same block. A block with
  `begin()` and no `end()`, a configuration array (`return [...]`) or a class declaration is skipped, not failed.
- Imports and variables carry over within a `##` section: a block may use the classes imported by an earlier block,
  and a variable keeps the value of the first heading that defined it (the field examples use the `$form` of the
  first form). A block that declares a `yii\base\Model` subclass makes an instance of it available as `$model`.
- A block that only registers scripts (for example showing a Toast) runs after the previous demo of its heading.
- Root-relative images (`/img/user.png`) are replaced by a placeholder in the demo page; links and form submissions
  do not navigate.
- A block that throws or raises a warning is reported as failed (`[demos] ... failed <slug> (docs/examples.md:<line>)`)
  and fails the build; fix the example in the package repository.

To add a package, write its `docs/examples.md` in this style, add the npm packages its asset bundles publish from
`@npm` as exact devDependencies, set `"demos": true` in `packages.json` and run
`SYNC_LOCAL=1 npm run build` (or `npm run sync:local && php tools/bin/demos`).

## Theme

The site theme lives in `src/styles/theme.css`, registered in `customCss` in `astro.config.mjs` before
`src/styles/custom.css`. Starlight keeps its own styles in CSS cascade layers; files in `customCss` are unlayered, so
their rules override Starlight without `!important`.

- **Fonts**: Atkinson Hyperlegible Next (text) and Atkinson Hyperlegible Mono (code), both under the SIL Open Font
  License, installed from npm (`@fontsource-variable/atkinson-hyperlegible-next`,
  `@fontsource-variable/atkinson-hyperlegible-mono`). Vite bundles the `woff2` files into `dist/_astro/`; the build
  fetches nothing from the network. Each font is split by `unicode-range`, so a page downloads only the subsets it
  uses, and Starlight falls back to the system fonts for scripts they do not cover.
- **Type and layout**: `--sl-text-*` and `--sl-line-height` set the type scale (17px body text, line height 1.7);
  `--sl-content-width` (56rem) and `--sl-sidebar-width` (17rem) set the text column and the left sidebar; on screens
  of 72rem and wider, `--toc-width` (15rem) fixes the "On this page" panel and the text column is centred in the
  remaining space.
- **Colours**: the `:root[data-theme='dark']` and `:root[data-theme='light']` blocks set Starlight's grey scale
  (`--sl-color-white` to `--sl-color-black`, text to background), the accent (`--sl-color-accent-low`,
  `--sl-color-accent`, `--sl-color-accent-high`) and the inline code background (`--sl-color-bg-inline-code`). Code
  blocks follow these colours through Starlight's default Expressive Code themes. After changing a colour, check that
  body text, links, headings, the sidebar and the table of contents keep a contrast ratio of at least 4.5:1 (WCAG
  AA) in both themes.

## Extension skill sources

The package `skills/` folders are the editable sources. `scripts/sync.mjs` copies their complete portable bundles to
`.cache/skills/` and `public/skills/`, rejecting duplicate names, invalid frontmatter, and linked resources outside a
bundle. Generated indexes record source refs and file checksums. Never edit or commit those outputs.

The guides remain package `docs/`, and API contracts remain PHPDoc. To add a skill-producing package, set its
`skillsDir` in `packages.json`, sync, run the preparation tests, then build. Publish package sources before a remote
build can consume newly declared skills. See [skill installation](ai-agents.md#extension-skills).

---
title: "Development"
description: "This document describes development workflows and maintenance tasks for the project."
---

This document describes development workflows and maintenance tasks for the project.

## Sync Metadata

To keep configuration files synchronized with the latest template updates, use the `sync-metadata` command. This command
downloads the latest configuration files from the template repository.

```bash
composer sync-metadata
```

### Updated Files

This command updates the following configuration files:

| File               | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `.editorconfig`    | Editor settings and code style configuration |
| `.gitattributes`   | Git attributes and file handling rules       |
| `.gitignore`       | Git ignore patterns and exclusions           |
| `.styleci.yml`     | StyleCI code style analysis configuration    |
| `infection.json5`  | Infection mutation testing configuration     |
| `phpstan.neon`     | PHPStan static analysis configuration        |
| `phpunit.xml.dist` | PHPUnit test configuration                   |

### When to Run

Run this command in the following scenarios:

- **Periodic Updates** - Monthly or quarterly to benefit from template improvements.
- **After Template Updates** - When the template repository has new configuration improvements.
- **Before Major Releases** - Ensure your project uses the latest best practices.
- **When Issues Occur** - If configuration files become outdated or incompatible.

### Important Notes

- This command overwrites existing configuration files with the latest versions from the template.
- Ensure you have committed any custom configuration changes before running this command.
- Review the updated files after syncing to ensure they work with your specific project needs.
- Some projects may require customizations after syncing configuration files.

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

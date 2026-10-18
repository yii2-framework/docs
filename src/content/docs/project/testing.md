---
title: "Validate documentation changes"
description: "Run the site's JavaScript tests, PHP generator checks, complete build and link checks."
---

Run these commands from the documentation repository root after [setup](installation.md).
They validate the commands and outputs maintained here; package runtime suites remain owned by each package.

## Tests and static analysis

```bash
npm test
composer test --working-dir tools
composer analyse --working-dir tools -- --no-progress
```

The JavaScript tests cover sync, skill distribution, Markdown plugins and discovery sizes.
PHPUnit checks the reference generator, JSON schema, link resolution and demo renderer. PHPStan analyzes `tools/`.
Use the repository's Prettier, EditorConfig and Markdown lint configuration together on edited files; passing one
formatter does not prove the other checks pass.

## Complete build and links

```bash
SYNC_LOCAL=1 npm run build
```

`prebuild` synchronizes sources, checks the PHPDoc baseline and renders demos in strict mode. Astro builds HTML,
Markdown and discovery files. `postbuild` validates internal links, anchors, demo assets and bundle-size budgets.
An isolated `astro build` does not prove the prebuild gate passed. Inspect `.cache/reference/report.json` for
unresolved PHPDoc references: they can render as code and evade an HTML link check.

Keep `tools/baseline.json` unchanged while fixing a regression. Repair the documented contract or generator cause;
do not raise counts or hide diagnostics to make a build pass. See [development](development.md) for demo rules.

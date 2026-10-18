---
title: "Documentation maintenance examples"
description: "Choose the source and smallest useful validation loop for a guide, skill, API, or navigation change."
---

Use these entry points when maintaining the site:

| Change                                      | Workflow                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Correct an extension installation step      | Edit its package `docs/installation.md`, sync locally and run the complete build.                                            |
| Improve an agent workflow                   | Edit the package-owned skill, sync its public resources, and verify the requested behavior with the application's checks.    |
| Fix an API description or signature display | Verify PHPDoc against source, run the generator regressions and inspect the resulting catalog.                               |
| Add a widget demo                           | Follow [writing examples that render](development.md#writing-examples-that-render), then run `php tools/bin/demos --strict`. |
| Add container guides                        | Register the non-Composer repository in `tools.json`; use the Development tools section.                                     |
| Change a sidebar label                      | Edit `astro.config.mjs` or package page order, preserve existing page URLs and validate links.                               |

[Source ownership](configuration.md) identifies editable files. [Validation](testing.md) lists the complete checks.
For application code examples, start with the [Yii guide](../guide/index.md) or the package's Examples page.

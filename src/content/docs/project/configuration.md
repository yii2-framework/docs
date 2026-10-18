---
title: "Documentation sources and configuration"
description: "Find the editable source for guides, APIs, skills, navigation, and generated documentation outputs."
---

Edit each document at its owning source, then regenerate the site. A generated copy is not an independent manual.

| Content                               | Editable source                                                  | Generated output                                                         |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework guides and internals        | Tracked content in this repository                               | `src/content/docs/guide/`, translated guide directories and `internals/` |
| Extension guides                      | Each package's README and `docs/`, registered in `packages.json` | `src/content/docs/extensions/<package>/`                                 |
| Container and development tool guides | Each tool's README and `docs/`, registered in `tools.json`       | `src/content/docs/development-tools/<tool>/`                             |
| PHP API contracts                     | Framework and package PHPDoc                                     | API Markdown, `public/reference/` and `.cache/reference/links.json`      |
| Application skills                    | `skills/yii2-framework/` or the owning package's `skills/`       | Package bundles in `.cache/skills/` and `public/skills/`                 |
| Contributor documentation             | `src/content/docs/project/`                                      | HTML and per-page Markdown                                               |
| Navigation and discovery              | `astro.config.mjs`, manifests and page frontmatter               | Sidebar, `llms.txt` and topic bundles                                    |

`packages.json` describes Composer extensions and the framework; `tools.json` describes tools such as Docker that
have no PHP namespace or Composer installation. Register a package's optional `skillsDir` to distribute its complete
skill tree unchanged. The generated skills index records source refs and resource checksums.

The `status` field records package distribution (`published`, `unpublished` or `template`), not the HTTP publication
state of this site. A local build does not make a route public. Remote builds read the configured `repo` and `ref`;
new package sources must exist there before those builds can import them.

See [development](development.md) for manifest fields, demos and theme changes. See
[AI assistance](ai-agents.md) for client installation and focused documentation reading.

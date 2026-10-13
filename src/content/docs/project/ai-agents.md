---
title: "Using the documentation with AI agents"
description: "How coding agents and AI assistants read this site: llms.txt, a Markdown version of every page, the API reference and its JSON catalogs, the Copy and Open in buttons, and the agent skills."
---

This site publishes every page in a form that coding agents can load with few tokens. The content is the
documentation of Yii 22.0; each file states the version and the build date.

## Start with llms.txt

[`llms.txt`](https://yii2-framework.github.io/docs/llms.txt) (about 9k tokens) lists every English page with a short
description, a link to its Markdown version and its approximate size in tokens. An agent reads it first and then
fetches only the pages it needs.

| File                                                                     | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`llms.txt`](https://yii2-framework.github.io/docs/llms.txt)             | Index: one line per page with its size, grouped like the sidebar, then the bundles of each group.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `_llms-txt/<name>.txt`                                                   | Bundles of at most about 30k tokens: one per sidebar group, for example [`getting-started.txt`](https://yii2-framework.github.io/docs/_llms-txt/getting-started.txt), one per extension package (`extensions-<package>.txt`), and the API reference in one bundle per framework namespace group and per package (`api-yii2-di.txt`, `api-localeurls.txt`). Larger groups are split into consecutive chunks named after their first page, namespace or type (`working-with-databases-active-record.txt`). |
| [`llms-full.txt`](https://yii2-framework.github.io/docs/llms-full.txt)   | All English pages except the API reference in one file (about 360k tokens), for indexing tools such as Cursor or Context7. Agents should not read it whole.                                                                                                                                                                                                                                                                                                                                              |
| [`llms-small.txt`](https://yii2-framework.github.io/docs/llms-small.txt) | The same without notes, tips and info blocks (warnings kept), also for indexing tools.                                                                                                                                                                                                                                                                                                                                                                                                                   |

Translations are available on the site, but these files contain the English pages only.

## API reference and reference.json

The [API reference](https://yii2-framework.github.io/docs/api/) is generated from the PHPDoc of the framework
(`yiisoft/yii2`, branch `22.0`) and of each extension: one page per class, interface, trait and enum with its
properties, methods, events, constants and enum cases, under stable anchors such as `#property-options` and
`#method-widget`. Class references in the guide link to it.

For agents, each package also has a JSON catalog in which a class costs a few hundred tokens instead of a page:
[`reference/yii2.json`](https://yii2-framework.github.io/docs/reference/yii2.json) for the framework and
`reference/<package>.json` for the extensions (`bootstrap6`, `filepond`, `localeurls`), described by
[`reference.schema.json`](https://yii2-framework.github.io/docs/reference/reference.schema.json). Each type entry
lists its kind, parents, properties (type, default, description), methods (signature, parameters, return value,
exceptions), events, constants and enum cases.

## Markdown version of each page

Every page has a Markdown version at its URL followed by `index.md`:

- HTML: `https://yii2-framework.github.io/docs/guide/structure-widgets/`
- Markdown: `https://yii2-framework.github.io/docs/guide/structure-widgets/index.md`

The Markdown version contains the title, the description and the page body as written. Links to other pages point to
their Markdown versions. Each HTML page also announces its Markdown version in a
`<link rel="alternate" type="text/markdown">` element.

Translated pages have a Markdown version too, for example
`https://yii2-framework.github.io/docs/ja/guide/start-hello/index.md`.

## Page actions

The menu next to the page title copies the page as Markdown, opens the Markdown version, or opens the page in an AI
assistant such as ChatGPT or Claude with the Markdown URL as context.

## Metadata

Each page declares the documented version and the build date in `<meta name="docs:version">` and
`<meta name="docs:build-date">`, and describes itself with JSON-LD (`TechArticle` and `BreadcrumbList`).

## Agent instructions and skills

- [`AGENTS.md`](https://github.com/yii2-framework/docs/blob/main/AGENTS.md) in the repository tells agents how to use
  the site.
- Agent skills give a coding agent the conventions for common tasks and link the pages of this site:
  [`yii2-framework`](https://github.com/yii2-framework/docs/blob/main/skills/yii2-framework/SKILL.md) (create or
  change a Yii 22.0 application) and
  [`yii2-bootstrap6-widgets`](https://github.com/yii2-framework/docs/blob/main/skills/yii2-bootstrap6-widgets/SKILL.md)
  (Bootstrap 6 UI with the `yii2-extensions/bootstrap6` widgets). Install them with
  `npx skills add yii2-framework/docs`, or one of them with `--skill <name>`.
- A weekly evaluation gives a coding agent only `llms.txt` and one skill per task, asks it to solve eight canonical
  tasks and checks its files in a Yii 22.0 application; a failing task leads to a fix in the documentation or the
  skill ([`eval/README.md`](https://github.com/yii2-framework/docs/blob/main/eval/README.md#cadence)).

## Extension guides

The guides of the `yii2-extensions` packages are published under `/docs/extensions/<package>/`: Bootstrap 6
(`https://yii2-framework.github.io/docs/extensions/bootstrap6/`), FilePond (`.../extensions/filepond/`) and Locale URLs
(`.../extensions/localeurls/`). They are synced from each package
repository on every build and listed in `llms.txt` under "Extensions"; the bundle
[`_llms-txt/extensions-filepond.txt`](https://yii2-framework.github.io/docs/_llms-txt/extensions-filepond.txt) and its
siblings hold the guides of one package each. The
extension guides are in English only.

The examples page of a package with demos (Bootstrap 6) shows each PHP snippet with a Preview, PHP and HTML tab. The
preview is a static page rendered by a Yii 22.0 application at `/docs/demos/<package>/<slug>.html` (for example
`https://yii2-framework.github.io/docs/demos/bootstrap6/alert-1.html`): the widget markup with the CSS and module
scripts it registered. The Markdown version of the page and the `llms` bundles keep the PHP and HTML code blocks
without the demo markup.

## Related resources

Bootstrap 6, used by the `yii2-extensions/bootstrap6` package, publishes its own resources for agents:

- [Bootstrap and AI](https://getbootstrap.com/docs/6.0/getting-started/ai/): `llms.txt`, `llms-full.txt` and
  `AGENTS.md`.
- Skills: `npx skills add twbs/bootstrap`.

## Limits

- The site is static (GitHub Pages): content negotiation with `Accept: text/markdown` and an MCP server aren't
  available.
- Crawlers read `llms.txt` and `robots.txt` only at the host root; root discovery files for
  `https://yii2-framework.github.io/` are planned.

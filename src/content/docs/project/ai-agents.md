---
title: "Using the documentation with AI agents"
description: "How coding agents and AI assistants read this site: llms.txt, a Markdown version of every page, the API reference and its JSON catalogs, the Copy and Open in buttons, and the planned skills."
---

This site publishes every page in a form that coding agents can load with few tokens. The content is the
documentation of Yii 22.0; each file states the version and the build date.

## Start with llms.txt

[`llms.txt`](https://yii2-framework.github.io/docs/llms.txt) lists every English page with a one-line description
and a link to its Markdown version. An agent reads it first and then fetches only the pages it needs.

| File | Contents |
| --- | --- |
| [`llms.txt`](https://yii2-framework.github.io/docs/llms.txt) | Index: one line per page, grouped like the sidebar. |
| [`llms-small.txt`](https://yii2-framework.github.io/docs/llms-small.txt) | All English pages except the API reference in one file, with notes, tips and info blocks removed (warnings kept). |
| [`llms-full.txt`](https://yii2-framework.github.io/docs/llms-full.txt) | All English pages except the API reference in one file. Use it only when the index is not enough. |
| `_llms-txt/<group>.txt` | One file per sidebar group, for example [`getting-started.txt`](https://yii2-framework.github.io/docs/_llms-txt/getting-started.txt); [`api.txt`](https://yii2-framework.github.io/docs/_llms-txt/api.txt) holds the whole API reference. |

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
- Agent skills for Yii and its extensions are planned in the `skills/` directory of the
  [documentation repository](https://github.com/yii2-framework/docs).

## Extension guides

The guides of the `yii2-extensions` packages are published under `/docs/extensions/<package>/`: Bootstrap 6
(`https://yii2-framework.github.io/docs/extensions/bootstrap6/`), FilePond (`.../extensions/filepond/`) and Locale URLs
(`.../extensions/localeurls/`). They are synced from each package
repository on every build and listed in `llms.txt` under "Extensions"; the bundle
[`_llms-txt/extensions.txt`](https://yii2-framework.github.io/docs/_llms-txt/extensions.txt) holds them all. The
extension guides are in English only.

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

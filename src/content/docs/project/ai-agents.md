---
title: "Using the documentation with AI agents"
description: "How coding agents and AI assistants read this site: llms.txt, a Markdown version of every page, the Copy and Open in buttons, and the planned skills."
---

This site publishes every page in a form that coding agents can load with few tokens. The content is the
documentation of Yii 22.0; each file states the version and the build date.

## Start with llms.txt

[`llms.txt`](https://yii2-framework.github.io/docs/llms.txt) lists every English page with a one-line description
and a link to its Markdown version. An agent reads it first and then fetches only the pages it needs.

| File | Contents |
| --- | --- |
| [`llms.txt`](https://yii2-framework.github.io/docs/llms.txt) | Index: one line per page, grouped like the sidebar. |
| [`llms-small.txt`](https://yii2-framework.github.io/docs/llms-small.txt) | All English pages in one file, with notes, tips and whitespace removed. |
| [`llms-full.txt`](https://yii2-framework.github.io/docs/llms-full.txt) | All English pages in one file. Use it only when the index is not enough. |
| `_llms-txt/<group>.txt` | One file per sidebar group, for example [`getting-started.txt`](https://yii2-framework.github.io/docs/_llms-txt/getting-started.txt). |

Translations are available on the site, but these files contain the English pages only.

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
- The API reference (`/docs/api/`) and the extension guides (`/docs/extensions/<package>/`) are planned and are not
  published yet.

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

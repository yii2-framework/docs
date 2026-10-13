# AGENTS.md

Instructions for AI agents that use the Yii documentation published from this repository at
<https://yii2-framework.github.io/docs/>. Contributors to the repository should read
[`src/content/docs/project/`](src/content/docs/project/) instead.

## Version

- The documentation covers **Yii 22.0** (`yii2-framework`), the PHP framework.
- Every page states the version and the build date: `<meta name="docs:version">` and `<meta name="docs:build-date">`
  in HTML, and the header of `llms.txt`.

## Where to start

1. Fetch <https://yii2-framework.github.io/docs/llms.txt>. It lists every English page with a one-line description
   and a link to its Markdown version, grouped like the site navigation.
2. Fetch only the pages the task needs, using their Markdown URLs.
3. Use the bundles only when the index is not enough:
   - <https://yii2-framework.github.io/docs/llms-small.txt>: all English pages, notes, tips and info blocks removed
     (warnings kept).
   - <https://yii2-framework.github.io/docs/llms-full.txt>: all English pages.
   - `https://yii2-framework.github.io/docs/_llms-txt/<group>.txt`: one sidebar group, for example
     `getting-started.txt`.

## Markdown URLs

Prefer the Markdown version of any page: append `index.md` to the page URL.

| HTML | Markdown |
| --- | --- |
| `https://yii2-framework.github.io/docs/guide/structure-widgets/` | `https://yii2-framework.github.io/docs/guide/structure-widgets/index.md` |
| `https://yii2-framework.github.io/docs/ja/guide/start-hello/` | `https://yii2-framework.github.io/docs/ja/guide/start-hello/index.md` |

- Each HTML page links its Markdown version with `<link rel="alternate" type="text/markdown">`.
- Links between pages in the Markdown versions already point to Markdown URLs.
- `[[yii\...]]` references in the text name framework classes and members (for example
  `[[yii\base\Component::on()]]`). They are not links yet.
- `llms*.txt` contain English pages only. Translations exist for some pages under a locale prefix (`/docs/ja/...`).

## Coming next

- API reference generated from the framework PHPDoc: `https://yii2-framework.github.io/docs/api/` (not published yet).
- Extension guides and references: `https://yii2-framework.github.io/docs/extensions/<package>/` (not published yet).
- Agent skills: `skills/<name>/SKILL.md` in this repository (not published yet).

Until then, read the framework source (`yiisoft/yii2`, branch `22.0`) at <https://github.com/yiisoft/yii2/tree/22.0>
for exact signatures.

## Limits

- The site is static (GitHub Pages): no `Accept: text/markdown` content negotiation, no MCP server.
- Discovery files at the host root (`https://yii2-framework.github.io/llms.txt`) are not published yet; use the
  `/docs/` URLs above.

## License

The documentation and this file are licensed under the BSD-3-Clause license.

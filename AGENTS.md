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
   - <https://yii2-framework.github.io/docs/llms-small.txt>: all English guide pages, notes, tips and info blocks
     removed (warnings kept).
   - <https://yii2-framework.github.io/docs/llms-full.txt>: all English guide pages. Neither file contains the API
     reference (about 10 MB); see "API reference" below.
   - `https://yii2-framework.github.io/docs/_llms-txt/<group>.txt`: one sidebar group, for example
     `getting-started.txt`; `api.txt` holds the whole API reference.

## Markdown URLs

Prefer the Markdown version of any page: append `index.md` to the page URL.

| HTML | Markdown |
| --- | --- |
| `https://yii2-framework.github.io/docs/guide/structure-widgets/` | `https://yii2-framework.github.io/docs/guide/structure-widgets/index.md` |
| `https://yii2-framework.github.io/docs/ja/guide/start-hello/` | `https://yii2-framework.github.io/docs/ja/guide/start-hello/index.md` |

- Each HTML page links its Markdown version with `<link rel="alternate" type="text/markdown">`.
- Links between pages in the Markdown versions already point to Markdown URLs.
- References to framework classes and members in the guide (`[[yii\base\Component::on()]]` in the sources) are
  links to the API reference; the few targets the reference does not document are plain code.
- `llms*.txt` contain English pages only. Translations exist for some pages under a locale prefix (`/docs/ja/...`).

## Extension guides

- Guides of the `yii2-extensions` packages live under `https://yii2-framework.github.io/docs/extensions/<package>/`,
  for example `https://yii2-framework.github.io/docs/extensions/bootstrap6/` (Bootstrap 6 widgets),
  `https://yii2-framework.github.io/docs/extensions/filepond/` (FilePond uploads) and
  `https://yii2-framework.github.io/docs/extensions/localeurls/` (language-prefixed URLs). They are synced
  from each package repository on every build; the `llms.txt` section "Extensions" lists the published ones.
- Markdown URLs work the same way: `https://yii2-framework.github.io/docs/extensions/bootstrap6/installation/index.md`.
- The bundle `https://yii2-framework.github.io/docs/_llms-txt/extensions.txt` holds all extension guides.

## API reference

Generated from the PHPDoc of `yiisoft/yii2` (branch `22.0`) and of each extension on every build.

- Framework: <https://yii2-framework.github.io/docs/api/> (namespaces), one page per class, interface, trait and
  enum, for example `https://yii2-framework.github.io/docs/api/yii/base/widget/` (Markdown: append `index.md`).
  The path is the namespace and class name in lower case.
- Extensions: `https://yii2-framework.github.io/docs/extensions/<package>/reference/`, for example
  `https://yii2-framework.github.io/docs/extensions/bootstrap6/reference/alert/`.
- Each page lists the properties (type, default, description, defining class), methods (signature, parameters,
  return value, exceptions), events, constants and enum cases. Stable anchors: `#property-<name>`,
  `#method-<name>`, `#event-<NAME>`, `#const-<NAME>`, `#case-<NAME>`.
- Machine-readable catalogs, one JSON object per package with every type keyed by its fully qualified name:
  <https://yii2-framework.github.io/docs/reference/yii2.json> (framework) and
  `https://yii2-framework.github.io/docs/reference/<package>.json` (`bootstrap6`, `filepond`, `localeurls`). Schema:
  <https://yii2-framework.github.io/docs/reference/reference.schema.json>. Prefer a catalog entry over a page when only
  the signature, types and defaults matter.

## Coming next

- Agent skills: `skills/<name>/SKILL.md` in this repository (not published yet).

## Limits

- The site is static (GitHub Pages): no `Accept: text/markdown` content negotiation, no MCP server.
- Discovery files at the host root (`https://yii2-framework.github.io/llms.txt`) are not published yet; use the
  `/docs/` URLs above.

## License

The documentation and this file are licensed under the BSD-3-Clause license.

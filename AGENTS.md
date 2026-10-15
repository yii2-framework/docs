# AGENTS.md

Instructions for AI agents that use the Yii documentation published from this repository at
<https://yii2-framework.github.io/docs/>. Contributors to the repository should read
[`src/content/docs/project/`](src/content/docs/project/) instead.

## Version

- The documentation covers **Yii 22.0** (`yii2-framework`), the PHP framework.
- HTML pages state the version and build date in `<meta name="docs:version">` and `<meta name="docs:build-date">`.
  The `llms.txt` header also states them; the Markdown page body does not include these metadata fields.

## Where to start

1. If the task names a page, fetch its Markdown directly. Otherwise, fetch
   <https://yii2-framework.github.io/docs/llms.txt> (about 9k tokens). It lists every English page with a
   short description, a link to its Markdown version and its approximate size in tokens, grouped like the site
   navigation.
2. Fetch only the pages the task needs, using their Markdown URLs.
3. Use a bundle only when several pages of one topic are needed. Each bundle
   `https://yii2-framework.github.io/docs/_llms-txt/<name>.txt` holds at most about 30k tokens (a single larger page
   would be the only exception) and is listed in `llms.txt` with its pages and size:
   - guide topics: one per sidebar group, for example `getting-started.txt`;
   - extension guides: one per package, for example `extensions-filepond.txt`;
   - API reference: one per framework namespace group (a namespace with its sub-namespaces) and per package, for
     example `api-yii2-di.txt` (`yii\di`) and `api-localeurls.txt`.

   A group larger than the limit is split into consecutive chunks: the first keeps the group name, the next ones are
   named after their first page, namespace or type (`working-with-databases-active-record.txt`,
   `api-yii2-db.txt` then `api-yii2-db-activerecord.txt`).

4. `llms-full.txt` (about 360k tokens, every English page except the API reference) and `llms-small.txt` (the same
   without notes and tips) are for indexing tools. Do not read them whole.

## Markdown URLs

Prefer the Markdown version of any page: append `index.md` to the page URL.

| HTML                                                             | Markdown                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `https://yii2-framework.github.io/docs/guide/structure-widgets/` | `https://yii2-framework.github.io/docs/guide/structure-widgets/index.md` |
| `https://yii2-framework.github.io/docs/ja/guide/start-hello/`    | `https://yii2-framework.github.io/docs/ja/guide/start-hello/index.md`    |

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
- The bundles `https://yii2-framework.github.io/docs/_llms-txt/extensions-<package>.txt` hold the guides of one package
  (split by topic when larger); `api-<package>*.txt` hold its API reference.
- Live demos: the examples page of a package with demos (Bootstrap 6) shows each PHP snippet rendered by a Yii 22.0
  application. Every demo is a static HTML page at `https://yii2-framework.github.io/docs/demos/<package>/<slug>.html`
  (for example `.../demos/bootstrap6/alert-1.html`) with the widget markup, the CSS and the module scripts it
  registered. The Markdown version of the examples page keeps the PHP and HTML code blocks and has no demo markup.

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

## Agent skills

The framework skill lives in [`skills/`](skills/); extension skills are owned by their packages:

- [`yii2-framework`](skills/yii2-framework/SKILL.md): create or change a Yii 22.0 application.
- `yii2-bootstrap6-widgets`: render UI with `yii2-extensions/bootstrap6`.
- `yii2-filepond-uploads`: compose FilePond inputs and validate and store their encoded uploads.

The build copies extension bundles unchanged to `/docs/skills/<name>/SKILL.md`; `/docs/skills/index.json` records
provenance and checksums. Install from each package repository; a skill inside Composer `vendor/` is not automatically
discovered from the application root.

Install from the application directory using the local-checkout or verified public-source instructions in
[`skills/README.md`](skills/README.md). Public installation requires the skills to exist on the default branch.
Read the `SKILL.md` file directly when native skill loading is unavailable; this does not test client activation.

## Limits

- The site is static (GitHub Pages): no `Accept: text/markdown` content negotiation, no MCP server.
- Discovery files at the host root (`https://yii2-framework.github.io/llms.txt`) are not published yet; use the
  `/docs/` URLs above.

## License

The documentation and this file are licensed under the BSD-3-Clause license.

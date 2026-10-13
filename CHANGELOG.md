# Changelog

## 0.1.0 Under development

- chore: initial commit.
- feat: astro Starlight documentation site.
- fix: add `package-lock.json` to repository for CI deploy.
- chore: align local and CI checks for eslint, codespell, editorconfig, and markdown formatting.
- docs!: migrate autoload guidance to Composer-only flow and replace PHP `7.4` baseline references with PHP `8.2` (https://github.com/yii2-framework/core/pull/5).
- build: upgrade to Astro `7.3.8` and Starlight `0.42.6`, keeping the custom remark/rehype plugins on the `unified()` Markdown processor; add the `rehype-heading-ids-v5` plugin (`github-slugger`) so auto-generated heading anchors keep their Astro 5 IDs (no trailing hyphen).
- fix: resolve relative Markdown links (also in raw HTML) against the source file so content links emit base-absolute page URLs (`/docs/guide/x/#a`) and no longer 404; fix 10 malformed relative links in the content.
- docs: add `description` frontmatter to all 852 Markdown pages, generated from the first paragraph by `scripts/add-descriptions.mjs` (`npm run descriptions`), for `llms.txt` and `<meta name="description">`.
- feat: publish `llms.txt` (every English page with its description, grouped by sidebar section), `llms-full.txt`, `llms-small.txt` and one bundle per sidebar group with `starlight-llms-txt`, stating Yii `22.0` and the build date.
- feat: serve a Markdown version of every page at `<page>/index.md` with `starlight-llm-actions` (links rewritten to Markdown URLs, `<link rel="alternate" type="text/markdown">`, Copy/View as Markdown and Open in buttons).
- feat: add JSON-LD (`TechArticle`, `BreadcrumbList`), `docs:version`/`docs:build-date` meta tags and generated Open Graph images (`astro-og-canvas`) to every page.
- docs: add `AGENTS.md` for agents that use the site and the "Using the documentation with AI agents" page.
- fix: drop note, tip and info blockquotes from `llms-small.txt` (warnings and page descriptions kept; `llms-full.txt` and the group bundles unchanged) and vendor the Noto Sans font of the Open Graph images under `src/assets/fonts/` (OFL) so builds no longer fetch it from api.fontsource.org.
- feat: sync the guides of the extension packages listed in `packages.json` (starting with `yii2-extensions/bootstrap6`) into `/docs/extensions/<package>/` with `scripts/sync.mjs` (`npm run sync`, `npm run sync:local`, run by `prebuild`): README as landing page, frontmatter title/description/order/edit URL, links rewritten, GitHub alerts converted to asides; add the "Extensions" sidebar group, its `llms.txt` section and `_llms-txt/extensions.txt` bundle, and a nightly deploy; packages whose repository does not hold them yet are skipped with a warning.
- feat(skills): add agent skills `yii2-framework` and `yii2-bootstrap6-widgets` under `skills/`, installable with
  `npx skills add yii2-framework/docs`.
- feat(eval): add `eval/`, a local agent evaluation runner (Claude Code headless) with 8 canonical tasks and a
  deterministic checker.
- feat: sync the guides of `yii2-extensions/filepond` and `yii2-extensions/localeurls` (added to `packages.json`)
  and drop Packagist (`poser.pugx.org`) and StyleCI badges from synced READMEs.
- feat(reference): generate the API reference and `reference.json` from PHPDoc with yii2-apidoc: `tools/` Composer
  project (`tools/bin/reference`) that parses the upstream `yiisoft/yii2` `22.0` framework (new `"type": "framework"`
  entry in `packages.json`, obtained by `scripts/sync.mjs`) and the extension sources in one run, writes one Markdown
  page per class, interface, trait and enum (`api/...`, `extensions/<package>/reference/...`) plus namespace index
  pages, one catalog per package (`public/reference/<package>.json`, schema `tools/reference.schema.json`) and a link
  map; repairs apidoc model gaps (enums, `@var` summaries, promoted properties, `readonly`), and checks apidoc
  error/warning and unresolved-link counts against `tools/baseline.json`.
- feat: resolve the guide's `[[yii\...]]` API references (`[[yii\base\Widget]]`, `[[yii\base\Widget::widget()]]`,
  `[[yii\base\Widget::$id]]`, `[[...|label]]`, in every locale and in raw HTML paragraphs) to links to the generated
  API reference (`plugins/remark-yii-links.mjs`, link map from `tools/bin/reference`), also in the Markdown version
  of each page; unknown targets become inline code in an `api-unresolved` span instead of literal `[[...]]` text.
- feat: publish the API reference on the site: `prebuild` runs `tools/bin/reference` after the sync, a collapsed "API
  reference" sidebar group lists the framework namespaces and each extension gets a "Reference" sub-group; type pages
  get Open Graph images and JSON-LD breadcrumbs along their namespaces, no locale fallback copies (English only; the
  language picker and `hreflang` alternates are hidden there), and `_llms-txt/api.txt`; `llms-full.txt` and
  `llms-small.txt` leave the reference out (about 10 MB) and `llms.txt` says where to find it; `AGENTS.md`, the
  "AI agents" page and the README document the reference and the `reference/<package>.json` catalogs.
- ci: install PHP 8.3 and the reference generator (`composer install --no-dev --working-dir tools`) before the Astro
  build; `prebuild` fails when yii2-apidoc errors, warnings or unresolved PHPDoc links grow beyond
  `tools/baseline.json`, and `postbuild` (`scripts/check-site.mjs`) fails on literal `[[` in the English guide or
  broken links in the reference pages; new `tools` workflow runs PHPUnit and PHPStan for `tools/`; `npm test` runs
  the Node tests.

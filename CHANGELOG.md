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

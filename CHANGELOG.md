# Changelog

## 0.1.0 Under development

- chore: initial commit.
- feat: astro Starlight documentation site.
- fix: add `package-lock.json` to repository for CI deploy.
- chore: align local and CI checks for eslint, codespell, editorconfig, and markdown formatting.
- docs!: migrate autoload guidance to Composer-only flow and replace PHP `7.4` baseline references with PHP `8.2` (https://github.com/yii2-framework/core/pull/5).
- build: upgrade to Astro `7.3.8` and Starlight `0.42.6`, keeping the custom remark/rehype plugins on the `unified()` Markdown processor; add the `rehype-heading-ids-v5` plugin (`github-slugger`) so auto-generated heading anchors keep their Astro 5 IDs (no trailing hyphen).
- fix: resolve relative Markdown links (also in raw HTML) against the source file so content links emit base-absolute page URLs (`/docs/guide/x/#a`) and no longer 404; fix 10 malformed relative links in the content.

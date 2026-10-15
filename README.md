<!-- markdownlint-disable MD041 -->
<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://www.yiiframework.com/image/design/logo/yii3_full_for_dark.svg">
        <source media="(prefers-color-scheme: light)" srcset="https://www.yiiframework.com/image/design/logo/yii3_full_for_light.svg">
        <img src="https://www.yiiframework.com/image/design/logo/yii3_full_for_dark.svg" alt="Yii Framework" width="80%">
    </picture>
    <h1 align="center">Yii2 Framework Documentation</h1>
    <br>
</p>
<!-- markdownlint-enable MD041 -->

<p align="center">
    <a href="https://github.com/yii2-framework/docs/actions/workflows/deploy.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-framework/docs/deploy.yml?style=for-the-badge&label=Deploy&logo=github" alt="Deploy">
    </a>
    <a href="https://github.com/yii2-framework/docs/actions/workflows/quality.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-framework/docs/quality.yml?style=for-the-badge&label=Quality&logo=github" alt="Quality">
    </a>
    <a href="https://github.com/yii2-framework/docs/actions/workflows/security.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-framework/docs/security.yml?style=for-the-badge&label=Security&logo=github" alt="Security">
    </a>
</p>

<p align="center">
    <strong>The Definitive Guide to Yii 22.0</strong><br>
    <em>Built with <a href="https://starlight.astro.build">Astro Starlight</a></em>
</p>

## Documentation

The documentation is deployed at **[yii2-framework.github.io/docs](https://yii2-framework.github.io/docs/)**.

- [Guide](https://yii2-framework.github.io/docs/guide/start-prerequisites/) - The Definitive Guide to Yii 22.0
- [Internals](https://yii2-framework.github.io/docs/internals/) - Framework internals documentation

## Agent skills

The [`yii2-framework`](skills/yii2-framework/SKILL.md) skill covers Yii 22.0 applications. Bootstrap 6 and FilePond
own their extension skills in their package repositories. The site imports complete bundles automatically and
publishes [their index](https://yii2-framework.github.io/docs/skills/index.json), with source and file checksums.

See [installation and sources](skills/README.md) and the
[AI guide](https://yii2-framework.github.io/docs/project/ai-agents/) for Claude Code, Codex, and OpenCode discovery and
activation. A passing generated example and a listed skill are separate checks.

## Local Development

```bash
npm install
npm run dev
```

The site will be available at `http://localhost:4321/docs/`.

## Build

```bash
npm run build
npm run preview
```

## Extension docs

The guides of the extension packages listed in `packages.json` are synced into `src/content/docs/extensions/<name>/`
by `scripts/sync.mjs`. The synced files are build input and are never committed (`.gitignore`).

```bash
npm run sync          # shallow clone of each package at its `ref` into .cache/packages/
npm run sync:local    # use each package's `localPath` checkout instead (working tree)
npm run test:sync     # self-tests of the sync script
```

`npm run build` runs the sync and `tools/bin/reference` first (`prebuild`, so PHP and
`composer install --working-dir tools` are needed), so CI clones the packages; `SYNC_LOCAL=1 npm run build` uses the
local checkouts. The deploy workflow also runs nightly to pick up package changes. A package whose repository does
not contain it yet (its `composer.json` name differs from `packagist` in the manifest) is skipped with a
`[sync] skipped <name>` warning and left out of the sidebar; `bootstrap6` is in that state until it is pushed, so CI
shows its docs only after the push. `node scripts/sync.mjs --strict` fails on any skip.

The `status` of a manifest entry is `published` (on Packagist), `unpublished` (not released yet) or `template` (a GitHub
template repository, such as `yii2-extensions/template`: its landing page links "Use this template" instead of
Packagist).

## API reference

`tools/` is a Composer project (PHP 8.2 or later) that generates the API reference with
[yii2-apidoc](https://github.com/yiisoft/yii2-apidoc): one Markdown page per type under `src/content/docs/api/`
(framework, upstream `yiisoft/yii2` branch `22.0`) and `src/content/docs/extensions/<name>/reference/`, the catalogs
`public/reference/<name>.json` and the link map `.cache/reference/links.json` used to turn the guide's
`[[yii\...]]` references into links. All of it is build output (`.gitignore`).

```bash
composer install --working-dir tools
npm run sync && npm run reference   # or `npm run build`, whose prebuild runs both
composer test --working-dir tools   # PHPUnit
```

The framework is an entry of `packages.json` with `"type": "framework"`: the sync clones only its `framework/`
directory (or, with `sync:local`, exports branch `22.0` of the `localPath` clone with `git archive`, without
switching its checkout). Gaps of yii2-apidoc worked around in `tools/src/` are listed in `tools/UPSTREAM.md`.

## Our social networks

[![Follow on X](https://img.shields.io/badge/-Follow%20on%20X-1DA1F2.svg?style=for-the-badge&logo=x&logoColor=white&labelColor=000000)](https://x.com/Terabytesoftw)

## License

[![License](https://img.shields.io/badge/License-BSD--3--Clause-brightgreen.svg?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=555555)](LICENSE)

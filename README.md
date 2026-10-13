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
    <a href="https://github.com/yii2-framework/docs/actions/workflows/linter.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-framework/docs/linter.yml?style=for-the-badge&label=Super-Linter&logo=github" alt="Super-Linter">
    </a>
</p>

<p align="center">
    <strong>The Definitive Guide to Yii 2.0</strong><br>
    <em>Built with <a href="https://starlight.astro.build">Astro Starlight</a></em>
</p>

## Documentation

The documentation is deployed at **[yii2-framework.github.io/docs](https://yii2-framework.github.io/docs/)**.

- [Guide](https://yii2-framework.github.io/docs/guide/start-prerequisites/) - The Definitive Guide to Yii 2.0
- [Internals](https://yii2-framework.github.io/docs/internals/) - Framework internals documentation

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

`npm run build` runs the sync first (`prebuild`), so CI clones the packages; `SYNC_LOCAL=1 npm run build` uses the
local checkouts. The deploy workflow also runs nightly to pick up package changes. A package whose repository does
not contain it yet (its `composer.json` name differs from `packagist` in the manifest) is skipped with a
`[sync] skipped <name>` warning and left out of the sidebar; `bootstrap6` is in that state until it is pushed, so CI
shows its docs only after the push. `node scripts/sync.mjs --strict` fails on any skip.

## Our social networks

[![Follow on X](https://img.shields.io/badge/-Follow%20on%20X-1DA1F2.svg?style=for-the-badge&logo=x&logoColor=white&labelColor=000000)](https://x.com/Terabytesoftw)

## License

[![License](https://img.shields.io/badge/License-BSD--3--Clause-brightgreen.svg?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=555555)](LICENSE)

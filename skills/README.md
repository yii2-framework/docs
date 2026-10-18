# Agent skills

This directory owns [`yii2-framework`](yii2-framework/SKILL.md) and the focused Yii 22.0 subsystem skills listed below.
Package and development-tool skills remain owned by their repositories. Use the
[skill selection and client installation guide](../src/content/docs/project/ai-agents.md#install-the-relevant-skill)
for the current skill names, sources, project paths and activation checks.

## Source ownership

Edit each package's `skills/<name>/` tree at its source. `skillsDir` in `packages.json` or `tools.json` imports the
portable consumer bundle unchanged into `.cache/skills/<name>/` and `public/skills/<name>/` for
distribution. These generated copies are never edited or committed. Each `index.json` records the package, ref,
source commit and resource SHA-256 values; the published index is `/docs/skills/index.json`.

Framework skills also generate readable pages under `/docs/guide/skills/<name>/` during sync. Each entry in
[`navigation.json`](navigation.json) places one skill beside its corresponding guide in the Yii2 sidebar.
Edit the canonical `SKILL.md` and navigation metadata; do not maintain or commit the generated pages.

A package's native aliases point to that single editable tree. Composer installation alone does not make a skill in
`vendor/` discoverable from an application's root. Remote documentation builds require the skill to exist at the
configured source ref; until then use the local checkout installation described in the guide.

## Change and verify

Use portable `name`, `description`, `license` and string-valued `metadata` frontmatter. Scope the skill to a task
family, route to canonical guides and preserve the API in PHPDoc rather than copying manuals into the body.

Sync after source edits, verify bundle checksums, and run the consuming application's relevant checks.

## Framework subsystems

Choose the narrowest skill that covers the change. Each bundle includes the [common conventions](conventions.md)
as `references/conventions.md` so it can be copied independently. Keep those copies byte-identical when changing
the shared contract. The framework skill remains the entrypoint for application setup. For an existing 2.0.x application, use
[`yii2-upgrade-22`](yii2-upgrade-22/SKILL.md) to assess dependencies, applicable changes and upgrade checkpoints;
the subsystem skills cover the affected implementation areas.

| Skill                                                           | Scope                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| [`yii2-autoload-di`](yii2-autoload-di/SKILL.md)                 | Composer autoloading, aliases and dependency injection |
| [`yii2-caching`](yii2-caching/SKILL.md)                         | Cache backends, keys and dependencies                  |
| [`yii2-console-commands`](yii2-console-commands/SKILL.md)       | CLI arguments, options and exit behavior               |
| [`yii2-data-widgets`](yii2-data-widgets/SKILL.md)               | Providers, sorting, pagination and data display        |
| [`yii2-database-migrations`](yii2-database-migrations/SKILL.md) | SQL, ActiveRecord and schema migrations                |
| [`yii2-events-behaviors`](yii2-events-behaviors/SKILL.md)       | Events, reusable behaviors and lifecycle hooks         |
| [`yii2-files-uploads`](yii2-files-uploads/SKILL.md)             | Upload validation, storage and downloads               |
| [`yii2-forms-validation`](yii2-forms-validation/SKILL.md)       | Models, forms and validation strategies                |
| [`yii2-i18n-formatting`](yii2-i18n-formatting/SKILL.md)         | Translations, locales and formatting                   |
| [`yii2-logging-errors`](yii2-logging-errors/SKILL.md)           | Logging, PSR-3 adapters and error rendering            |
| [`yii2-mail`](yii2-mail/SKILL.md)                               | Composition and configured mail transports             |
| [`yii2-mutex`](yii2-mutex/SKILL.md)                             | Lock ownership, contention and release                 |
| [`yii2-rest-apis`](yii2-rest-apis/SKILL.md)                     | REST resources, filters and serialization              |
| [`yii2-security-access`](yii2-security-access/SKILL.md)         | Authentication, authorization and RBAC                 |
| [`yii2-sessions-cookies`](yii2-sessions-cookies/SKILL.md)       | Session state, cookies and storage                     |
| [`yii2-testing-fixtures`](yii2-testing-fixtures/SKILL.md)       | Application tests and isolated fixtures                |
| [`yii2-views-assets`](yii2-views-assets/SKILL.md)               | Views, asset paths and client scripts                  |
| [`yii2-web-routing-actions`](yii2-web-routing-actions/SKILL.md) | URL rules, controllers and module actions              |

# Agent skills

This directory owns [`yii2-framework`](yii2-framework/SKILL.md), the Yii 22.0 application skill.
Package and development-tool skills remain owned by their repositories. Use the
[skill selection and client installation guide](../src/content/docs/project/ai-agents.md#install-the-relevant-skill)
for the current skill names, sources, project paths and activation checks.

## Source ownership

Edit each package's `skills/<name>/` tree at its source. `skillsDir` in `packages.json` or `tools.json` imports the
portable consumer bundle unchanged into `.cache/skills/<name>/` and `public/skills/<name>/` for
distribution. These generated copies are never edited or committed. Each `index.json` records the package, ref,
source commit and resource SHA-256 values; the published index is `/docs/skills/index.json`.

A package's native aliases point to that single editable tree. Composer installation alone does not make a skill in
`vendor/` discoverable from an application's root. Remote documentation builds require the skill to exist at the
configured source ref; until then use the local checkout installation described in the guide.

## Change and verify

Use portable `name`, `description`, `license` and string-valued `metadata` frontmatter. Scope the skill to a task
family, route to canonical guides and preserve the API in PHPDoc rather than copying manuals into the body.

Sync after source edits, verify bundle checksums, and run the consuming application's relevant checks.

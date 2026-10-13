# Agent skills

This directory is the canonical source of the agent skills for Yii 22.0 and its extensions. Each skill is one
`SKILL.md` file that a coding agent loads when a task matches its `description`.

- [`yii2-framework`](yii2-framework/SKILL.md): create or change a Yii 22.0 application.
- [`yii2-bootstrap6-widgets`](yii2-bootstrap6-widgets/SKILL.md): render Bootstrap 6 UI with the
  `yii2-extensions/bootstrap6` widgets in views.

## Install

```bash
npx skills add yii2-framework/docs                                    # pick skills and agents interactively
npx skills add yii2-framework/docs --skill yii2-bootstrap6-widgets    # one skill
npx skills add yii2-framework/docs --list                             # list the skills, install nothing
```

The [`skills` CLI](https://github.com/vercel-labs/skills) reads the default branch and copies the selected skills
into the directory of each agent (`.claude/skills/`, `.agents/skills/` and others).

## Layout and frontmatter

- One directory per skill: `skills/<name>/SKILL.md`. The CLI also finds them with `npx skills add <path> --list`
  on a local checkout, which is the quickest check after a change.
- Frontmatter keys: `name` (kebab-case, equal to the directory name), `description` (one sentence that says when to
  use the skill), `license: BSD-3-Clause`, and `guide` (the documentation entry point the skill builds on).
- The body is a workflow of numbered steps for one task family; it names real classes, methods and commands only,
  and links the guide pages instead of repeating them.

## Change a skill

1. Verify every class, method, option and command against the source (`yiisoft/yii2` branch `22.0`, the package
   `src/`) or the API reference.
2. Run the evaluation tasks that use the skill (`skill:` in `eval/tasks/*.md`), for example
   `eval/run.sh --task 08-alert-theme --model sonnet`. When a task fails, fix the skill or the guide, not the task.
   The weekly cadence is described in [`eval/README.md`](../eval/README.md#cadence).
3. Add a line to `CHANGELOG.md`.

## Copies in package repositories

A package may carry a verbatim copy of its skill, so that `npx skills add yii2-extensions/<package>` works too. This
directory stays the source; copies are refreshed by hand after a change here:

1. Copy `skills/<name>/SKILL.md` unchanged to `skills/<name>/SKILL.md` in the package repository.
2. Confirm the copy is identical (`diff`) and that `npx skills add <package checkout> --list` lists it.
3. Commit it in the package repository as `docs: sync the <name> skill from yii2-framework/docs@<short commit>.`

No copy exists yet; the first one planned is `yii2-bootstrap6-widgets` in `yii2-extensions/bootstrap6`.

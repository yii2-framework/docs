# Agent skills

This directory owns the `yii2-framework` application skill. Extension skills are edited in their package repositories:

| Skill                     | Editable source                                                      |
| ------------------------- | -------------------------------------------------------------------- |
| `yii2-framework`          | [`yii2-framework/SKILL.md`](yii2-framework/SKILL.md)                 |
| `yii2-bootstrap6-widgets` | `yii2-extensions/bootstrap6/skills/yii2-bootstrap6-widgets/SKILL.md` |
| `yii2-filepond-uploads`   | `yii2-extensions/filepond/skills/yii2-filepond-uploads/SKILL.md`     |

## Install in an application

Run the installer from the application root, choose the client with `--agent`, and keep project scope:

```bash
npx skills@1.7.2 add yii2-framework/docs --skill yii2-framework --agent codex
npx skills@1.7.2 add yii2-extensions/bootstrap6 --skill yii2-bootstrap6-widgets --agent codex
npx skills@1.7.2 add yii2-extensions/filepond --skill yii2-filepond-uploads --agent codex
```

Use `--agent claude-code` or `--agent opencode` for those clients. First use `add <source> --list` to confirm that
its public default branch contains the skill. Until package changes are published, replace the source with the
absolute path of its local checkout. Installing a skill does not install the Composer package.

The installer stores Codex and OpenCode skills under `.agents/skills/<name>/SKILL.md`, and Claude Code skills under
`.claude/skills/<name>/SKILL.md`. Verify the client's discovery and then invoke the skill; an installer listing is
not evidence of native activation. The [AI guide](../src/content/docs/project/ai-agents.md) explains the checks.

## Generated extension bundles

`npm run sync:local` imports extension skills declared by `skillsDir` in `packages.json`. The complete folders are
copied unchanged to `.cache/skills/<name>/` for evaluations and `public/skills/<name>/` for publication. Neither
output is committed or edited. Each generated `index.json` records the package, ref, source commit when available,
and SHA-256 of every resource. The published index is `/docs/skills/index.json`.

Fix an extension skill in its package, then sync and validate the site. The package checkout includes native client
aliases that point to its single editable `skills/` source. Generated bundles are distribution outputs, not another
source to maintain. No extension skill is copied manually into this directory.

## Change and verify

Use portable `name`, `description`, `license`, and string-valued `metadata` frontmatter. Keep the body scoped to a
task family and route to the relevant guides instead of duplicating the generated API. Verify every contract against
the source and versioned acceptance criteria. Run deterministic preparation and fixture checks before model runs;
record discovery, activation, documentation reads, and functional results separately. See [evaluations](../eval/README.md).

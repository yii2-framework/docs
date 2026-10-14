# Agent evaluation

This directory tests the documentation, not a model. A coding agent receives only `llms.txt` and one skill
(`skills/<name>/SKILL.md`), solves a canonical task, and deterministic checks decide whether its files are correct.
It is the documentation equivalent of a mutation test: when a page or a skill is wrong, incomplete, or misleading,
a task fails. It implements criterion 7 of the plan, run locally with Claude Code headless instead of in CI.

## Prerequisites

- PHP 8.3 or later with `pdo_sqlite`, Composer 2, `rsync`, `curl`, and GNU `timeout`.
- Claude Code (`claude`) logged in with the maintainer's subscription. No API key is used.
- `dist/llms.txt` from `npm run build`, or the preview server (`npm run preview`, `http://localhost:4321/docs/`).
  While the public site does not serve `index.md` pages, the runner rewrites the documentation URLs in the prompt to
  the preview server, so keep it running during a model run.
- For tasks 06-08: `yii2-extensions/bootstrap6`. It is not on Packagist yet, so `setup.sh` installs it from a local
  clone (`BOOTSTRAP6_PATH`, default `../yii2-extensions/bootstrap6` next to the `yii2-framework` directory).

## Run

```bash
eval/setup.sh                                    # once: creates eval/app and eval/.cache/app-pristine
eval/run.sh --dry-run                            # assembles every prompt; calls no model
eval/run.sh --task 08-alert-theme --model sonnet # one task, then check.sh on the run
eval/run.sh --model sonnet                       # all tasks
eval/check.sh eval/out/<timestamp>               # re-run the checks of an existing run, no model call
eval/check.sh eval/fixtures/pass --out eval/out/fixtures-pass   # verify the checker itself
eval/check.sh eval/fixtures/pass --task 04-active-form-view --out eval/out/application-flow
```

`run.sh` options: `--task <id>` (repeatable), `--model <alias>` (default `sonnet`), `--effort <level>`,
`--budget-usd <n>` (per task, default `1.00`), `--timeout <seconds>` (default `900`), `--docs-base
auto|public|local|<url>`, `--dry-run`, `--no-check`, `--no-skill`. Run `eval/run.sh --help` for details.

`--no-skill` runs the baseline condition: the prompt omits the `<skill>` block and the words "and the skill" in the
documentation sentence, and nothing else changes (same command line, `llms.txt`, and fresh workspace). `meta.json`
records the `condition` (`skill-injected` or `no-skill`). The runner refuses to start a task if its workspace is not
empty.

Each task runs `claude -p` in a fresh temporary directory with the user's CLAUDE.md, skills, plugins, hooks, MCP
servers, and settings disabled (`--safe-mode --restricted --strict-mcp-config`), only the file tools and `WebFetch`
for the documentation host, no shell, and a dollar cap. `command.txt` in each task directory records the exact
command line.

## Results

```text
eval/out/<UTC timestamp>/
  llms.txt                     the index the run used (rebased URLs)
  summary.md, summary.json     pass/fail per check, totals, task pass rate, reported cost
  results.tsv                  one row per check: task, check, status, detail
  <task-id>/prompt.md          the exact prompt sent on stdin
  <task-id>/command.txt        the CLI command line
  <task-id>/result.json        the CLI JSON result (answer, turns, usage, cost)
  <task-id>/meta.json          wall time, exit code, docs base, and the usage fields of result.json
  <task-id>/files/             what the agent wrote
  <task-id>/checks/            check logs, phpstan.neon, rendered HTML
```

`eval/out/`, `eval/app/`, and `eval/.cache/` are ignored by Git.

The last command reproduces the deterministic form, validation, migration, SQLite persistence/reload, rendering,
and XSS-encoding flow without calling a model. See [AI application flow](ai-application-flow.md) for its recorded
result, limitations, and the remaining native-client evaluation work.

## Cadence

The evaluation runs on the maintainer's machine with the Claude Code subscription; there is no CI job, because a
CI run would need an API key.

1. Run all tasks once a week, and also after a change to `skills/`, to the `llms.txt` generation, or to a guide page
   that a task lists in `context`:

   ```bash
   eval/run.sh --model sonnet
   ```

   While the public site does not serve `index.md` pages, build the site and keep `npm run preview` running first
   (see Prerequisites).

2. Record the run in `internal/research/eval-runs/<YYYY-MM-DD>.md` (git-ignored, template in the README of that
   directory): the totals and the task table of `summary.md`, the cost, and a triage line for every failed task.
3. Phase 1, report only: until three full runs are recorded, the results are a report and block nothing.
4. Phase 2, gate: from the fourth run on, a run passes when at least 7 of the 8 tasks pass on Sonnet and no task
   fails in two consecutive runs.
5. Triage every failed task as one of:
   - documentation gap: fix the guide page, the PHPDoc behind the API reference, or the skill;
   - task or check defect: fix `eval/` and record why (a wrong reference solution, a check that is too strict);
   - model error: record it only.

   Never weaken a task to make it pass. When a task flips between pass and fail, re-run only that task twice
   (`--task <id>`) before acting.

## Checks

| Check                         | Passes when                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `outputs`                     | every path in `outputs` exists and is not empty                                                       |
| `php-lint`                    | every `*.php` passes `php -l`                                                                         |
| `strict-types`                | every `*.php` declares `strict_types=1`                                                               |
| `grep:<ERE>`                  | the extended regular expression matches at least one output file                                      |
| `no-forbidden:<ERE>`          | the expression matches no output file                                                                 |
| `app-boot`                    | with the seeds and outputs copied into `eval/app`, `./yii help` exits 0 (see the note below)          |
| `app-migrate`                 | `migrate`, `migrate/down 1`, and `migrate` succeed (SQLite)                                           |
| `app-probe:<probe>:<arg>`     | `lib/probe.php` passes a named semantic probe, including ActiveRecord validation and persistence      |
| `app-render:<view>`           | the view renders without an exception; `$model` is a `Post` whose title is an XSS payload             |
| `app-static`                  | PHPStan level 5 (`EVAL_PHPSTAN_LEVEL`) reports nothing on the output files under `src/` and `config/` |
| `html:<ERE>`, `no-html:<ERE>` | the rendered HTML matches, or does not match, the expression                                          |

`app-boot` also reports `composer static` as `app-boot:composer-static`; it is skipped while the pristine app fails
it (the template archive omits `phpstan.neon`), and `app-static` replaces it.

`eval/app` is restored from `eval/.cache/app-pristine` before and after each task, so tasks never see each other.
A task passes when none of its checks fails; skipped checks (for example, no app) do not count.

## Add a task

1. Create `eval/tasks/NN-<slug>.md` with frontmatter and the prompt as the body:

   ```yaml
   ---
   id: NN-slug # equals the file name
   title: Short title
   skill: yii2-framework # a directory under skills/
   context: # optional: index.md URLs to list in the prompt
     - https://yii2-framework.github.io/docs/guide/<page>/index.md
   outputs: # files the agent must write, relative to the app root
     - src/controllers/FooController.php
   seed: # optional: directories under eval/seed/ copied into the app first
     - post
   checks:
     - outputs
     - php-lint
     - 'grep:SomeClass::method\('
   ---
   ```

   Quote values that contain `:`, `'`, `\`, or `#` with single quotes (`''` is a literal quote). Double quotes are
   not supported.

2. Write the prompt as a user would: state the goal, the constraints, and the files to write. Never name the class,
   method, or option that the checks look for.
3. Add a reference solution in `eval/fixtures/pass/<id>/files/` and, ideally, a wrong one in
   `eval/fixtures/fail/<id>/files/`; run `eval/check.sh` on both and confirm pass and fail.

## Cost

The smoke run of `08-alert-theme` on Sonnet took 2 turns, 7 seconds, about 47k input tokens (mostly cached), and
reported 0.10 USD at list price (`total_cost_usd`). A subscription pays for it within its usage limits; the figure is
an estimate, not a charge. Expect roughly 1 to 3 USD of list price for all eight tasks, more when the agent fetches
pages. `--budget-usd` caps each task. The CLI has no documented turn limit, so `--timeout` bounds the wall time.

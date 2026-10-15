# AI application flow validation

This report records the deterministic application-flow check used while improving the AI-agent documentation. It
uses the existing task 04 view fixture and its `post` seed; it does not duplicate the model, migration, or view.

## Reproduce

Prepare `eval/app` once as described in the evaluation README, then run:

```bash
eval/check.sh eval/fixtures/pass \
  --task 04-active-form-view \
  --out eval/out/application-flow
```

The generated `summary.md`, `summary.json`, rendered HTML, and per-check logs are written below
`eval/out/application-flow/`. That directory is intentionally ignored because the command reproduces it.

## Verified result

The counts in this section were verified on 2026-10-14 with migration criteria version 1, which required
`safeUp()`/`safeDown()`. They remain historical evidence and are not reclassified by the current criteria. See
[Migration evaluation criteria](migration-criteria.md) for version 2.

Verified against the prepared Yii 22.0 Basic Project Template application:

- the reproduction command completed 1 of 1 tasks with 17 passes, 0 failures, and 1 expected skip;
- the seeded migration applies, reverts, and applies again against SQLite;
- an empty `Post` fails validation for `title` and `body`;
- a valid `Post` saves and reloads by primary key with the same title and body;
- the ActiveForm view renders its title and body controls;
- an XSS title is HTML-encoded; and
- the generated view passes PHP syntax checks.

The task has one expected skip: `app-boot:composer-static`. The pristine template archive does not include the
`phpstan.neon` expected by its Composer script, so the baseline command exits 1. Task 04 does not run `app-static`
because its output is a view under `resources/`. Running tasks 03 and 04 together reports the same baseline skip once
per task, and task 03 applies PHPStan level 5 to its model and migration outputs with a generated configuration.

To reproduce that combined coverage, run:

```bash
eval/check.sh eval/fixtures/pass \
  --task 03-active-record-migration \
  --task 04-active-form-view \
  --out eval/out/application-flow-with-static
```

The verified combined result was 2 of 2 tasks, 33 passes, 0 failures, and 2 expected skips.

Under migration criteria version 2, the same fixture set reports 31 passes, 0 failures, and the same 2 expected
skips. The lower pass count is caused by replacing three overlapping method-name checks with one classifier, not by
reduced coverage.

PHPStan may need permission to open a loopback worker socket. A sandbox that forbids local listening can produce
`Failed to listen on tcp://127.0.0.1:0`; repeat the same deterministic command in an environment that permits the
local socket rather than treating that infrastructure error as an application failure.

## Evidence boundary

This check runs known-good fixtures. It proves that the task, checker, framework boot, database flow, rendered form,
and security assertions work together. It does not prove that a coding agent discovered or activated an installed
skill, generated the files correctly, or used fewer tokens.

A generation evaluation remains separate: run the same task through an authorized client with and without the
skill, retain the generated files and metadata, and compare pass rate, turns, tokens, wall time, and reported cost
over repeated trials. Do not claim token or cost savings from this deterministic fixture check.

## Plan status

| Item                                                                                          | Status                                                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| AI-agent quick start, application skills, client matrix, and selective documentation guidance | Complete                                                 |
| Deterministic validation, rendering, migration, persistence/reload, and static checks         | Complete                                                 |
| Site build, postbuild gates, and local preview                                                | Complete                                                 |
| Native skill discovery and activation in Codex, Claude Code, OpenCode, Copilot, and Amp       | Pending explicit client runs                             |
| Repeated generation comparison with and without the skill                                     | Pending explicit approval of destination, data, and cost |

The pending items require external client communication and may consume subscription quota or incur provider cost.
They are not part of this deterministic check.

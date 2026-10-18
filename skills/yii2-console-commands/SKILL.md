---
name: yii2-console-commands
description: Implement Yii 22.0 console controllers, argument binding, options, command output, and exit behavior. Use for CLI commands and automation; not web actions or automatically executing maintenance commands.
license: BSD-3-Clause
---

# Console commands

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Use the application's console entrypoint/configuration and command namespace or
  controller map. Web and console application components can differ even when
  shared configuration exists. Do not introduce Request/User assumptions or web
  access/verb filters into a console controller.
- Declare positional action arguments and supported `options($actionID)`/
  `optionAliases()` consistently with the existing CLI contract. Preserve inherited
  options when overriding. Verify actual binding/coercion, including missing or
  unexpected values, instead of assuming web parameter rules apply.
- Preserve machine-readable stdout when the command offers it; send diagnostics
  through the application's intended stderr/logging path. Keep help text and
  required option defaults consistent with actual execution.
- Use `yii\console\ExitCode`, not removed EXIT_CODE_NORMAL/EXIT_CODE_ERROR
  controller constants. Return the intended process status rather than merely
  printing a failure. Check `silentExitOnException` if exception exits unexpectedly
  report success.
- `interactive=false` changes prompt behavior; notably confirmation may return
  true without asking. Do not add a noninteractive flag as a harmless convenience
  when a command mutates data. Honor the requested target and authorization before
  running migrations, fixture loads, cache flushes, or other maintenance commands.
- Preserve batch limits, retry/idempotency contracts and progress output when
  they exist. Console completion does not prove a dispatched background job or
  external operation completed.

## Observable acceptance

Exercise help and relevant argument/option parsing through the entrypoint, then
run a harmless or isolated representative operation and assert output plus process
exit status. Cover malformed input and the intended noninteractive behavior when
changed. For a mutating command, use explicit disposable fixtures and verify its
side effects and failure state. Do not run the live operation solely to test help.

## Evidence routes

Read `framework/console/{Application,Controller,Request,Response,ExitCode}.php` and
the applicable `framework/console/controllers/` implementation.
Tests: `tests/framework/console/ControllerTest.php`,
`tests/framework/console/RequestTest.php`, and
`tests/framework/console/controllers/`. Guide: `tutorial-console`.

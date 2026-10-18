---
name: yii2-logging-errors
description: Configure Yii 22.0 logging, profiling, PSR-3 adapters, and exception rendering. Use for diagnostic delivery and error contracts; not an unsolicited monitoring stack replacement.
license: BSD-3-Clause
---

# Logging and error handling

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Distinguish Logger buffering, Dispatcher routing, Target filtering, and export.
  Levels, categories/exclusions, flushInterval, and exportInterval each affect
  delivery. A recorded message need not yet exist in its destination. Preserve
  existing logging targets and flush boundaries, including long-running workers.
- Yii 22.0 includes PSR-3 v3 integration. `PsrLogger` sends PSR calls into Yii;
  `PsrTarget` exports Yii messages to an external PSR logger. Do not wire the latter
  back to PsrLogger: that creates a loop and is rejected. Read level/context mapping
  before assuming a roundtrip preserves a plain string or one-to-one severity.
- `Yii::trace()` is removed; use `Yii::debug()` for the corresponding diagnostic
  level. FileTarget's removed rotateByCopy setting should not be recreated.
  Preserve existing retention/permissions and avoid broad logging of request data.
- Target logVars/maskVars govern attached global context, not every arbitrary
  payload. SensitiveParameter only protects marked stack arguments. Evaluate the
  concrete message/context being added; do not assume a framework feature redacts
  manually interpolated secrets.
- Keep exception status, content negotiation, and production error exposure intact.
  Web and console ErrorHandlers have different outputs. Preserve the original
  exception/cause; removed convertExceptionToError() is not a reason to stringify
  and swallow errors. Custom error rendering must work when the normal layout or
  assets are unavailable.
- Pair profiling begin/end identifiers and categories correctly. Do not make a
  diagnostic change alter the business operation's success/failure contract.

## Observable acceptance

Send representative messages through the configured path and deliberately flush
only the isolated test logger/target as needed. Assert routing, severity, context,
and actual destination output, including intended exclusions. For error rendering
verify the status and response in the applicable debug/production configuration
without exposing a real secret. Report when export, external sink, or worker
shutdown behavior was not exercised.

## Evidence routes

Read `framework/log/{Logger,Dispatcher,Target,PsrLogger,PsrTarget,PsrMessage}.php`,
`framework/base/ErrorHandler.php`, `framework/web/ErrorHandler.php`, and
`framework/console/ErrorHandler.php`. Tests:
`tests/framework/log/{LoggerTest,TargetTest,PsrLoggerTest,PsrTargetTest,PsrMessageTest}.php`,
`tests/framework/web/ErrorHandlerTest.php`, and
`tests/framework/base/ErrorExceptionTest.php`.
Guides: `runtime-logging`, `runtime-handling-errors`.

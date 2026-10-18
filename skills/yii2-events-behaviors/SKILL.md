---
name: yii2-events-behaviors
description: Implement Yii 22.0 component events and reusable behaviors, including record lifecycle behaviors. Use for attachment, handler ordering, and lifecycle effects; not general dependency injection or background jobs.
license: BSD-3-Clause
---

# Events and behaviors

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Distinguish component instance events, class-level handlers, and behavior-owned
  handlers. Preserve registration scope/order and detach the matching handler when
  required. Class handlers and global application state can outlive a single test
  or request in a worker; avoid accidental repeated registration.
- Component behavior definitions attach lazily; a behavior name identifies its
  attachment, and replacing a named behavior can detach prior hooks. Preserve
  inherited behaviors and intended order instead of returning a fresh unrelated
  configuration from an override.
- `Event::$handled` stops remaining handlers; cancelable event validity is a
  separate contract. Inspect the event class and triggering method before assuming
  returning false from an arbitrary callback cancels the underlying operation.
- Lifecycle behaviors depend on their event being triggered. Bulk/direct database
  updates may bypass ActiveRecord events, so Timestamp/Blameable/typecast/locking
  behavior is not guaranteed on every SQL write. Preserve trusted ownership values
  and avoid assuming a web user exists in console execution.
- AttributeTypecastBehavior's configured timing matters: afterValidate,
  beforeSave, afterSave, and afterFind are separate decisions. Type conversion is
  not input validation. Test the actual value at the intended lifecycle boundary.
- An after-event is not inherently an after-commit event. Do not send external mail
  or invalidate irreversible external state based solely on a database event if
  the surrounding transaction can still fail. Preserve the application's existing
  transaction and side-effect arrangement.

## Observable acceptance

Exercise the real triggering operation and assert handler order, count, mutation,
and cancellation according to the relevant event contract. For behaviors verify
attachment/replacement/detachment and inherited behavior preservation where changed.
For record behaviors compare expected values after normal persistence and any
explicit bypass path touched by the task. Restore global handlers between tests.

## Evidence routes

Read `framework/base/{Component,Event,Behavior,ModelEvent,ActionEvent}.php`,
`framework/db/BaseActiveRecord.php`, and the affected file in `framework/behaviors/`.
Tests: `tests/framework/base/{ComponentTest,EventTest,BehaviorTest}.php` and
`tests/framework/behaviors/{AttributeTypecastBehaviorTest,TimestampBehaviorTest,BlameableBehaviorConsoleTest,OptimisticLockBehaviorTest}.php`.
Guides: `concept-events`, `concept-behaviors`.

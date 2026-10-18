---
name: yii2-forms-validation
description: Implement Yii 22.0 model input loading, scenarios, validation, ActiveForm, and client validation strategies. Use for form correctness and mass assignment; not general ActiveRecord query design.
license: BSD-3-Clause
---

# Forms and validation

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- `load()` reports that the expected input scope was found; it does not establish
  valid data or successful persistence. Choose the scenario before loading, inspect
  its safe attributes, and validate server-side before the requested side effect.
  A rule can be inactive or an attribute explicitly unsafe (`!attribute`). Do not
  make privileged fields safe merely so submission succeeds.
- Keep existing `formName()` and tabular indices consistent with rendered inputs.
  Anonymous models must define `formName()` explicitly; use an empty name only
  when the intended input really is unscoped. `loadMultiple()` and
  `validateMultiple()` are distinct operations.
- Read inherited `rules()`, `scenarios()`, labels, and persistence behavior before
  adding overrides. A default or filter changes values; validator ordering and
  `skipOnEmpty`/`skipOnError` can change which values later rules see. Verify the
  intended normalized value as well as errors. `save(false)` bypasses validation
  and is not a substitute for diagnosing invalid submitted data.
- Browser behavior is a separate layer. Core ActiveForm/widgets use
  `yii\web\client\ClientScriptInterface`; validators use
  `yii\validators\client\ClientValidatorScriptInterface`. Without configured
  strategies, server validation still works, but client scripts are absent. The
  `yiisoft/yii2-jquery` extension bootstraps the familiar jQuery strategies; custom
  strategies are equally valid. Inspect the concrete validator (for example,
  EmailValidator): base Validator has no clientScript property and its default
  methods return null/empty options. Preserve the chosen integration instead of adding
  jQuery or replacing it automatically.
  ActiveForm and EmailValidator accept an interface instance or an object
  configuration array in `clientScript`, not a class-string; their typed properties
  are assigned before `init()` can create a strategy from the configuration.
- Core field/form defaults no longer supply Bootstrap styling. Preserve the
  application's UI extension or explicit classes. A client-side error display
  and a server error are separate acceptance conditions.
- `unique`/`exist` validation does not replace database integrity constraints or
  authorization. Keep user input separate from trusted ownership/status values.
  Use the application's error handling for a persistence failure after validation.

## Observable acceptance

Submit representative valid and invalid input through the actual form scope and
scenario. Assert errors attach to the intended attributes and invalid input causes
no persistence or external side effect. Include an attempted assignment to an
excluded field when the safe attribute set changed. Verify normalized values when
filters/defaults changed. For client behavior, exercise the configured strategy in
the browser and retain a server rejection when client checks are bypassed; a PHP
render test alone cannot establish working client validation.

## Evidence routes

Read `framework/base/Model.php::{load,scenarios,safeAttributes,validate,formName}`,
`framework/widgets/ActiveForm.php`, `framework/widgets/ActiveField.php`,
`framework/validators/Validator.php`, and the concrete affected validator, such
as `framework/validators/EmailValidator.php::{init,clientValidateAttribute,getClientOptions}`.
Tests: `tests/framework/base/ModelTest.php`,
`tests/framework/validators/ValidatorTest.php`,
`tests/framework/widgets/ActiveFormTest.php`, and
`tests/framework/widgets/ClientScriptDispatchTestTrait.php`.
Guides: `structure-models`, `input-validation`, `input-forms`,
`input-tabular-input`, `tutorial-core-validators`.

---
name: yii2-views-assets
description: Change Yii 22.0 views, layouts, asset bundles, JavaScript registration, and frontend integration. Use for rendering and asset delivery; not model validation or choosing a new UI framework.
license: BSD-3-Clause
---

# Views and assets

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Preserve layout/view resolution, theme mappings, and page lifecycle calls that
  inject registered assets. Pass the needed data through the existing rendering
  contract. Encode untrusted output for its destination: HTML text, attributes,
  URLs, JSON, and JavaScript are different contexts. Preserve deliberately trusted
  markup rather than double-encoding a widget's rendered HTML.
- `@npm` defaults to `<application basePath>/node_modules`; `@bower` is no longer
  registered. Resolve actual aliases and every required bundle's file paths before
  changing dependencies. Existing extensions may still need Bower/Asset Packagist;
  do not remove them just because core no longer declares those packages.
- Keep the application's asset delivery method: npm/Foxy, CDN, prebuilt files, and
  bundle overrides can all be valid. Check sourcePath publication versus already
  public basePath/baseUrl files, bundle dependencies, and script positions. A
  Composer install alone does not prove JavaScript packages exist.
- `View::registerJs()` at `POS_READY`/`POS_LOAD` uses native DOM event wrappers and
  does not automatically register jQuery or inject `$`. Keep intentional jQuery
  fragments explicitly wrapped with their required asset, or convert the affected
  fragment to native APIs. Avoid changing unrelated scripts or the app's JS stack.
- Client strategies, not removed `useJquery` properties, determine integration for
  affected widgets. Core FQCNs such as JqueryAsset, YiiAsset, Pjax, and MaskedInput
  remaining available do not prove their client behavior is bootstrapped.
- Core widgets no longer assume Bootstrap defaults, but some semantic classes
  remain. Preserve the application's CSS and icons through its existing extension
  or explicit options; ActionColumn's fallback is plain text in a span, not a
  Bootstrap Glyphicon. Check affected selectors and snapshots rather than adding
  Bootstrap to repair appearance.

## Observable acceptance

Render through the affected layout and confirm registered CSS/JS URLs resolve,
ordering satisfies dependencies, and browser execution produces the requested
behavior without missing assets or JavaScript errors. For fragment/AJAX rendering,
exercise that actual insertion path rather than assuming initial-page ready events
will run again. Check relevant appearance at the application's supported viewport
sizes. Verify untrusted text remains inert in its output context. Report when only
server rendering or static asset existence was checked.

## Evidence routes

Read `framework/base/View.php`, `framework/web/View.php`,
`framework/base/Application.php::setVendorPath()`, `framework/web/AssetBundle.php`,
`framework/web/AssetManager.php`, and affected widgets.
Tests: `tests/framework/web/ViewTest.php::testRegisterJsWithNativeWrappers`,
`tests/framework/web/AssetBundleTest.php`, `tests/framework/web/AssetManagerTest.php`,
`tests/framework/widgets/ActiveFieldTest.php`, and
`tests/framework/grid/ActionColumnTest.php`.
Guides: `structure-views`, `structure-assets`, `output-theming`, `helper-html`.

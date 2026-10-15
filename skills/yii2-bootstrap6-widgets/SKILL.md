---
name: yii2-bootstrap6-widgets
description: Use when rendering Bootstrap 6 UI in Yii2 views with yii2-extensions/bootstrap6 widgets, forms, or assets.
metadata:
  guide: https://yii2-framework.github.io/docs/extensions/bootstrap6/
license: BSD-3-Clause
---

# Render Bootstrap 6 with the Yii2 Widgets

This skill covers `yii2-extensions/bootstrap6` (namespace `yii2\extensions\bootstrap6`), which pins Bootstrap
`6.0.0-alpha.1`. Use its widgets instead of writing Bootstrap markup by hand. The `guide` URL above is the planned
location of the package guide on the documentation site and may not resolve yet; the package `docs/` folder holds the
same content (`installation.md`, `configuration.md`, `examples.md`, `migration.md`).

Alpha status: Bootstrap 6 class names, plugin options, and markup may change before beta, so widget output and the
item DTO constructors may change with it. Parts most likely to move: theme and button classes (`theme-*`, `btn-*`),
menu and drawer markup, and plugin names.

## Workflow

- [ ] Step 1: Install the package and the assets
- [ ] Step 2: Load the ES module bundle
- [ ] Step 3: Pick a widget from the catalog
- [ ] Step 4: Configure widgets and build items with the item objects
- [ ] Step 5: Use enums and replace icons
- [ ] Step 6: Encode output and use `begin()` / `end()` correctly
- [ ] Step 7: Build forms
- [ ] Step 8: Avoid the common mistakes and migrate from Bootstrap 5

## Step 1: Install the package and the assets

Requirements: PHP `>=8.3`, Yii2 `2.0.54` or `22.x` (`yiisoft/yii2` `^22.0@dev`), and a Foxy-supported package manager
(the `native` manager needs no Node.js). The `yiisoft/yii2-app-basic` template (branch `22`) already ships Foxy
(`^0.2`, manager `npm`) and `yiisoft/yii2-bootstrap5`; the command below raises Foxy to `^0.4`, and Step 8 covers
replacing the Bootstrap 5 widgets. The package is not yet on Packagist or pushed to GitHub (the maintainer's local
clone is the source today), so the install command below works only after publication.

```bash
composer config allow-plugins.php-forge/foxy true
composer require php-forge/foxy:^0.4 yii2-extensions/bootstrap6:^0.1
```

Foxy merges `bootstrap@6.0.0-alpha.1` into `package.json` and installs it into `node_modules`. Select the manager in
`composer.json` under `config.foxy.manager` (`native`, `npm`, `pnpm`, `yarn`, `bun`, `deno`). Yii 22 resolves `@npm`
to `node_modules`; on Yii 2.0 set `'aliases' => ['@npm' => '@app/node_modules']` in `config/web.php`.

The package registers `yii2\extensions\bootstrap6\Bootstrap` through Composer metadata (the `yii.bootstrap6`
translations). If the application disables extension loading, add `\yii2\extensions\bootstrap6\Bootstrap::class` to
`bootstrap`; without it widgets throw `InvalidConfigException: Unable to locate message source for category
'yii.bootstrap6'`. Browsers: Chrome and Edge 130, Firefox 132, Safari 18 or later.

**Verify:** `composer show yii2-extensions/bootstrap6` lists the package, and
`node_modules/bootstrap/package.json` reports `6.0.0-alpha.1`.

## Step 2: Load the ES module bundle

Each widget registers the assets it needs. Register them yourself only on pages without widgets:

```php
use yii2\extensions\bootstrap6\asset\BootstrapPluginAsset;

BootstrapPluginAsset::register($this); // layout; also registers BootstrapAsset (CSS)
```

Rules:

1. `bootstrap.bundle.js` is an ES module. `BootstrapPluginAsset` renders `<script type="module">`; there is no
   `window.bootstrap`. Never add the file with a classic `<script src>` tag.
2. Run plugin code through the bundle instance returned by `BootstrapPluginAsset::register()`. Its
   `$bundle->importJs()` method wraps the code in a dynamic `import()` of the same URL:

```php
$bundle = BootstrapPluginAsset::register($this);
$this->registerJs(
    $bundle->importJs($this, 'bootstrap.Dialog.getOrCreateInstance(document.getElementById("c")).show();'),
);
```

Other options: set `exposeGlobal: bool = false` on the bundle in the asset manager for legacy scripts that read the
global (assigned asynchronously, so read it after the `load` event); set `cdn: bool = false` on `BootstrapAsset` and
`BootstrapPluginAsset` in `components.assetManager.bundles`, or call
`BootstrapPluginAsset::registerWith($this, cdn: true)`, to use the CDN (`minified: bool|null` forces `.min` files);
`BootstrapIconAsset` publishes the optional Bootstrap Icons font once `bootstrap-icons` is in `package.json`.

**Verify:** the page source contains `<script type="module" src="...bootstrap.bundle...">` and a stylesheet link.

## Step 3: Pick a widget from the catalog

All classes are in `yii2\extensions\bootstrap6`. Widgets extend `Widget` (or `InputWidget`) and take a configuration
array: `Alert::widget([...])`. They expose public properties, not `with*()` methods. Every widget accepts
`options: array = []` (HTML attributes), `clientOptions: array|false = []` (plugin constructor options, or `false` to
skip initialization), and `clientEvents: array = []` (event name to handler source). "Container" widgets wrap the
content between `begin()` and `end()`.

Key properties are listed as `name: type = default`. A type with `null` and no default has the default `null`.
Properties typed with an enum accept the case or its `string` value.

- `Accordion`, collapsible items on `<details>`: `items: array = []`, `flush: bool = false`,
  `autoCloseItems: bool = true`, `icon: string|Stringable|null`.
- `ActiveForm` (container), form with four layouts: `layout: string = LAYOUT_DEFAULT`,
  `nativeValidation: bool|string|null`, `fieldConfig: array|Closure = []`.
- `ActiveField`, form field (`fieldClass`): `inputTemplate: string|null`, `checkOptions: array = []`,
  `horizontalCssClasses: array = []`.
- `Alert` (container), alert with dismiss button: `body: string|Stringable = ''`, `heading: string|Stringable|null`,
  `theme: Theme|string|null`, `closeButton: array|false = []`.
- `Avatar`, image or initials: `src: string|null`, `initials: string|null`, `size: Size|string|null`,
  `status: string|null`, `theme: Theme|string|null`.
- `Badge`, count or label: `label: string|Stringable = ''`, `theme: Theme|string|null`, `pill: bool = false`,
  `outline: bool = false`, `subtle: bool = false`.
- `Breadcrumbs`, trail with dividers: `links: array = []`, `homeLink: array|BreadcrumbLink|false = []`,
  `divider: string = ''`.
- `Button`, button, optional toggle: `label: string|Stringable|null`, `theme: Theme|string|null`,
  `variant: ButtonVariant|string|null = ButtonVariant::SOLID`, `size: Size|string|null`, `toggle: bool = false`.
- `ButtonGroup`, group of buttons: `buttons: array = []`, `vertical: bool = false`, `size: Size|string|null`.
- `ButtonMenu`, button that opens a `Menu`: `label: string|Stringable|null`, `menu: array = []`,
  `split: bool = false`, `placement: Placement|string|null`.
- `ButtonToolbar`, toolbar of groups: `buttonGroups: array = []`.
- `Carousel`, slides with controls: `items: array = []`, `autoplay: bool = false`, `controls: array|false = []`,
  `ends: CarouselEnds|string|null`, `interval: int|null`.
- `Chips` (input), chip input: `placeholder: string|null`, `maxChips: int|null`, `separator: string|null`.
- `Collapse` (container), collapsible element: `show: bool = false`, `horizontal: bool = false`,
  `toggleButton: array|false = false`, `parent: string|null`.
- `Combobox` (input), searchable select: `items: array = []`, `multiple: bool = false`, `search: bool = false`,
  `placement: Placement|string|null`.
- `Datepicker` (input), date input or inline calendar: `inline: bool = false`, `dateMin: string|null`,
  `dateMax: string|null`, `selectionMode: string|null`.
- `Dialog` (container), native `<dialog>` modal: `title: string|Stringable|null`, `footer: string|Stringable|null`,
  `size: DialogSize|string|null`, `toggleButton: array|false = false`, `nonModal: bool = false`.
- `Drawer` (container), native `<dialog>` side panel: `title: string|Stringable|null`,
  `placement: DrawerPlacement|string|null = DrawerPlacement::START`, `responsive: Breakpoint|string|null`,
  `toggleButton: array|false = false`.
- `LinkPager`, pagination links: `pagination: Pagination|null`, `size: Size|string|null`, `theme: Theme|string|null`.
- `Menu`, `.menu` panel: `items: array = []`, `submenuOptions: array = []`.
- `Nav`, nav with route-based active state: `items: array = []`, `style: NavStyle|string|null`,
  `layout: NavLayout|string|null`, `route: string|null`.
- `NavBar` (container), navbar collapsing into a drawer: `brandLabel: string|Stringable|false = false`,
  `brandUrl: array|string|false|null = false`, `expand: Breakpoint|string|false|null = Breakpoint::LG`,
  `drawerOptions: array|false = []`.
- `NavOverflow`, nav with a "More" menu: `nav: array = []`, `collapseBelow: Breakpoint|int|string|null`,
  `moreText: string|false|null`.
- `OtpInput` (input), one-time code input: `length: int = 6`, `mask: bool|null`, `groups: array = []`,
  `type: string|null`.
- `Placeholder`, loading skeleton: `animation: string|null`, `width: int|string|null`, `size: Size|string|null`.
- `Popover` (container), popover on a trigger: `content: string|Stringable|null`, `placement: Placement|string|null`,
  `trigger: string|null`.
- `Progress`, progress or stacked bars: `percent: float|int = 0`, `bars: array = []`, `striped: bool = false`,
  `animated: bool = false`.
- `Range` (input), range slider with ticks: `min: float|int|null`, `max: float|int|null`,
  `step: float|int|string|null`, `ticks: array = []`, `bubble: bool = false`.
- `Spinner`, border or grow spinner: `type: string = TYPE_BORDER`, `theme: Theme|string|null`, `small: bool = false`,
  `label: string|Stringable|null`.
- `Stepper`, ordered steps: `items: array = []`, `horizontal: Breakpoint|bool|string = false`.
- `Strength`, password strength meter: `input: string|null`, `minLength: int|null`, `segments: bool = true`,
  `showText: bool = false`.
- `Tabs`, tab nav and panes: `items: array = []`, `navType: NavStyle|string = NavStyle::TABS`,
  `renderTabContent: bool = true`.
- `Toast` (container), toast with header: `title: string|Stringable|null`, `body: string|Stringable|null`,
  `dateTime: DateTimeInterface|int|string|null`, `closeButton: array|false = []`.
- `ToggleButtonGroup` (input), checkbox or radio buttons: `items: array = []`, `type: string = TYPE_CHECKBOX`,
  `variant: ButtonVariant|string = ButtonVariant::OUTLINE`, `theme: Theme|string|null`.
- `Toggler`, toggles a class or attribute: `target: string|null`, `value: string|null`, `attribute: string = 'class'`.
- `Tooltip` (container), tooltip on a trigger: `title: string|Stringable|null`, `placement: Placement|string|null`,
  `trigger: string|null`, `html: bool = false`.

Input widgets (`Chips`, `Combobox`, `Datepicker`, `OtpInput`, `Range`, `ToggleButtonGroup`) accept
`model: Model|null`, `attribute: string|null`, `name: string|null`, and `value` (scalar), and work through
`$form->field($model, 'x')->widget(Combobox::class, [...])`.
`Html` (`yii2\extensions\bootstrap6\Html`) replaces `yii\helpers\Html`; `Html::badge()`, `Html::closeButton()`,
`Html::theme()`, and `Html::staticControl()` are Bootstrap 6 additions.

**Verify:** `grep -R "class .* extends" vendor/yii2-extensions/bootstrap6/src` lists the class you picked, and
`php -l` passes on the view that uses it.

## Step 4: Configure widgets and build items with the item objects

Widgets take arrays. Item lists accept arrays, strings, and the immutable item objects from
`yii2\extensions\bootstrap6\item`; mix them freely. Prefer the objects: they validate on creation and offer typed
chaining. Each `with*()` returns a new instance; the original is unchanged (`final readonly class`).

| Object           | Used by               | Constructors                                             | Chaining methods                             |
| ---------------- | --------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `NavItem`        | `Nav::$items`         | `to($label, $url = '#')`, `menu($label, $items)`         | `withActive`, `withItems`                    |
| `MenuItem`       | `Menu`, `NavItem`     | `link`, `button`, `submenu`, `header`, `text`, `divider` | `withActive`, `withType`                     |
| `TabItem`        | `Tabs::$items`        | `to($label, $content = null)`, `link`, `menu`            | `withContent`, `withActive`                  |
| `BreadcrumbLink` | `Breadcrumbs::$links` | `to($label, $url = null)`                                | `withActive`, `withUrl`, `withTemplate`      |
| `AccordionItem`  | `Accordion::$items`   | `to($label, $content)`                                   | `withOpen`, `withBodyOptions`, `withVisible` |
| `CarouselItem`   | `Carousel::$items`    | `to($content)`                                           | `withContent`, `withOptions`                 |
| `StepItem`       | `Stepper::$items`     | `to($label, $description = null)`                        | `withActive`, `withUrl`, `withTheme`         |
| `ProgressBar`    | `Progress::$bars`     | `to($percent, $label = '')`                              | `withStriped`, `withAnimated`, `withTheme`   |

Parameter types: `$label`, `$content`, `$description` are `string|Stringable` (`TabItem::to()` `$content` and
`StepItem::to()` `$description` also accept `null`); `$url` is `array|string|null`; `$items` is `array` (`array|string`
for `NavItem`); `$percent` is `float|int`. Withers take the type of the property they replace: `withActive(bool|null)`
(`StepItem`: `bool`), `withDisabled(bool)`, `withVisible(bool)`, `withEncode(bool|null)`, `withOpen(bool)`,
`withStriped(bool)`, `withAnimated(bool)`, `withTheme(Theme|string|null)`, `withType(MenuItemType)`,
`withTemplate(string|null)`, and every `*Options` wither takes `array`.
All objects have `fromArray(array $config)` and `withOptions`.

```php
use yii2\extensions\bootstrap6\enum\NavStyle;
use yii2\extensions\bootstrap6\item\{MenuItem, NavItem};
use yii2\extensions\bootstrap6\Nav;

echo Nav::widget([
    'style' => NavStyle::PILLS,
    'items' => [
        NavItem::to('Home', ['/site/index']),
        NavItem::menu('Docs', [MenuItem::link('Guide', '#'), MenuItem::link('API', '#')]),
        NavItem::to('Disabled')->withDisabled(true),
    ],
]);
```

Leave `active` as `null` so `Nav` detects the active item from the route. Assign the result of a `with*()` call:
`$item = $item->withActive(true);`.

**Verify:** render the view and check that `<ul class="nav nav-pills">` exists and the disabled link has
`aria-disabled="true"`.

## Step 5: Use enums and replace icons

Enums live in `yii2\extensions\bootstrap6\enum`. Properties typed with an enum also accept the case value as a
`string`; an unknown string throws `yii\base\InvalidConfigException`.

| Enum              | Cases                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| `Theme`           | `PRIMARY`, `SECONDARY`, `SUCCESS`, `DANGER`, `WARNING`, `INFO`, `ACCENT`, `INVERSE`     |
| `Size`            | `XS`, `SM`, `LG`, `XL`                                                                  |
| `ButtonVariant`   | `SOLID`, `OUTLINE`, `SUBTLE`, `TEXT`, `STYLED`, `LINK`, `ICON`                          |
| `Breakpoint`      | `SM`, `MD`, `LG`, `XL`, `XXL` (`2xl`); method `prefix($class)`                          |
| `Placement`       | `TOP`, `BOTTOM`, `LEFT`, `RIGHT` with `_START` / `_END`; logical `START`, `END` (menus) |
| `DialogSize`      | `SM`, `LG`, `XL`, `FULLSCREEN`                                                          |
| `DrawerPlacement` | `START`, `END`, `TOP`, `BOTTOM`                                                         |
| `NavStyle`        | `TABS`, `PILLS`, `PILLS_VERTICAL`, `UNDERLINE`                                          |
| `NavLayout`       | `FILL`, `JUSTIFIED`, `VERTICAL`                                                         |
| `CarouselEnds`    | `LOOP`, `WRAP`, `STOP`                                                                  |
| `MenuItemType`    | `LINK`, `BUTTON`, `SUBMENU`, `HEADER`, `TEXT`, `DIVIDER`                                |

`IconSet` (final, `BaseObject`) holds the SVG icons the widgets draw: `accordionChevron`, `comboboxCaret`, and
`menuItemCheck`, each `string|Stringable`. Widgets read it through `Yii::createObject(IconSet::class)`. Replace an
icon for the whole application through the container, or for one widget through its property (`Accordion::$icon`,
`Combobox::$caretIcon`, `Combobox::$checkIcon`, each `string|Stringable|null`):

```php
use UIAwesome\Html\Svg\Svg;
use yii2\extensions\bootstrap6\IconSet;

'container' => ['definitions' => [IconSet::class => ['accordionChevron' => Svg::icon('Flowbite:chevron-down')]]],
```

**Verify:** pass a wrong string such as `'theme' => 'blue'` in a test and expect `InvalidConfigException`; render the
widget with `Theme::SUCCESS` and find `theme-success` in the output.

## Step 6: Encode output and use `begin()` / `end()` correctly

Encoding:

1. Labels and titles are HTML-encoded by default (`encodeLabel`, `encodeLabels`, `encodeTitle`, `encodeHeading`: all
   `bool = true`; item `withEncode(bool|null)`). Do not call `Html::encode()` on them again.
2. These are NOT encoded: `Alert::$body` (`string|Stringable`), `Toast::$body`, `Dialog::$footer`, `Drawer::$footer`
   (`string|Stringable|null`), accordion and tab `content`, carousel slide `content`, `LinkPager` page labels, and
   everything echoed between `begin()` and `end()`.
   Wrap user data in `Html::encode()` before passing it.
3. Use `yii2\extensions\bootstrap6\Html`, not `yii\helpers\Html`, in views that use these widgets.

`begin()` / `end()` widgets: `Alert`, `Collapse`, `Dialog`, `Drawer`, `NavBar`, `Popover`, `Toast`, `Tooltip`.

```php
use yii2\extensions\bootstrap6\Dialog;
use yii2\extensions\bootstrap6\Html;

Dialog::begin(['title' => 'Delete post', 'toggleButton' => ['label' => 'Delete']]);
echo '<p>' . Html::encode($post->title) . ' will be removed.</p>';
Dialog::end();
```

Call `begin()` and `end()` from views and layouts only; the output is buffered by the view. Never forget `end()`:
the widget renders at `end()`.

**Verify:** output a title containing `<b>x</b>` into `body` through `Html::encode()` and confirm the page shows the
tags as text.

## Step 7: Build forms

Use `ActiveForm` from this package so fields get Bootstrap 6 markup (`.form-field`, `.invalid-feedback`, `.check`).

```php
use yii2\extensions\bootstrap6\ActiveForm;

$form = ActiveForm::begin(['layout' => ActiveForm::LAYOUT_FLOATING, 'nativeValidation' => true]);
echo $form->field($model, 'email')->textInput(['type' => 'email']);
echo $form->field($model, 'notify')->checkbox(['switch' => true]);
ActiveForm::end();
```

1. Layouts: `LAYOUT_DEFAULT`, `LAYOUT_HORIZONTAL`, `LAYOUT_INLINE`, `LAYOUT_FLOATING` (`string` constants, set through
   `layout`). Override per form with `fieldConfig`.
2. `nativeValidation` renders `data-bs-validate` (`:user-invalid` styling); `'valid'` also styles valid fields.
3. Switches use `checkbox(['switch' => true])`; the v5 `switchTemplate` is gone.
4. Register `LinkPager` for grids once: `'container' => ['definitions' => [\yii\widgets\LinkPager::class =>
\yii2\extensions\bootstrap6\LinkPager::class]]`.

**Verify:** submit an invalid form and find `is-invalid` on the control and `invalid-feedback` text beside it.

## Step 8: Avoid the common mistakes and migrate from Bootstrap 5

| Mistake                                                             | Correct                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `btn btn-primary`, `alert alert-danger`                             | `Button` / `Alert` with `theme`; markup `btn-solid theme-primary`        |
| `data-bs-toggle="modal"`, `.modal`                                  | `Dialog` with `toggleButton` (`<dialog>`, `data-bs-toggle="dialog"`)     |
| `offcanvas`, `dropdown-menu`                                        | `Drawer`, `Menu` / `ButtonMenu`                                          |
| `navbar-expand-lg`, `d-md-none`, `col-md-6`                         | `lg:navbar-expand`, `md:d-none`, `md:col-6` (`Breakpoint::prefix()`)     |
| `mb-3` for 1rem spacing                                             | `mb-5`; the spacer scale changed                                         |
| `new bootstrap.Modal(el)` in an inline script                       | Register the bundle, then call `$bundle->importJs()` with `bootstrap.Dialog.getOrCreateInstance(el)` |
| `$item->withActive(true);` and discarding the result                | `$item = $item->withActive(true);`                                       |
| `Toast` that never appears                                          | Call `show()` on the instance; the widget only creates it                |
| `Popover` content between `begin()` and `end()` as the popover body | That content is the trigger; set `content`                               |
| `clientOptions` on a standalone `Menu`                              | Set them on `ButtonMenu` or the toggle element                           |
| `yii\bootstrap5\*` classes                                          | `yii2\extensions\bootstrap6\*`; run the renames from `docs/migration.md` |

Migration from `yiisoft/yii2-bootstrap5`: remove the old package, require this one, replace the namespace, then apply
the renames: `Modal` to `Dialog`, `Offcanvas` to `Drawer`, `Dropdown` to `Menu`, `ButtonDropdown` to `ButtonMenu`. The
message category changed from `yii/bootstrap5` to `yii.bootstrap6`. `docs/migration.md` lists every property change.

**Verify:** `grep -RnE 'btn btn-|toggle="(modal|offcanvas|dropdown)"|navbar-expand-|d-md-' resources/views` finds
nothing, and `grep -Rn 'yii.bootstrap5' src config resources` finds nothing after migrating.

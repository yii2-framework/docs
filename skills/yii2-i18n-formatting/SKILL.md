---
name: yii2-i18n-formatting
description: Change Yii 22.0 translations, message sources, locale formatting, and timezone handling. Use for localized content and values; not language-prefixed routing owned by a separate extension.
license: BSD-3-Clause
---

# Translation and formatting

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Separate application language, source language, formatter locale, formatter
  timezone, and storage timezone. Changing one does not necessarily change the
  others. Preserve the project's category names, message identifiers, extraction
  configuration, and translation-file layout.
- `Yii::t()` resolves a category's message source then formats parameters. Keep
  ICU plural/select placeholders intact across languages; concatenated translated
  fragments do not reliably preserve grammar. Verify source-language and fallback
  behavior before adding duplicate message entries or forceTranslation.
- PHP, database, and Gettext message sources have different lookup/cache behavior.
  Keep the selected source and invalidation policy. The removed
  DbMessageSource::CACHE_KEY_PREFIX is not a public cache customization point.
- Inspect ext-intl availability when formatting or message behavior differs.
  Fallback implementations are not proof of identical ICU behavior. Dates must be
  interpreted in the input/default timezone before display conversion; localized
  strings should not silently replace canonical persisted values.
  Preserve an explicitly configured display timezone unless the requested policy
  changes. `Formatter::defaultTimeZone` defaults to UTC; an omitted setting alone
  does not explain differences between users. Verify input representation and
  effective overrides before proposing a different timezone.
- Formatter output is contextual. Raw/HTML formats may preserve markup while
  other formats encode it; choose the format required by the consuming view.
  Translation does not automatically make untrusted substitutions safe in every
  HTML/attribute/JavaScript context.
- Do not translate identifiers or rewrite every source string for a focused
  message change. Locale-prefixed URL behavior belongs to the installed routing
  extension and needs its separately resolved version.

## Observable acceptance

Check the changed messages with representative parameters in the target language
and relevant source/fallback language. For plural/select changes include the
branches actually used. For time or number formatting verify known canonical
values, configured locale/timezone, and any relevant boundary such as DST. State
whether ext-intl or a fallback implementation was exercised. Confirm output remains
safe in its actual rendering context.

## Evidence routes

Read `framework/i18n/{I18N,MessageSource,PhpMessageSource,DbMessageSource,Formatter,MessageFormatter}.php`
and matching files under `framework/messages/`. Tests:
`tests/framework/i18n/I18NTest.php`, `PhpMessageSourceTest.php`,
`MessageFormatterTest.php`, `FallbackMessageFormatterTest.php`, `FormatterDateTest.php`,
and `FormatterNumberTest.php` in that directory.
Guides: `tutorial-i18n`, `output-formatting`.

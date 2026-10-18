---
name: yii2-data-widgets
description: Implement Yii 22.0 data providers, pagination, sorting, GridView, ListView, and DetailView. Use for data listing and display contracts; not replacing the application UI framework.
license: BSD-3-Clause
---

# Data providers and display widgets

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Choose the provider matching the actual data source: ActiveDataProvider for a
  query, SqlDataProvider for SQL plus a correct count, ArrayDataProvider for an
  in-memory collection. Preserve existing lazy loading and key semantics rather
  than materializing all records to fix a display issue.
- Configure sortable/filterable attributes explicitly when input can select
  columns. Filtering, sort parameters, model validation, and pagination are
  separate operations. Preserve parameter names and unique widget/provider IDs
  when several lists share one page.
- Define deterministic ordering when stable pages matter. Count the same logical
  result the widget displays, including joins, grouping, and UNION. Yii 22.0
  ActiveDataProvider applies global UNION sorting/pagination with the explicit
  union modifiers; avoid accidentally applying limits only to the first SELECT.
- Preserve stable row keys for selections/actions, including composite keys where
  applicable. Hide or disable actions according to the UI contract, while keeping
  server authorization in the action itself; an invisible button is not protection.
- Core widget Bootstrap defaults are removed. Keep explicit classes or the current
  UI extension, formats, labels, empty state, and accessibility structure.
  ActionColumn's unknown-icon fallback is a text span. Text/raw/HTML formatting
  have different escaping behavior; do not mark user data raw to restore markup.
- Grid/selection client behavior uses configured clientScript strategies. Server
  HTML alone does not establish filter or selection behavior. Preserve an existing
  jQuery or custom integration without adding a new frontend stack.

## Observable acceptance

Use a representative dataset to verify displayed records, total count, stable
ordering, page boundaries, row keys, and permitted sort/filter parameters. Verify
rendered text encoding and the relevant action URLs. Exercise the configured
browser behavior for changed filters/selections, including multiple widgets when
IDs or parameter names changed. Check relevant styling in the existing UI system.

## Evidence routes

Read `framework/data/{ActiveDataProvider,SqlDataProvider,ArrayDataProvider,Pagination,Sort}.php`,
`framework/grid/{GridView,DataColumn,ActionColumn,CheckboxColumn}.php`, and
`framework/widgets/{ListView,DetailView,LinkPager}.php`. Tests:
`tests/framework/data/`, `tests/framework/grid/`,
`tests/framework/widgets/{ListViewTest,DetailViewTest,LinkPagerTest}.php`, and
`tests/framework/db/sqlite/ActiveDataProviderTest.php` (plus the actual driver).
Guides: `output-data-providers`, `output-data-widgets`, `output-pagination`, `output-sorting`.

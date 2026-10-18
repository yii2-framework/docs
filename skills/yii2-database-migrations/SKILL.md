---
name: yii2-database-migrations
description: Implement Yii 22.0 queries, ActiveRecord persistence, database compatibility, and migrations. Use for SQL/schema or record lifecycle changes; not form UI or database server administration.
license: BSD-3-Clause
---

# Database queries and migrations

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Queries and records

- Identify the actual connection, driver, server version, table prefix, and schema.
  The audited 22.0 baseline requires MySQL 8.0, MariaDB 10.6, MSSQL 2019, Oracle
  12.1, PostgreSQL 14, or SQLite 3.35; CUBRID is removed. Recheck the resolved
  revision before applying these limits. Do not silently switch the application's DBMS.
- Bind untrusted values and allowlist dynamic identifiers. Trusted SQL fragments
  and parameterized string conditions are legitimate; operator/hash conditions do
  not make an untrusted column name safe. Preserve the application's query style.
- Inspect inherited table mapping, attributes, rules, relations, and lifecycle
  behavior before adding ActiveRecord overrides. `save()` validates by default;
  direct/bulk writes and `save(false)` may bypass validation/events. Choose them
  according to the intended contract, including optimistic-lock behavior.
- Explicit query connections now also govern population schema/typecasting.
  Preserve the optional connection in `populateRecord($record, $row, $db = null)`
  overrides and forward it. `attributes()` and `primaryKey()` still use the model's
  default schema; an alternate-only table needs a correct model `getDb()` or
  explicitly compatible metadata. Do not infer all metadata follows `all($db)`.
- Use `unionOrderBy`, `unionLimit`, and `unionOffset` for the complete UNION result;
  ordinary order/limit/offset belong to the first SELECT. Specify a deterministic
  order when pagination requires one. Composite IN/NOT IN null handling and
  driver pagination SQL changed: verify returned rows, not only SQL snapshots.

## Migrations

- Use the existing migration namespace/path and table-prefix convention. Add a
  new migration for already-applied schema history; do not rewrite deployed history.
- Prefer `safeUp()`/`safeDown()` when every operation supports the transaction Yii
  supplies. Use `up()`/`down()` for nontransactional operations or explicit control.
  Keep parent-compatible signatures and the strict `false` failure contract;
  do not add `: void` to a method that must return false. A safe method cannot
  make implicit-commit DDL transactional. Implement actual reversal or explicitly
  return false for an irreversible migration; an empty down method reports success.
- Check existing data and constraints before alteration. MySQL/MariaDB charset
  defaults are now utf8mb4 absent explicit configuration; existing tables are not
  converted automatically. Integer display widths and driver schema reflection
  also changed. MSSQL session binary storage and RBAC FK upgrades are separate
  data-bearing changes: inspect their exact upgrade sections when those tables apply.

## Observable acceptance

Use the application's actual driver for relevant SQL, typecasting, and transaction
checks. Verify selected rows and persisted values, failure/rollback behavior, and
any affected relation or locking contract. Test reversible migrations apply/revert/
reapply only on an explicitly disposable database; assert schema/data each time.
For an irreversible migration verify refusal to revert. Never use production data
for generic reversal checks or claim a SQLite test verifies another driver's DDL.

## Evidence routes

Read `framework/db/{Query,ActiveQuery,ActiveRecord,Migration,Connection}.php`,
`framework/db/conditions/InConditionBuilder.php`, the actual driver's schema/query
builder, and `framework/UPGRADE-22.md` database sections.
Tests: `tests/base/db/BaseQueryBuilderUnion.php`, `tests/base/db/BaseActiveQuery.php`,
`tests/base/db/BaseActiveRecord.php`, `tests/base/db/conditions/InConditionTest.php`,
`tests/framework/console/controllers/MigrateControllerTest.php`, and driver suites
under `tests/framework/db/`. Guides: `db-dao`, `db-query-builder`,
`db-active-record`, `db-migrations`.

# Migration evaluation criteria

The migration task reports three independent properties:

1. `migration-methods` checks that the source declares exactly one complete supported pair. It records whether the
   migration chose `safeUp`/`safeDown` (Yii's transaction wrapper) or direct `up`/`down` methods.
2. `app-migrate` applies, reverts, and reapplies the migration against SQLite. This is the functional reversibility
   result.
3. `app-static` runs PHPStan level 5 over the generated model and migration. This is the type-contract result.

## Criteria versions

### Version 1: transactional convention required

Results recorded through 2026-10-14 before this file was introduced used three source checks that required
`safeUp()` and `safeDown()` and rejected every `up()` or `down()` declaration. The task prompt only asked for a
reversible migration, so this convention was not announced to the no-skill condition.

Historical summaries, generated files, and `internal/ai-agent-validation-report-stage1.md` remain version 1
evidence. Do not recalculate their published 5/6 versus 6/6 checker result under version 2 or present a changed
classification as an improvement.

### Version 2: function, contract, and convention separated

Version 2 accepts either method pair supported by Yii 22.0. `safeUp()` and `safeDown()` are preferred when all
operations can use the transaction created by `yii\db\Migration`; `up()` and `down()` remain valid for operations
that cannot be transactional or need explicit transaction control. The task announces this choice.

The method classifier does not prove reversibility or type safety. Those remain mandatory separate checks through
`app-migrate` and `app-static`. A direct `up(): void`/`down(): void` pair therefore passes method classification but
fails the static contract check, while an untyped direct pair can pass when it also completes the migration round
trip.

Compare future model runs only when they use the same criteria version. Report the selected method pair alongside
the functional and static results.

The version 2 fixture run on 2026-10-14 completed tasks 03 and 04 with 31 passes, 0 failures, and the 2 existing
`app-boot:composer-static` baseline skips. A diagnostic replay of the historical A03 repetition 1 files produced 13
passes, 1 failure, and 1 baseline skip: direct `up`/`down` classification and the migration round trip passed, while
`app-static` still rejected the explicit `: void` return types. This diagnostic does not replace its version 1 result.

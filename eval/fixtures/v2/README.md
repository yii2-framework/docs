# Version 2 reference outputs

Use these fixtures only with `eval/check.sh --task-version v2`. Tasks 09-11 keep their existing IDs and document
criterion B1 in `eval/tasks/v2/`. Every task body explicitly requires `declare(strict_types=1);`; task 10 accepts
valid class imports through PHP tokens, including grouped imports, aliases and fully qualified class access.

The task 10 reference uses a grouped `Html, Toast` import. Tasks 09 and 11 retain their previously verified reference
implementations. No pages, skills, upload requirements or widget behavior were added to the task inputs.

```bash
eval/check.sh eval/fixtures/v2/pass --task-version v2 --out /tmp/yii2-contract-v2
```

Keep the root `tasks/` definitions, original fixtures and historical results as version 1. Do not evaluate a
historical run under v2; prepare a new workspace and record its version and task-definition hash. Checkers reject a
different version or changed definition when client metadata is provided. Fixtures without metadata require an
explicitly selected contract.

---
name: yii2-mutex
description: Implement Yii 22.0 mutex-based coordination with correct lock scope, acquisition failure, and release. Use for critical sections or concurrent workers; not ordinary caching or database transactions.
license: BSD-3-Clause
---

# Mutex coordination

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Identify which processes/hosts must coordinate and which backend they actually
  share. FileMutex, database advisory locks, and external implementations have
  different scope and lifetime. A local filesystem lock is not automatically a
  distributed lock, and a shared cache entry is not an equivalent mutex.
- Use a stable lock name representing the protected resource and preserve existing
  application/environment namespace conventions. Different spellings or backends
  do not protect the same critical section.
- `acquire()` returns a boolean; timeout zero means immediate failure when unavailable.
  Execute protected work only after success, and handle timeout according to the
  application's existing retry/failure contract. Yii tracks acquired names locally;
  acquiring the same name again through one Mutex instance is not reentrant.
- Release an acquired lock in a finally path and check unexpected release failure
  where it affects correctness. autoRelease is a process-shutdown safeguard, not a
  substitute for promptly releasing a lock in a long-running worker.
- `isAcquired()` reports this object's local acquisition state, not whether another
  process holds the lock. Do not use it as a global availability check before
  entering protected work; acquisition itself decides ownership.
- A mutex does not commit/rollback database work or guarantee an external side
  effect occurs exactly once. Preserve database constraints, transactions and
  idempotency requirements. Inspect driver connection lifetime/reconnection when
  relying on a database-backed advisory lock.

## Observable acceptance

With isolated lock names and the intended backend, verify acquisition, failed or
bounded competing acquisition, release, and reacquisition. Test exception cleanup.
Use independent processes/connections when validating actual contention; calling
one in-memory double twice only verifies local bookkeeping. Never acquire a live
production lock merely as a generic test or claim multi-host safety from one host.

## Evidence routes

Read `framework/mutex/{Mutex,FileMutex,DbMutex,MysqlMutex,PgsqlMutex,OracleMutex}.php`
and the selected implementation. Tests: `tests/framework/mutex/MutexTest.php`,
`MutexTestTrait.php`, `FileMutexTest.php`, and driver-specific tests in that directory.
Use the selected class's PHPDoc for backend-specific scope and timeout behavior.

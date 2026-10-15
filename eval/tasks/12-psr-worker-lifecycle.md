---
id: 12-psr-worker-lifecycle
title: PSR bridge worker with lazy sessions and correct finalization
criterion: B1
skill: yii2-psr-bridge-worker
docs:
  - extensions/psr-bridge/configuration/index.md
  - extensions/psr-bridge/examples/index.md
  - extensions/psr-bridge/reference/http/application/index.md
  - extensions/psr-bridge/reference/http/response/index.md
outputs:
  - src/Worker.php
  - config/bridge.php
checks:
  - outputs
  - php-lint
  - strict-types
  - psr-worker
---

Work in an isolated workspace, not a complete application. A separate checker loads your outputs against the
current yii2-extensions/psr-bridge and HttpSoft dependencies. Write only the two requested files. Every PHP file
must declare `strict_types=1` with `declare(strict_types=1);`.

Create app\Worker in src/Worker.php. Its constructor accepts a bridge http\Application. Implement public
serve(\Psr\Http\Message\ServerRequestInterface $request, callable $emit): void. Reuse the supplied application,
handle the request, and pass the returned PSR response to the callback. The callback represents the runtime's
entire emission step and takes a single ResponseInterface argument. Finalize exactly once after that emission
attempt, reporting success only when the callback returns normally. On emission failure, skip after-send and
propagate the exception. On finalization failure, propagate that exception without finalizing again.

Create config/bridge.php returning a closure accepting string $cookieValidationKey and returning an application
configuration fragment. Preserve lazy sessions: no eager session open around bootstrap. Request and response
cookie validation must remain synchronized and incoming cookies must be validated using the supplied key. Disable
native PHP session cookie emission and enable strict mode for unknown session IDs. Persist only db and cache;
request-scoped components must stay isolated. Retain the bridge's per-request upload reset behavior. Do not add
custom session-ID synchronization, raw-cookie parsing, or call Application::run()/Response::send().

The checker will reuse one worker for two visitors and an anonymous request, test malformed/tampered cookies,
force emission failure, then throw from an after-send handler. Read .eval-docs/INDEX.md first, then only the
necessary local pages. Do not use external documentation or network access. Report the files written and the
local pages read.

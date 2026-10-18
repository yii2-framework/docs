# Yii 22.0 conventions

## Resolve the code actually in use

These skills target `yiisoft/yii2` 22.0, which requires PHP 8.3 or newer. A branch
name, constraint, documentation version label, or cached catalog does not identify
the code running in an application.

For a root package, inspect its Composer metadata (for example,
`composer show --self --format=json`). For a dependency, resolve the configured
vendor directory and real installation path, including symlinks. Composer's
`composer/installed.php` package entry records `install_path`, `pretty_version`,
and its selected `reference`; equivalent Composer metadata APIs are valid.
Do not prefer `source.reference` over `dist.reference` blindly. Compare the lock
file separately: desired resolution and installed files can differ.

For every live checkout, inspect current HEAD and relevant files, including local
changes, even when Composer reports a reference and the checkout is clean.
Actual files govern behavior; report metadata disagreement. Uncommitted changes
have no matching upstream SHA. A lock-only project has no installed source to
verify. Resolve each affected extension or template independently.

Prefer matching local guide sources, PHPDoc, tests, and `UPGRADE-22.md`. In a
framework repository these are under `docs/guide/`, `framework/`, and `tests/`;
in a Composer installation the framework directory is the package root and tests
or guides may be absent. Hosted pages and catalogs are usable only after matching
their source provenance to the inspected code. If matching documentation is
unavailable, use available local source and report the documentation gap without
claiming a match. Guide slugs in each skill refer to `docs/guide/<slug>.md` in a
framework source checkout. When matching source provenance has been established,
the portal Markdown route is
`https://yii2-framework.github.io/docs/guide/<slug>/index.md`; its discovery index
is `https://yii2-framework.github.io/docs/llms.txt`. These are lookup routes, not
evidence that the currently hosted build matches. Never infer current 22.0
behavior from Yii 2.0 examples alone.

## Preserve the application contract

Keep the application's namespace, template, directory layout, extensions, CSS
system, configuration merge behavior, strict-types policy, coding standard, and
test organization. Framework examples are not authority to recreate an existing
application or replace its tooling. Preserve inherited public/protected method
signatures and configured PHP support; check actual parent declarations before
overriding. Follow only the parts of a skill needed for the requested change.

Tool names and commands are examples, not mandatory implementations. Use
available equivalent tools that establish the same observable result. Discover
the application's actual test scripts, installed tools, configurations, and suites
before running them; a Composer script name does not prove its prerequisites exist.
Report what ran and what remains unverified. Reading a skill is not proof of native
skill discovery, activation, or behavioral evaluation.

Dependency installation, live migrations, shared-cache flushes, deployments, and
external writes require authorization within the task's scope. Do not perform them
merely to satisfy a suggested check. Use isolated fixtures or disposable resources
for destructive acceptance checks. Do not expand a focused change into a full
upgrade or unrelated security audit.

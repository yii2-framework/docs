---
title: "Build Yii applications with AI agents"
description: "Install the Yii 22.0 application skills, connect your coding agent, and read only the documentation a task needs."
---

Use these skills when creating or changing a Yii 22.0 application. They describe application code conventions,
controllers, models, migrations, forms, tests, and extension widgets. They are not instructions for developing the
framework or maintaining this documentation site.

## Quick start

1. Create the Yii 22.0 application and open its root directory in the coding agent.
2. Install `yii2-framework` for setup, or select a focused framework subsystem skill for an existing application.
   Add a package-owned skill when its workflow applies.
3. Confirm that the client discovers the installed skill, then activate it explicitly for the first task.
4. Start with a small change. Give the agent a known Markdown page when possible; use `llms.txt` only to discover
   documentation when the relevant page is not known.
5. Review the changed files and run the application's own tests, static analysis, and migration checks before
   accepting the result.

Follow [Installing Yii](../guide/start-installation.md), then open the new application's directory in your coding
agent. Keep its existing project instructions and code standards. The skill supplies Yii-specific guidance; it does
not replace your application's requirements or permissions.

The framework skill follows the `yiisoft/yii2-app-basic` template's `22` branch: PHP 8.3+, Composer autoloading,
`src/` for application classes, `resources/views/` for views, and `public/` as the Web root.

## Install the relevant skill

Install from the application's root, not inside Composer `vendor/`. Choose the workflow the application uses:

### Yii framework skills

Each skill has its own page in the corresponding Yii2 navigation section. These pages render the maintained
`SKILL.md` instructions; select the workflow you need, then follow the installation steps below.

| Skill                                                                     | Workflow                   |
| ------------------------------------------------------------------------- | -------------------------- |
| [`yii2-framework`](../guide/skills/yii2-framework.md)                     | Application setup          |
| [`yii2-upgrade-22`](../guide/skills/yii2-upgrade-22.md)                   | Upgrade to Yii 22.0        |
| [`yii2-autoload-di`](../guide/skills/yii2-autoload-di.md)                 | Autoloading and DI         |
| [`yii2-caching`](../guide/skills/yii2-caching.md)                         | Caching                    |
| [`yii2-console-commands`](../guide/skills/yii2-console-commands.md)       | Console commands           |
| [`yii2-data-widgets`](../guide/skills/yii2-data-widgets.md)               | Data widgets               |
| [`yii2-database-migrations`](../guide/skills/yii2-database-migrations.md) | Queries and migrations     |
| [`yii2-events-behaviors`](../guide/skills/yii2-events-behaviors.md)       | Events and behaviors       |
| [`yii2-files-uploads`](../guide/skills/yii2-files-uploads.md)             | Files and uploads          |
| [`yii2-forms-validation`](../guide/skills/yii2-forms-validation.md)       | Forms and validation       |
| [`yii2-i18n-formatting`](../guide/skills/yii2-i18n-formatting.md)         | Translation and formatting |
| [`yii2-logging-errors`](../guide/skills/yii2-logging-errors.md)           | Logging and errors         |
| [`yii2-mail`](../guide/skills/yii2-mail.md)                               | Mail                       |
| [`yii2-mutex`](../guide/skills/yii2-mutex.md)                             | Mutex coordination         |
| [`yii2-rest-apis`](../guide/skills/yii2-rest-apis.md)                     | REST APIs                  |
| [`yii2-security-access`](../guide/skills/yii2-security-access.md)         | Identity and access        |
| [`yii2-sessions-cookies`](../guide/skills/yii2-sessions-cookies.md)       | Sessions and cookies       |
| [`yii2-testing-fixtures`](../guide/skills/yii2-testing-fixtures.md)       | Tests and fixtures         |
| [`yii2-views-assets`](../guide/skills/yii2-views-assets.md)               | Views and assets           |
| [`yii2-web-routing-actions`](../guide/skills/yii2-web-routing-actions.md) | Routing and actions        |

All framework skills are owned by `yii2-extensions/skill`. Each subsystem bundle carries its shared conventions.
Use the local checkout procedure for changes not yet published.

### Package and tool skills

| Skill                           | Owning repository               | Guide                                                       |
| ------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `yii2-bootstrap6-widgets`       | `yii2-extensions/bootstrap6`    | [Bootstrap 6](../extensions/bootstrap6/agents.md)           |
| `yii2-filepond-uploads`         | `yii2-extensions/filepond`      | [FilePond uploads](../extensions/filepond/agents.md)        |
| `yii2-psr-bridge-worker`        | `yii2-extensions/psr-bridge`    | [Worker lifecycle](../extensions/psr-bridge/agents.md)      |
| `yii2-roadrunner-worker`        | `yii2-extensions/road-runner`   | [RoadRunner worker](../extensions/road-runner/agents.md)    |
| `yii2-frankenphp-worker`        | `yii2-extensions/franken-php`   | [FrankenPHP worker](../extensions/franken-php/agents.md)    |
| `yii2-debug-inspection`         | `yii2-extensions/debug`         | [Debug inspection](../extensions/debug/agents.md)           |
| `yii2-phpstan-analysis`         | `yii2-extensions/phpstan`       | [Static analysis](../extensions/phpstan/agents.md)          |
| `yii2-inertia-integration`      | `yii2-extensions/inertia`       | [Inertia integration](../extensions/inertia/agents.md)      |
| `yii2-localeurls-configuration` | `yii2-extensions/localeurls`    | [Language URLs](../extensions/localeurls/agents.md)         |
| `yii2-docker-environment`       | `yii2-extensions/docker-images` | [Docker environment](../development-tools/docker/agents.md) |

The Basic Project Template uses Bootstrap 5, so select the Bootstrap 6 skill only when that extension is
installed. Installing any skill does not install or switch PHP packages.

### Composer installation

Bootstrap [`llm/skills`](https://packagist.org/packages/llm/skills) 1.15.0 once in the application (PHP 8.2+).
Package metadata declares where skills live; it does not install or enable the plugin. Create `skills.json` first:

```json
{
    "target": ".agents/skills",
    "aliases": [".claude/skills"],
    "auto-sync": true,
    "vendor-sources": false,
    "dependencies": {
        "composer": {
            "trusted-replace": true,
            "trusted": ["yii2-extensions/skill", "yii2-extensions/psr-bridge"]
        }
    }
}
```

The common [`yii2-extensions/skill`](https://packagist.org/packages/yii2-extensions/skill) package supplies all twenty
framework workflows, including migration, separately from `yiisoft/yii2`. Install it from Packagist:

```bash
composer config allow-plugins.llm/skills true
composer require --dev llm/skills:1.15.0 "yii2-extensions/skill:^0.1"
composer skills:show
```

Commit the application's `composer.lock` to reproduce its resolved package revisions with `composer install`.
Use `composer update` to select releases within the declared constraints. Both commands synchronize trusted bundles automatically. Add only the exact
extension package names you approve to `trusted`; the PSR Bridge entry above is an example. `trusted-replace` removes
implicit trust in direct dependencies and built-in vendors. Codex, OpenCode and Copilot read `.agents/skills`;
Claude Code uses the alias. No individual npx installation is required.

Keep one donor per skill name. When adopting the common package, remove a previous framework Git/directory source
from `skills.json` to avoid duplicate donors. Edit bundles in their owning repositories; generated skill directories
and aliases belong outside Git. `composer skills:show` lists donor skills and synchronization status, not every
skill available on the internet or proof that an agent loaded them.

The automatic hook reports synchronization failures without failing Composer. Run `composer skills:update` explicitly
when CI must fail on a sync error. Set `auto-sync` to `false` to disable the hook; do not rely on `--no-scripts` for
that with Composer 2.10.3. Donor-owned files are overwritten; retired files remain until deliberate cleanup. Preview
`composer skills:update --clean --dry-run` before cleaning generated output.

#### Git and local bundles

For bundles without a Composer release, register a Git or local source once. For example, Docker remains an image
repository, and a local checkout can supply a skill missing from an installed release:

```bash
composer skills:add yii2-extensions/docker-images --ref=main --skill=yii2-docker-environment
composer skills:add /absolute/path/to/nested-sets-behavior --skill=yii2-nested-sets
```

These explicit sources are trusted by declaration and synchronize on later Composer operations. They are separate
from installed PHP packages and are not versioned by `composer.lock`; pin a checked tag or commit instead of `main`
when reproducibility is needed. Do not use `self.version` between repositories with unrelated versions.

### Optional npx installation

Use the verified `skills` CLI version 1.7.2. List the chosen source before installing:

```bash
npx skills@1.7.2 add yii2-extensions/skill --list
npx skills@1.7.2 add yii2-extensions/skill --skill yii2-framework --agent codex
```

For a package, replace the repository and skill with the matching row above. The installer reads the source's
default branch; unpublished local changes require its absolute checkout path instead of the public repository.
Keep project scope. Use `--agent claude-code` or `--agent opencode` for those clients. Recheck options before using
another installer version.

### Manual installation

Copy the owning repository's complete `skills/<name>/` directory, including referenced resources, into the client
path below. Retain the `<name>/SKILL.md` structure and one copy per client. The portable
[Agent Skills format](https://agentskills.io/home) is separate from client hooks, permissions and activation rules.
The site distributes unchanged package bundles under `/docs/skills/<name>/`; its
[generated index](https://yii2-framework.github.io/docs/skills/index.json) records source refs and resource hashes.
[Contributor source ownership](configuration.md) explains regeneration.

## Configure and verify the client

Installation, discovery, activation and the task result are separate checks. A copied skill proves installation;
a client catalog proves discovery. Neither establishes correct execution.

| Client                                                                                           | Project path                                            | Explicit activation                   | Native evidence to retain                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Codex](https://learn.chatgpt.com/docs/build-skills)                                             | `.agents/skills/<name>/SKILL.md`                        | `$<name>` or skill picker             | Discovered workspace origin, matching loaded body, file changes and acceptance results.         |
| [Claude Code](https://code.claude.com/docs/en/skills)                                            | `.claude/skills/<name>/SKILL.md`                        | `/<name>`                             | Native skill-tool event, consulted pages, file changes and acceptance results.                  |
| [OpenCode](https://opencode.ai/docs/skills/)                                                     | `.opencode/skills/<name>/SKILL.md` or `.agents/skills/` | Request its native skill tool by name | Available-skills list, skill-tool event and functional results for the selected provider/model. |
| [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | `.github/skills/<name>/SKILL.md` or `.agents/skills/`   | `/<name>` in agent chat               | Client discovery and task outputs; installer support alone does not establish activation.       |
| [Amp](https://ampcode.com/docs/customize/skills)                                                 | `.agents/skills/<name>/SKILL.md`                        | Ask it to load the skill              | `amp skills list`, loading trace and task results.                                              |

The npx installer chooses `.agents/skills/` for Codex, OpenCode, Copilot and Amp, and `.claude/skills/` for Claude Code.
When using the Codex extension inside VS Code, follow the Codex row. Use separate workspaces for explicit activation
and automatic selection, and include a negative task where the skill should remain unused.

Start with a small task, inspect the changed files, and run the application's existing checks. A listed Composer
script is not proof that its configuration or tests exist; see
[development checks](../guide/start-installation.md#development-checks).

## Read only the documentation you need

Choose the narrowest resource that covers the task:

| Need                           | Resource                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| A known guide page or API type | Fetch its `<page>/index.md` Markdown directly.                                                      |
| An unknown topic               | Search [`llms.txt`](https://yii2-framework.github.io/docs/llms.txt), then fetch the matching pages. |
| Several related pages          | Use a bundle linked by `llms.txt` when the task genuinely crosses that topic or namespace.          |

`llms.txt` is a proposed public convention for documentation discovery, not a protocol that every agent or client
loads automatically. Give the URL to the agent or ask it to fetch the index when discovery is needed. Do not attach
or reload the complete index when the task already identifies its pages.

The `_llms-txt/<name>.txt` route, its bundle names, and the way large groups are split are conventions of this site,
not requirements of the `llms.txt` proposal. Always take a bundle URL from the current index instead of constructing
or permanently storing it. For example, the current build may list `getting-started.txt`,
`extensions-<package>.txt`, or API namespace bundles such as `api-yii2-di.txt`. Later chunks are named after their
first page, namespace, or type and may change as the documentation grows.

Published multi-page bundles are limited to about 120 kB, estimated as roughly 30k tokens at four bytes per token.
The size shown in `llms.txt` is a planning estimate, not a measurement from a particular model's tokenizer. A bundle
is therefore a budgeted convenience, not a guarantee that it fits every model or task. The index and bundles contain
English pages only.

### Bulk exports for indexing tools

The bulk exports are for retrieval and indexing pipelines, not ordinary interactive tasks:

| Resource                                                                 | Contents and limits                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [`llms-full.txt`](https://yii2-framework.github.io/docs/llms-full.txt)   | Every English page except the API reference. It is too large to load whole into a normal task.                     |
| [`llms-small.txt`](https://yii2-framework.github.io/docs/llms-small.txt) | An abridged non-API export that removes most non-warning blockquotes. It remains large and is intentionally lossy. |

The abridged export keeps warnings, but it can remove notes, tips, information blocks, ordinary quotations, and other
context that matters to an implementation. Use focused page Markdown or the full export when completeness matters.

## API reference and reference.json

The [API reference](../api/index.md) is generated from PHPDoc: the framework's `22.0` branch and the configured
extension sources. Each type has a page with stable member anchors such as `#property-options` and `#method-widget`.

For signatures, types, and defaults, use a filtered entry from
[`reference/yii2.json`](https://yii2-framework.github.io/docs/reference/yii2.json) or `reference/<package>.json`.
Download and filter the catalog outside the model context, for example with `jq`:

```bash
curl -fsS https://yii2-framework.github.io/docs/reference/yii2.json \
  | jq '.types["yii\\base\\Widget"].methods.widget'
```

Check the [catalog schema](https://yii2-framework.github.io/docs/reference/reference.schema.json) for other fields.
A complete catalog can be large, and even an individual class can have many inherited members. Prefer a single
method or property when that answers the question; use the guide when behavior or examples are needed.

## Markdown version of each page

Append `index.md` to a page URL:

- HTML: `https://yii2-framework.github.io/docs/guide/structure-widgets/`;
- Markdown: `https://yii2-framework.github.io/docs/guide/structure-widgets/index.md`.

Markdown contains the title, description, and page body. Relative page links point to Markdown versions; absolute
URLs from the source stay unchanged. The HTML page announces its Markdown URL with `<link rel="alternate" type="text/markdown">`.

Translated content also has Markdown URLs, for example `/docs/ja/guide/start-hello/index.md`. For a page shown through
English fallback in another locale, use its declared alternate URL; do not assume the locale-prefixed Markdown file
exists.

## Page actions

The page menu can copy Markdown, open the Markdown URL, or open an assistant with that URL in its prompt. Passing
a URL does not prove the assistant fetched it; check its retrieved context when accuracy matters.

## Metadata

HTML pages declare the documented version and build date in `<meta name="docs:version">` and
`<meta name="docs:build-date">`, and include JSON-LD (`TechArticle` and `BreadcrumbList`). The `llms.txt` header also
states the version and build date. Markdown page bodies do not currently include those HTML metadata fields.

## Agent instructions and skills

The repository's `AGENTS.md` explains how agents consume the site. Framework skills are maintained in
`yii2-extensions/skill`; extension and tool repositories own their bundles. The site imports these sources and keeps
its local `skills/` copies for compatibility. Maintaining the site uses the separate [contributor documentation](index.md).

## Extension guides

The Extensions navigation and `llms.txt` list packages present in this build. Guides, reference pages, and examples
are synced from their package sources. Match the selected documentation to the
package state being inspected; a
site version label or skill bundle checksum alone does not establish that its
API matches an installed dependency.

For packages with demos, including Bootstrap 6 and FilePond, example snippets are rendered by a Yii 22.0 application
into static pages at `/docs/demos/<package>/<slug>.html`. HTML examples offer Preview, PHP, and HTML tabs. Markdown
and bundles retain the code without embedding demo UI. A build using local sources can differ from the public site.

## Related resources

[Bootstrap and AI](https://getbootstrap.com/docs/6.0/getting-started/ai/) documents Bootstrap's own agent resources.
Use the Yii extension skill for its PHP widgets, item objects, and enums; the upstream Bootstrap documentation
covers the underlying CSS and JavaScript.

## Limits

- The GitHub Pages site is static: it does not provide `Accept: text/markdown` negotiation or a hosted MCP server;
- use the explicit `/docs/llms.txt` URL; host-root discovery files are not published by this repository;
- this documentation records verified installation behavior separately from untested client and model behavior.

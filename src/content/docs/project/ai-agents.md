---
title: "Build Yii applications with AI agents"
description: "Install the Yii 22.0 application skills, connect your coding agent, and read only the documentation a task needs."
---

Use these skills when creating or changing a Yii 22.0 application. They describe application code conventions,
controllers, models, migrations, forms, tests, and extension widgets. They are not instructions for developing the
framework or maintaining this documentation site.

## Quick start

1. Create the Yii 22.0 application and open its root directory in the coding agent.
2. Install the `yii2-framework` skill. Add the Bootstrap 6 or FilePond skill from its package only when the application uses that extension.
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

## Install application skills

Choose only the skills relevant to the application:

| Skill                     | Use it for                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `yii2-framework`          | Setup, controllers, ActiveRecord, migrations, forms, and tests in a Yii 22.0 application.        |
| `yii2-bootstrap6-widgets` | Views using `yii2-extensions/bootstrap6`; install from that package repository.                  |
| `yii2-filepond-uploads`   | FilePond inputs, encoded upload validation and storage; install from `yii2-extensions/filepond`. |

The Basic Project Template currently uses Bootstrap 5. Add the Bootstrap 6 skill only when the application uses
that extension; installing a skill does not install or switch the PHP package.

### From a local documentation checkout

From the application's root directory, list the available skills, then install the selected skill. Replace the
path with your documentation checkout:

```bash
npx skills@1.7.2 add /absolute/path/to/docs --list
npx skills@1.7.2 add /absolute/path/to/docs --skill yii2-framework
```

The installer can detect the current agent or prompt for a client. Use `--agent` to select a client explicitly;
keep the default project scope to store the skill with this application. For an extension skill, use its package checkout as the source and its own name with `--skill`.

### From the public repository

First check whether the repository's default branch contains the skills:

```bash
npx skills@1.7.2 add yii2-framework/docs --list
```

Run the following only after that command lists `yii2-framework`:

```bash
npx skills@1.7.2 add yii2-framework/docs --skill yii2-framework
```

The installer reads the default branch. Local work on another branch is not published by this command. If the skill
is absent, use the local checkout above. Installation examples use the verified `skills` CLI version 1.7.2; recheck
its options and target directories before using another version.

### Extension skills

Extension packages own their skills. From the application root:

```bash
npx skills@1.7.2 add yii2-extensions/bootstrap6 --skill yii2-bootstrap6-widgets --agent codex
npx skills@1.7.2 add yii2-extensions/filepond --skill yii2-filepond-uploads --agent codex
```

Use `--agent claude-code` or `--agent opencode` for those clients. Check `add <source> --list` first; unpublished
changes require the local package checkout. The build publishes unchanged bundles at `/docs/skills/<name>/SKILL.md`
and provenance at `/docs/skills/index.json`. These are generated copies, not independently edited instructions.
Composer installation alone does not expose a skill under `vendor/` to agents launched in the application root.

### Manual installation

Copy the complete `skills/<name>/` directory from its owning repository into the client directory below, retaining the
`<name>/SKILL.md` structure. Use one copy per skill for the client; duplicate copies can make selection ambiguous.
The shared format is [Agent Skills](https://agentskills.io/home), with portable `name`, `description`, `license`,
and `metadata` frontmatter. Client-specific hooks, tools, permissions, and activation rules are separate features.

## Configure and verify the client

The following project paths and activation methods are documented by the clients as of 2026-10-13. They describe
where to install the same skill file, not a guarantee that every client version or model behaves identically.

Treat installation, discovery, activation, and the task result as separate checks. A copied `SKILL.md` proves only
installation; a client listing the skill proves discovery; neither proves that the model followed it correctly.

| Client                                                                                           | Installation path                                                   | Discovery check                                   | Explicit activation                  | Result verified here                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| [Codex](https://learn.chatgpt.com/docs/build-skills)                                             | `.agents/skills/<name>/SKILL.md`                                    | Find `yii2-framework` in the skill picker.        | Use `$yii2-framework` or select it.  | Installer target only; no native client run.                                          |
| [Claude Code](https://code.claude.com/docs/en/skills)                                            | `.claude/skills/<name>/SKILL.md`                                    | Find `/yii2-framework` in the slash-command menu. | Use `/yii2-framework`.               | Skill content passed one smoke task; native discovery and activation were not tested. |
| [OpenCode](https://opencode.ai/docs/skills/)                                                     | `.opencode/skills/<name>/SKILL.md`; also accepts `.agents/skills/`. | Ask the client to confirm the skill is available. | Ask it to load `yii2-framework`.     | Installer target only; no native client run.                                          |
| [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | `.github/skills/<name>/SKILL.md`; also accepts `.agents/skills/`.   | Find `yii2-framework` in the agent chat `/` menu. | Use `/yii2-framework` in agent chat. | Installer target only; no native client run.                                          |
| [Amp](https://ampcode.com/docs/customize/skills)                                                 | `.agents/skills/<name>/SKILL.md`                                    | Run `amp skills list`.                            | Ask it to load `yii2-framework`.     | Installer target only; no native client run.                                          |

VS Code is the editor: the Copilot row applies to its Copilot agent. When using the Codex extension in VS Code,
follow the Codex row instead.

The earlier local verification covered listing and copying the framework and Bootstrap skills with `skills` 1.7.2 for these five installer targets.
That installer chooses `.agents/skills/` for Codex, OpenCode, Copilot, and Amp, and `.claude/skills/` for Claude Code.
It does not launch the clients or prove native discovery, activation, or correct output. The recorded Claude smoke
task supplied the skill content directly to the model; it did not test Claude Code's installed-skill workflow.

After installation, check the client's skill list or picker and request the skill by name. Start with a small task,
for example: "Use yii2-framework to inspect this application's layout and available checks before editing."
Confirm the reported paths and tool configuration against the project. A listed Composer script is not proof that
its tests and configuration files are present; see [Development checks](../guide/start-installation.md#development-checks).

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

Markdown contains the title, description, and page body. Links between pages point to Markdown versions. The HTML
page announces its Markdown URL with `<link rel="alternate" type="text/markdown">`.

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

The repository's `AGENTS.md` explains how agents consume the site. `skills/` owns the framework application skill; extension packages own their skills and the site generates their distribution bundles; maintaining this site uses the separate [contributor documentation](index.md).

`eval/README.md` describes versioned acceptance tasks, native-client preparation, and a proposed weekly evaluation cadence. These are manually run
checks, not evidence of an automated weekly evaluation. The recorded Claude smoke task exercised supplied skill
content; it does not establish native skill activation or coverage of all tasks and clients.

## Extension guides

The Extensions navigation and `llms.txt` list packages present in this build. Guides, reference pages, and examples
are synced from their package sources. [FilePond](../extensions/filepond/index.md) and
[Locale URLs](../extensions/localeurls/index.md) have published package sources. Bootstrap 6 remains marked
unpublished in `packages.json`; its documentation is available in local builds that have those sources.

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

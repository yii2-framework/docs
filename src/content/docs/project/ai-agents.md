---
title: "Build Yii applications with AI agents"
description: "Install the Yii 22.0 application skills, connect your coding agent, and read only the documentation a task needs."
---

Use these skills when creating or changing a Yii 22.0 application. They describe application code conventions,
controllers, models, migrations, forms, tests, and extension widgets. They are not instructions for developing the
framework or maintaining this documentation site.

## Create the application first

Follow [Installing Yii](../guide/start-installation.md), then open the new application's directory in your coding
agent. Keep its existing project instructions and code standards. The skill supplies Yii-specific guidance; it does
not replace your application's requirements or permissions.

The framework skill follows the `yiisoft/yii2-app-basic` template's `22` branch: PHP 8.3+, Composer autoloading,
`src/` for application classes, `resources/views/` for views, and `public/` as the Web root.

## Install a skill

Choose only the skills relevant to the application:

| Skill                     | Use it for                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `yii2-framework`          | Setup, controllers, ActiveRecord, migrations, forms, and tests in a Yii 22.0 application. |
| `yii2-bootstrap6-widgets` | Views using the typed widgets, item objects, and enums of `yii2-extensions/bootstrap6`.   |

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
keep the default project scope to store the skill with this application. For the widget skill, repeat the command with `--skill yii2-bootstrap6-widgets`.

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

### Manual installation

Copy the complete `skills/<name>/` directory from this repository into the client directory below, retaining the
`<name>/SKILL.md` structure. Use one copy per skill for the client; duplicate copies can make selection ambiguous.
The shared format is [Agent Skills](https://agentskills.io/home), with portable `name`, `description`, `license`,
and `metadata` frontmatter. Client-specific hooks, tools, permissions, and activation rules are separate features.

## Client support and verification

The following project paths and activation methods are documented by the clients as of 2026-10-13. They describe
where to install the same skill file, not a guarantee that every client version or model behaves identically.

| Client                                                                                           | Documented project path                                             | Request the skill explicitly                                       | Native client verification here                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [Codex](https://learn.chatgpt.com/docs/build-skills)                                             | `.agents/skills/<name>/SKILL.md`                                    | Use `$yii2-framework` or the skill picker.                         | Not tested end to end.                                                               |
| [Claude Code](https://code.claude.com/docs/en/skills)                                            | `.claude/skills/<name>/SKILL.md`                                    | Use `/yii2-framework`.                                             | Skill content evaluated in a smoke task; native discovery and activation not tested. |
| [OpenCode](https://opencode.ai/docs/skills/)                                                     | `.opencode/skills/<name>/SKILL.md`; also accepts `.agents/skills/`. | Ask the agent to load `yii2-framework`.                            | Not tested end to end.                                                               |
| [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | `.github/skills/<name>/SKILL.md`; also accepts `.agents/skills/`.   | Use `/yii2-framework` in agent chat.                               | Not tested end to end.                                                               |
| [Amp](https://ampcode.com/docs/customize/skills)                                                 | `.agents/skills/<name>/SKILL.md`                                    | Ask the agent to load `yii2-framework`; inspect `amp skills list`. | Not tested end to end.                                                               |

VS Code is the editor: the Copilot row applies to its Copilot agent. When using the Codex extension in VS Code,
follow the Codex row instead.

The local verification covers discovery and copying of both skills with `skills` 1.7.2 for these five installer
targets. That installer chooses `.agents/skills/` for Codex, OpenCode, Copilot, and Amp, and `.claude/skills/` for
Claude Code. It does not launch the clients or prove that their models load and follow the skill.

After installation, check the client's skill list or picker and request the skill by name. Start with a small task,
for example: "Use yii2-framework to inspect this application's layout and available checks before editing."
Confirm the reported paths and tool configuration against the project. A listed Composer script is not proof that
its tests and configuration files are present; see [Development checks](../guide/start-installation.md#development-checks).

## Start with llms.txt

If the task already names a guide page, fetch that page's Markdown directly. If the topic is unknown, use
[`llms.txt`](https://yii2-framework.github.io/docs/llms.txt) to find it, then fetch only the relevant pages. Reading the
entire index on every task is unnecessary.

| Resource                                                                 | When to use it                                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `<page>/index.md`                                                        | A known topic or API type; the first choice for focused reading.                                |
| [`llms.txt`](https://yii2-framework.github.io/docs/llms.txt)             | Discover English pages and bundles, with descriptions and approximate token sizes.              |
| `_llms-txt/<name>.txt`                                                   | Several related pages; a topic or namespace bundle of at most about 30k tokens.                 |
| [`llms-full.txt`](https://yii2-framework.github.io/docs/llms-full.txt)   | Indexing tools: every English guide except the API reference. Do not load it whole into a task. |
| [`llms-small.txt`](https://yii2-framework.github.io/docs/llms-small.txt) | The same for indexing, with notes, tips, and info blocks removed; warnings remain.              |

Guide topic bundle names remain stable when the visual navigation is regrouped: for example,
[`getting-started.txt`](https://yii2-framework.github.io/docs/_llms-txt/getting-started.txt). Extension bundles use
`extensions-<package>.txt`; API bundles use namespace groups such as `api-yii2-di.txt` or package names such as
`api-localeurls.txt`. Large topics are split into consecutive chunks listed in the index. Token sizes are estimates,
not measurements from a particular model's tokenizer. These indexes and bundles contain English pages only.

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

The repository's `AGENTS.md` explains how agents consume the site. `skills/` is the canonical source of application
skills; maintaining this site uses the separate [contributor documentation](index.md).

`eval/README.md` describes eight canonical tasks and a proposed weekly evaluation cadence. These are manually run
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

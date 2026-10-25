---
title: "Documentation"
description: "Guides, API reference, extension docs and agent skills by task."
---

Everything you can read on this site, organized by what you are building. Start
with the Yii 22.0 guide, add the guide for each extension you install, and give
your coding agent the matching Markdown pages and skill. To compare packages
before choosing one, use the [package directory](/docs/packages/).

## Start with your task

| Task                                          | Start here                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Create a Yii 22.0 application                 | [Installing Yii](guide/start-installation.md)                                                               |
| Understand how a Yii application is organized | [Application structure](guide/structure-overview.md)                                                        |
| Upgrade an existing application               | [Upgrading from Yii 2.0](guide/intro-upgrade-from-v2.md)                                                    |
| Look up a class, method or property           | [API reference](api/index.md)                                                                               |
| Add a widget, integration or tool             | [Extension guides](#extension-guides) below, or compare options in the [package directory](/docs/packages/) |
| Deploy and operate an application             | [Cookbook](cookbook/index.md)                                                                               |
| Develop in containers                         | [Docker environments](development-tools/docker/index.md)                                                    |
| Use a coding agent                            | [Build Yii applications with AI agents](project/ai-agents.md)                                               |

## Yii 22.0 framework

The guide and API reference cover the Yii 22.0 development line. Translations of
the guide are available through the language selector.
[What's new in Yii 22.0](guide/intro-whats-new.md) | [Guide](guide/index.md) |
[API reference](api/index.md). For Yii3, follow the
[Yii3 resources](ecosystems/yii3.md).

## Extension guides

Each extension below has installation steps, configuration, examples, API
reference and, where available, an agent skill, all on this site. Versions and
requirements are recorded in the matching [package entry](/docs/packages/).

<!-- hub:extensions -->

## Development tools

Tools that set up your environment rather than your application code. They have
guides and skills, but no Composer package or PHP API.

<!-- hub:tools -->

## Cookbook

Practical recipes for deploying and operating Yii applications:

- [Harden a PHP VPS with Tailscale and Cloudflare](cookbook/hardening-vps.md)
- [Configure PHP for production](cookbook/php-production.md)

## Read with a coding agent

Install the skill for your framework or package, then give the agent the
Markdown version of the page it needs (append `index.md` to any page URL). The
[AI guide](project/ai-agents.md) explains skill selection and checking.
[`llms.txt`](/docs/llms.txt) lists every English page; the
[skill index](/docs/skills/index.json) records provenance and hashes.

## Improve the documentation

The [site maintenance guide](project/index.md) identifies the sources of guides,
API references, and generated assets. To propose a package listing, follow the
separate [catalog contribution workflow](contribute.md).

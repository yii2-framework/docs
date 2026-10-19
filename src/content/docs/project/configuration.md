---
title: "Documentation sources and configuration"
description: "Find the editable source for guides, APIs, skills, navigation, and generated documentation outputs."
---

Edit each document at its owning source, then regenerate the site. A generated copy is not an independent manual.

| Content                               | Editable source                                                  | Generated output                                                         |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework guides and internals        | Tracked content in this repository                               | `src/content/docs/guide/`, translated guide directories and `internals/` |
| Extension guides                      | Each package's README and `docs/`, registered in `packages.json` | `src/content/docs/extensions/<package>/`                                 |
| Container and development tool guides | Each tool's README and `docs/`, registered in `tools.json`       | `src/content/docs/development-tools/<tool>/`                             |
| PHP API contracts                     | Framework and package PHPDoc                                     | API Markdown, `public/reference/` and `.cache/reference/links.json`      |
| Application skills                    | `yii2-extensions/skill` or the owning package's skill directory  | Package bundles in `.cache/skills/` and `public/skills/`                 |
| Framework skill navigation            | `skills/navigation.json` and the common package's `SKILL.md`     | Pages in `src/content/docs/guide/skills/`                                |
| Contributor documentation             | `src/content/docs/project/`                                      | HTML and per-page Markdown                                               |
| Navigation and discovery              | `astro.config.mjs`, manifests and page frontmatter               | Sidebar, `llms.txt` and topic bundles                                    |

`packages.json` describes Composer extensions and the framework; `tools.json` describes tools such as Docker that
have no PHP namespace or Composer installation. Register a package's optional `skillsDir` to distribute its complete
skill tree unchanged. The generated skills index records source refs and resource checksums. The required
`framework-skills.json` pins the common package, which is fetched from its remote `repo` at `ref`. During
`sync:local`, an available `localPath` configured in that manifest takes precedence. The default manifest has none,
so no adjacent common-package checkout is needed. The local `skills/` directory contains only site
navigation and a source pointer; application installation uses Packagist.

The `status` field records package distribution (`published`, `unpublished` or `template`), not the HTTP publication
state of this site. A local build does not make a route public. Remote builds read the configured `repo` and `ref`;
new package sources must exist there before those builds can import them.

See [development](development.md) for manifest fields, demos and theme changes. See
[AI assistance](ai-agents.md) for client installation and focused documentation reading.

## Web analytics

Cloudflare Web Analytics is configured for `yii2-framework.github.io` with the public site identifier in
`src/components/Footer.astro`. The standard build needs no GitHub variable, Cloudflare API key, DNS change or
additional service. The identifier comes from the site's official beacon snippet and is embedded in the built
HTML; it is not a credential. See Cloudflare's
[manual setup](https://developers.cloudflare.com/web-analytics/get-started/) when changing the registered site.

The analytics dashboard stays in the maintainer's Cloudflare account; this site publishes no dashboard. Open
**Web Analytics** in that account and select `yii2-framework.github.io` to view it. Measurements can appear a few
minutes after an authorized deployment and subsequent page visits. Use the hostname and path filters to inspect
`/docs/` traffic.

`PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` optionally overrides the included identifier at build time. Leave it unset
to use the configured site. Set it to an empty or whitespace-only value to disable analytics for that build, for
example:

```bash
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN='' npm run build
```

No `.env` file or external configuration is required for the default build. A changed identifier or disabled
integration takes effect only after rebuilding and deploying the site.

`src/components/Footer.astro` preserves Starlight's default footer and loads the beacon only in production builds
with a configured token. At runtime, the page must match the configured Astro `site` origin and `base` path, so
`astro dev`, localhost previews and copies on other hosts send no analytics. The site currently uses full-page
navigation without Astro's `ClientRouter`. Cloudflare also supports
[automatic SPA navigation measurement](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/);
no custom page-view events are sent, and the loader prevents a second beacon in the same document.

There is currently no site-defined Content Security Policy. If a CSP is introduced, preserve existing permissions,
allow the loader with its hash or nonce, add `https://static.cloudflareinsights.com/beacon.min.js` to `script-src`
(and `script-src-elem` if specified), and allow `https://cloudflareinsights.com` in `connect-src`. Test that policy
before deployment; see [Cloudflare's CSP guidance](https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp).

According to [Cloudflare's privacy description](https://www.cloudflare.com/web-analytics/#privacy-first), Web
Analytics uses no cookies, localStorage or fingerprinting for usage metrics. The integration adds no identifiers or
custom tracking. It measures navigation observed by JavaScript, not confirmed humans: automated browsers can run
JavaScript, and blocked scripts or disabled JavaScript leave gaps. Markdown downloads, `llms.txt`, bundles and
agent fetches that do not execute the HTML beacon are not counted. These figures cannot establish agent usage or
exact human visitor counts.

---
title: "Propose a package"
description: "Submit a Yii2, Yii3, or PHP package for human review: from Packagist through a short issue form, or as a hand-written catalog record."
---

Propose a useful extension or library for Yii2, Yii3, or framework-independent
PHP. Authors and users may submit packages. State your relationship to the
project and provide public evidence for its requirements.

The [package directory](/docs/packages/) is built from one JSON record per
package under `src/data/catalog/` in the
[site repository](https://github.com/yii2-framework/docs). A package published
on Packagist can be proposed with a short form; the record is then generated
from its public metadata. A package that is not on Packagist, or a record that
needs hand-curated evidence, goes through a hand-written record instead.

## Add a package from Packagist

Open the
[Add a package from Packagist](https://github.com/yii2-framework/docs/issues/new?template=catalog-package.yml)
form. It asks for the Composer name, one topic, the site curator's role in the
package, and optional notes. Most proposals are independent community projects;
choose the curator option only when the curator of this site contributes to the
package, and link the public evidence in the notes. Say there whether you
maintain, contribute to, or only use the package.

What happens next:

1. A moderator checks that the package fits the directory and is not already
   listed. The issue carries the `catalog:proposal` label until then.
2. When it fits, a maintainer adds the `catalog:import` label. A workflow reads
   the form, fetches the package's public Packagist and GitHub metadata,
   generates its record, validates the catalog, and opens a draft pull request
   that references the issue. Nothing is installed or executed.
3. A reviewer checks the generated record like any other data change: summary,
   topic, tags, attribution, relationship evidence, and the pinned revision. If
   the import fails, the issue receives the end of the log; correct the form and
   ask for the label again.

The importer pins the revision it inspected. A record of kind `release` names a
stable tag and its commit; without a stable tag, the record names an inspected
commit (kind `source`) and the directory shows no `composer require` command for
it. A pinned tag records what was inspected; it does not claim to be the newest
release when you read the page.

You can also generate the record yourself and open a data pull request with the
new file. The importer needs Node.js and network access to Packagist and GitHub:

```sh
npm run catalog:import -- vendor/package --topic=forms-widgets
npm run catalog:check
```

Use a topic id from the [list below](#topics). Add `--dry-run` to print the
record without writing it, and `--relationship=contributed` only with evidence
of the curator's role. Review the generated summary and tags before opening the
pull request.

## Write a record by hand

Use a hand-written record for a package that is not on Packagist, or to correct
the evidence of an existing record. Submit it as a data pull request, or open the
[Package proposal](https://github.com/yii2-framework/docs/issues/new?template=package.yml)
form, which collects the same evidence. An accepted issue still needs a reviewed
catalog data pull request.

### What a proposal needs

- The Composer name, public repository, concise purpose, and documentation URL;
- one topic and up to eight tags;
- the maintainer's name and public project or profile URL;
- the license and a link to its source;
- the exact PHP constraint from the selected revision's `composer.json`;
- each claimed framework constraint and a source that supports it;
- the release tag or branch, its full commit ID, and links to the inspected
  source;
- your relationship to the package and any known compatibility limitations.

A branch name can move. Pin the inspected commit so that reviewers can understand
which source supports a claim. Link to requirements, integration documentation,
or published test evidence for that revision. Distinguish a declared requirement
from a tested combination; a green badge alone does not establish every supported
version.

Use the exact framework line when describing Yii compatibility. A package for
Yii 22.0 is not automatically compatible with Yii 2.0 or Yii3. A reusable PHP
library needs evidence for a claimed framework integration too.

### Record fields

1. Check the [package directory](/docs/packages/) for an existing entry. Update
   that record when the package is already listed. Copy an existing record as a
   starting point and keep the proposal limited to catalog data.
2. Supply the `id`, `name`, `summary`, `family`, `topic`, `tags`, `ecosystems`,
   `kind`, `php`, `compatibility`, `docsUrl`, `repository`, `license`,
   `maintainer`, `relationship`, `relationshipEvidence`, and `provenance`
   fields, in that order, using the existing record structure.
3. Set `topic` to exactly one [topic id](#topics).
4. Set `tags` to one to eight distinct tags that tell the package apart, most
   distinctive first. See [tags](#tags).
5. Set an independent proposal's `family` and `relationship` to `community`.
   Preserve the real maintainer attribution and provide an immutable HTTPS source
   in `relationshipEvidence`. The other relationship values, `maintained` and
   `contributed`, require evidence of the site curator's role. Collection
   membership is reviewed separately.
6. Include a constraint and evidence link for each compatibility entry. Record
   the inspected source and review date in `provenance`; do not imply that the
   site curator has already approved your proposal.
7. Leave out `stats`. The importer and the weekly refresh write it: Packagist
   install and favourite counts with the date they were read. The site shows
   them with that date, never fetches them during a build, and does not sort by
   them.
8. Run `npm run catalog:check`, explain the addition or correction in the pull
   request, and respond to any request for evidence.

The catalog is separate from `packages.json` and `tools.json`, which control
documentation imports and executable build work. A package proposal must not add
scripts, Composer dependencies, PHP demos, MDX, or agent skills. The catalog does
not install or execute submitted packages.

### Topics

Each record belongs to exactly one topic. Topics without packages are not shown.

| `topic` id                | Title                           |
| ------------------------- | ------------------------------- |
| `forms-widgets`           | Forms and widgets               |
| `routing-frontend`        | Routing, languages and frontend |
| `data-modelling`          | Data modelling                  |
| `servers-workers`         | Application servers and workers |
| `quality-debugging`       | Quality and debugging           |
| `extension-authoring`     | Build your own extension        |
| `html-views`              | Views and HTML                  |
| `security-auth`           | Authentication and security     |
| `background-integrations` | Queues and integrations         |
| `console-tooling`         | Console and code generation     |

### Tags

A tag is a lowercase slug of letters and digits separated by single dashes, at
most 32 characters, such as `file-upload` or `psr-7`. A record has one to eight
distinct tags. The importer derives them from the package keywords; review them
before submitting.

Tags must not repeat what the directory already shows: the record's topic id,
its vendor name, or one of these generic words: `php`, `yii`, `yii2`, `yii3`,
`yii-2`, `yii-3`, `yiisoft`, `extension`, `extensions`, `yii2-extension`,
`yii2-extensions`, `yii-extension`, `library`, `framework`, `package`, and
`composer`.

## How review works

A moderator checks relevance, attribution, license, evidence, and the catalog
record. The proposal may need more information or be declined with an explanation.
Passing a data validation check does not approve a listing, and a generated
record is reviewed like a hand-written one.

Publication requires human approval and the normal site release process. An issue
or an open pull request is not a published listing. Review does not certify
security, guarantee maintenance, or establish official Yii endorsement. Paid work
and sponsorship do not determine acceptance or search ordering.

Use public repository links. Do not include credentials, private application
code, personal contact details, or uploaded package archives.

## Correct or remove a listing

Open a data pull request or a
[catalog issue](https://github.com/yii2-framework/docs/issues/new) with the package
ID, the affected claim, and the supporting source. The package maintainer can also
request a correction or removal through that channel. A weekly refresh proposes
newer stable tags and current statistics in a draft pull request that is
reviewed before publication.

Report package bugs to the package's own tracker. For a security vulnerability,
follow the owning project's security reporting policy and avoid posting sensitive
details in a public catalog issue.

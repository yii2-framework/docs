---
title: "Propose a package"
description: "Submit a Yii2, Yii3, or PHP package for human review through a data pull request or a GitHub issue."
---

Propose a useful extension or library for Yii2, Yii3, or framework-independent
PHP. Authors and users may submit packages. State your relationship to the
project and provide public evidence for its requirements.

## What a proposal needs

- The Composer name, public repository, concise purpose, and documentation URL;
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

## Submit a data pull request

The canonical catalog is one JSON record per package under
`src/data/catalog/` in the
[site repository](https://github.com/yii2-framework/docs). Copy an existing record
as a starting point and keep the proposal limited to catalog data.

1. Check the [catalog](/docs/packages/) for an existing entry. Update that record
   when the package is already listed.
2. Supply the package's `id`, `name`, `summary`, `family`, `ecosystems`, `kind`,
   `php`, `compatibility`, `docsUrl`, `repository`, `license`, `maintainer`,
   `relationship`, `relationshipEvidence`, and `provenance` fields using the
   existing record structure.
3. Set an independent proposal's `family` and `relationship` to `community`.
   Preserve the real maintainer attribution and provide an immutable HTTPS source
   in `relationshipEvidence`. The other relationship values, `maintained` and
   `contributed`, require evidence of the portal maintainer's role. Project
   collection membership is reviewed separately.
4. Include a constraint and evidence link for each compatibility entry. Record
   the inspected source and review date in `provenance`; do not imply that the
   portal maintainer has already approved your proposal.
5. Explain the addition or correction in the pull request and respond to any
   request for evidence.

The catalog is separate from `packages.json` and `tools.json`, which control
documentation imports and executable build work. A package proposal must not add
scripts, Composer dependencies, PHP demos, MDX, or agent skills. The catalog does
not install or execute submitted packages.

## Prefer a form?

[Open a package proposal issue](https://github.com/yii2-framework/docs/issues/new)
and provide the information listed above. The repository's package proposal form
collects the same evidence when available. An accepted issue still needs a
reviewed catalog data pull request.

Use public repository links. Do not include credentials, private application
code, personal contact details, or uploaded package archives.

## How review works

A moderator checks relevance, attribution, license, evidence, and the catalog
record. The proposal may need more information or be declined with an explanation.
Passing a data validation check does not approve a listing.

Publication requires human approval and the normal site release process. An issue
or an open pull request is not a published listing. Review does not certify
security, guarantee maintenance, or establish official Yii endorsement. Paid work
and sponsorship do not determine acceptance or search ordering.

## Correct or remove a listing

Open a data pull request or a
[catalog issue](https://github.com/yii2-framework/docs/issues/new) with the package
ID, the affected claim, and the supporting source. The package maintainer can also
request a correction or removal through that channel.

Report package bugs to the package's own tracker. For a security vulnerability,
follow the owning project's security reporting policy and avoid posting sensitive
details in a public catalog issue.

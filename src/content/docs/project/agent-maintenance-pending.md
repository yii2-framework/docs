---
title: "Agent configuration follow-up"
description: "Local instruction discrepancies to resolve separately from extension documentation and skill distribution."
---

The package documentation work does not change global agent instructions or the `agent-skills` repository. These
local discrepancies require a separate maintenance change:

- Global PHP 8.1 rules conflict with both extensions' Composer minimum of PHP 8.3 and CI matrix.
- Installed PHPDoc skills disagree: Claude prohibits usage examples, `.agents` requires them, and Codex asks for them
  when they clarify the contract. Choose one rule that preserves concise API documentation and useful examples.
- The repository skill generator writes `.claude/SKILL.md`, rather than a discoverable named skill folder.
- The global sync script targets OpenCode's singular `skill` directory and skips nested categories, while current
  client documentation uses `skills` and the repository conventions describe nested skills.

Do not fix these by rewriting global settings as part of a package change. Package skills supply workflows and real
constraints; their installation, native discovery, activation, and functional output must be verified separately.

## Native evaluation execution

Deterministic preparation and acceptance checks do not invoke a model. Before an authenticated native run, mask
personal configuration and instruction locations, confirm workspace skill discovery offline, and prove that the
model-tool filesystem denies the authentication path using a public dummy marker. Mount the required public CLI
runtime read-only if it is outside the minimal filesystem profile. Keep the authentication denial and tool network
restrictions in place; do not replace that profile with a broad sandbox preset or separately billed API access.

OpenCode runs need an explicitly selected provider/model and a successful isolated client startup. Review the
provider's current privacy and free-tier conditions before transmitting a prompt. A free price does not mean open
weights or access without an account. Inspect effective metadata and permissions before testing selection:
`metadata["opencode/autoinvoke"]: "false"` hides the skill from automatic model-facing guidance, while a denied skill
permission blocks loading. The automatic-selection flag still permits explicit loading by exact name; disabling the
skill tool removes its available-skills section. Check those controls in the installed client and record both its
native available-skills list and skill-tool invocation. See the [OpenCode skill documentation](https://docs.opencode.ai/docs/skills/).
Preserve native discovery, activation, selective-documentation reading and functional acceptance as separate evidence.

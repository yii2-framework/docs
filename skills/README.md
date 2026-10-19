# Agent skills

The twenty framework skill bundles are maintained and distributed by
[`yii2-extensions/skill`](https://github.com/yii2-extensions/skill). Install that Composer package using the
[skill selection and client setup guide](../src/content/docs/project/ai-agents.md#install-the-relevant-skill).
Extension and development-tool repositories own their respective skills.

This directory contains only site-owned [`navigation.json`](navigation.json) and this pointer.
[`framework-skills.json`](../framework-skills.json) pins the common package's remote revision, including for
`sync:local`. Edit skill bodies and their portable resources in the owning package.

The sync generates unchanged bundles in `.cache/skills/` and `public/skills/`, with provenance and resource hashes
in `/docs/skills/index.json`, and framework guide pages under `/docs/guide/skills/<name>/`.
These generated outputs are never edited or committed. The published skill and guide URLs remain unchanged.

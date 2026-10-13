import { readFile, writeFile } from 'node:fs/promises';

// Blockquotes kept in `llms-small.txt`: warnings matter when generating code (as the plugin keeps caution and danger
// asides by default). Notes, tips and info blocks are dropped.
const KEEP = /^\s*>\s*(?:\*\*|__)?(?:warning|important|caution|danger)\b/i;
const FENCE = /^\s*(`{3,}|~{3,})/;
const QUOTE = /^\s*>/;

/**
 * Removes the Markdown blockquotes of a `starlight-llms-txt` bundle, except warnings and the page descriptions (the
 * one-line quote that follows each `# Title`). Lines inside code fences are left untouched.
 *
 * @param {string} text Bundle contents.
 * @returns {{ text: string, removed: number }}
 */
export function trimBlockquotes(text) {
  const lines = text.split('\n');
  const output = [];
  let fence = null;
  let removed = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (fence !== null) {
      output.push(line);
      const match = FENCE.exec(line);
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }

    const fenceMatch = FENCE.exec(line);

    if (fenceMatch) {
      fence = fenceMatch[1];
      output.push(line);
      continue;
    }

    if (!QUOTE.test(line)) {
      output.push(line);
      continue;
    }

    let end = index;

    while (end + 1 < lines.length && QUOTE.test(lines[end + 1])) {
      end++;
    }

    const previous = output.findLast((candidate) => candidate.trim() !== '');
    const isDescription = previous !== undefined && /^# /.test(previous) && end === index;

    if (isDescription || KEEP.test(line)) {
      output.push(...lines.slice(index, end + 1));
    } else {
      removed++;
      // Drop the blank line that separated the quote from the next block.
      if (end + 1 < lines.length && lines[end + 1].trim() === '') {
        end++;
      }
    }

    index = end;
  }

  return { text: output.join('\n'), removed };
}

/**
 * Astro integration that trims blockquotes from `llms-small.txt` after the build.
 *
 * `starlight-llms-txt` applies its `customSelectors.small` to the `customSets` bundles as well, so a `blockquote`
 * selector would also strip notes from the per-group bundles; this keeps those and `llms-full.txt` complete.
 *
 * @returns {import('astro').AstroIntegration}
 */
export function llmsSmallTrim() {
  return {
    name: 'llms-small-trim',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const file = new URL('llms-small.txt', dir);
        const before = await readFile(file, 'utf8');
        const { text, removed } = trimBlockquotes(before);

        await writeFile(file, text);
        logger.info(`llms-small.txt: ${removed} blockquotes removed, ${Buffer.byteLength(before)} -> `
          + `${Buffer.byteLength(text)} bytes.`);
      },
    },
  };
}

import { readFile, writeFile } from 'node:fs/promises';

/**
 * Returns the position where the first excluded page starts in a `starlight-llms-txt` file, or `-1`.
 *
 * Each page starts with `# <title>` and `> <description>`; the excluded pages are demoted, so they form the tail.
 *
 * @param {string} text File contents.
 * @param {string[]} excluded Page headers (`# Title\n\n> Description`) to drop.
 * @param {string[]} kept Page headers that must stay before the cut.
 */
export function cutPosition(text, excluded, kept) {
  let cut = -1;

  for (const header of excluded) {
    const index = text.indexOf(`\n\n${header}\n`);

    if (index !== -1 && (cut === -1 || index < cut)) {
      cut = index;
    }
  }

  if (cut === -1) {
    return -1;
  }

  const lost = kept.filter((header) => {
    const index = text.indexOf(`\n\n${header}\n`);

    return index > cut;
  });

  if (lost.length > 0) {
    throw new Error(`[llms-full-budget] ${lost.length} other page(s) come after the API reference (first: `
      + `"${lost[0].split('\n')[0]}"); check the starlight-llms-txt \`demote\` option.`);
  }

  return cut;
}

/**
 * Astro integration that keeps `llms-full.txt` within a size budget: when it is larger, the API reference pages
 * (demoted to the end of the file by the `demote` option) are cut. The reference stays available in
 * `_llms-txt/api.txt` and as per-page Markdown.
 *
 * @param {{ budget: number, excluded: string[], kept: string[] }} options `budget` in bytes; page headers as in
 * {@link cutPosition}.
 * @returns {import('astro').AstroIntegration}
 */
export function llmsFullBudget({ budget, excluded, kept }) {
  return {
    name: 'llms-full-budget',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const file = new URL('llms-full.txt', dir);
        const before = await readFile(file, 'utf8');
        const size = Buffer.byteLength(before);

        if (size <= budget) {
          logger.info(`llms-full.txt: ${size} bytes, within the ${budget}-byte budget; API reference kept.`);
          return;
        }

        const cut = cutPosition(before, excluded, kept);

        if (cut === -1) {
          logger.warn(`llms-full.txt: ${size} bytes, over the ${budget}-byte budget, and no API reference page found.`);
          return;
        }

        const text = `${before.slice(0, cut)}\n`;

        await writeFile(file, text);
        logger.info(`llms-full.txt: ${size} -> ${Buffer.byteLength(text)} bytes (API reference excluded; budget `
          + `${budget}).`);
      },
    },
  };
}

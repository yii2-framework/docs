import { readFile, readdir, writeFile } from 'node:fs/promises';

const FENCE = /^\s*(`{3,}|~{3,})/;
const ROW = /^(\s*)\|.*\|\s*$/;
const DELIMITER_CELL = /^(:?)-+(:?)$/;

/**
 * Splits a table row (without indentation) into its cells at the unescaped pipes; a backslash escapes the next
 * character. Returns `null` when the row does not start and end with a delimiter pipe.
 *
 * @param {string} row
 * @returns {string[] | null}
 */
export function splitRow(row) {
  const cells = [];
  let cell = '';

  for (let index = 0; index < row.length; index++) {
    const char = row[index];

    if (char === '\\' && index + 1 < row.length) {
      cell += char + row[index + 1];
      index++;
      continue;
    }

    if (char === '|') {
      cells.push(cell);
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell);

  // A row of remark-stringify starts and ends with a pipe: nothing before the first one, only spaces after the last.
  if (cells.length < 3 || cells[0] !== '' || cells.at(-1).trim() !== '') {
    return null;
  }

  return cells.slice(1, -1);
}

/**
 * Returns a table row with one space around each cell; delimiter cells become `---`, `:---`, `---:` or `:---:`.
 *
 * @param {string} line
 * @param {boolean} delimiter Whether the line is the delimiter row.
 * @returns {string}
 */
function collapseRow(line, delimiter) {
  const indent = /^\s*/.exec(line)[0];
  const cells = splitRow(line.slice(indent.length).trimEnd());

  if (cells === null) {
    return line;
  }

  const collapsed = cells.map((raw) => {
    const cell = raw.trim();

    if (delimiter) {
      const match = DELIMITER_CELL.exec(cell);

      return match ? `${match[1]}---${match[2]}` : cell;
    }

    return cell;
  });

  return `${indent}|${collapsed.map((cell) => (cell === '' ? ' ' : ` ${cell} `)).join('|')}|`;
}

/**
 * Returns whether a line is a GFM table delimiter row (`| --- | :-: |`).
 *
 * @param {string} line
 */
function isDelimiterRow(line) {
  if (!ROW.test(line)) {
    return false;
  }

  const cells = splitRow(line.trim());

  return cells !== null && cells.every((cell) => DELIMITER_CELL.test(cell.trim()));
}

/**
 * Collapses the column padding that `remark-stringify` writes into GFM tables: the spaces around each cell become
 * one and the delimiter row becomes `| --- |` (alignment colons kept). Lines inside code fences and lines that are
 * not part of a table (a header row followed by a delimiter row, then the rows up to the first non-row line) are left
 * untouched; the cell contents do not change.
 *
 * @param {string} text Markdown text.
 * @returns {{ text: string, tables: number }}
 */
export function collapseTablePadding(text) {
  const lines = text.split('\n');
  let fence = null;
  let tables = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (fence !== null) {
      const match = FENCE.exec(line);

      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && line.trim() === match[1]) {
        fence = null;
      }
      continue;
    }

    const fenceMatch = FENCE.exec(line);

    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }

    if (!ROW.test(line) || index + 1 >= lines.length || !isDelimiterRow(lines[index + 1])) {
      continue;
    }

    tables++;
    lines[index] = collapseRow(line, false);
    lines[index + 1] = collapseRow(lines[index + 1], true);
    index += 2;

    while (index < lines.length && ROW.test(lines[index])) {
      lines[index] = collapseRow(lines[index], false);
      index++;
    }

    index--;
  }

  return { text: lines.join('\n'), tables };
}

/**
 * Astro integration that collapses the table padding of the `starlight-llms-txt` outputs (`llms-full.txt`,
 * `llms-small.txt` and `_llms-txt/*.txt`) after the build. Register it before the integrations that measure or cut
 * those files ({@link import('./llms-full-budget.mjs').llmsFullBudget}).
 *
 * @returns {import('astro').AstroIntegration}
 */
export function llmsTables() {
  return {
    name: 'llms-tables',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const bundles = (await readdir(new URL('_llms-txt/', dir))).filter((name) => name.endsWith('.txt'))
          .map((name) => `_llms-txt/${name}`);
        let before = 0;
        let after = 0;

        for (const name of ['llms-full.txt', 'llms-small.txt', ...bundles]) {
          const file = new URL(name, dir);
          const original = await readFile(file, 'utf8');
          const { text } = collapseTablePadding(original);

          before += Buffer.byteLength(original);
          after += Buffer.byteLength(text);

          if (text !== original) {
            await writeFile(file, text);
          }
        }

        logger.info(`table padding collapsed in ${bundles.length + 2} files: ${before} -> ${after} bytes.`);
      },
    },
  };
}

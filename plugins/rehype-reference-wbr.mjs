import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { REFERENCE_ID } from './reference-id.mjs';

const CONTENT_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));

/** Characters after which a long PHP type or name may wrap: namespace separator, union and list separators. */
const BREAK_AFTER = /(?<=[\\|,])/;

/**
 * Inserts `<wbr>` after `\`, `|` and `,` in the inline code of table cells. Without it, a cell holding
 * `yii\db\ActiveQueryInterface|yii\db\ActiveRecord[]|null` either widens the table or, with
 * `overflow-wrap: anywhere`, lets the browser shrink the column and break names mid-word.
 *
 * @param {import('hast').Element} code
 */
export function addBreakOpportunities(code) {
  code.children = code.children.flatMap((child) => {
    if (child.type !== 'text' || !BREAK_AFTER.test(child.value)) {
      return [child];
    }

    const parts = child.value.split(BREAK_AFTER).filter((part) => part !== '');

    return parts.flatMap((value, index) => {
      const text = { type: 'text', value };

      const wbr = { type: 'element', tagName: 'wbr', properties: {}, children: [] };

      return index === parts.length - 1 ? [text] : [text, wbr];
    });
  });
}

/**
 * Rehype plugin for the generated API reference pages (`api/...`, `extensions/<package>/reference/...`): adds break
 * opportunities to the inline code of table cells (`td`, `th`), including code inside links. Other pages, code
 * blocks and the Markdown source (served to agents as `index.md`) are left untouched.
 */
export function rehypeReferenceWbr() {
  return (tree, file) => {
    if (!file.path) {
      return;
    }

    const id = path.relative(CONTENT_DIR, file.path).split(path.sep).join('/');

    if (!REFERENCE_ID.test(id)) {
      return;
    }

    visit(tree, 'element', (cell) => {
      if (cell.tagName !== 'td' && cell.tagName !== 'th') {
        return;
      }

      visit(cell, 'element', (node) => {
        if (node.tagName === 'code') {
          addBreakOpportunities(node);

          return 'skip';
        }

        return undefined;
      });

      return 'skip';
    });
  };
}

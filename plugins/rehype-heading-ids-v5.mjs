import Slugger from 'github-slugger';
import { visit } from 'unist-util-visit';

/**
 * Restores the Astro 5 heading IDs: one trailing hyphen is stripped from each generated slug.
 *
 * Astro 6+ keeps trailing hyphens (`## Basics <span id="basics"></span>` yields `basics-`). This plugin runs before
 * Astro's `rehypeHeadingIds`, which keeps any ID that is already set. The text extraction and the de-duplication
 * order follow Astro's implementation (recipe from the Astro 6 upgrade guide).
 */
export function rehypeHeadingIdsV5() {
  return (tree) => {
    const slugger = new Slugger();

    visit(tree, 'element', (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) {
        return;
      }

      let text = '';

      visit(node, (child, _index, parent) => {
        if (child.type === 'element' || parent == null) {
          return;
        }

        // Inline HTML such as `<span id="x"></span>` does not contribute to the slug.
        if (child.type === 'raw' && /^\n?<.*>\n?$/.test(child.value)) {
          return;
        }

        if ((child.type === 'text' || child.type === 'raw') && 'value' in child) {
          const inCode = 'tagName' in parent && (parent.tagName === 'code' || parent.tagName === 'pre');

          text += inCode ? child.value : child.value.replace(/\{/g, '${');
        }
      });

      node.properties = node.properties || {};

      if (typeof node.properties.id !== 'string') {
        let slug = slugger.slug(text);

        if (slug.endsWith('-')) {
          slug = slug.slice(0, -1);
        }

        node.properties.id = slug;
      }
    });
  };
}

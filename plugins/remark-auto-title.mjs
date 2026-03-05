import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

export function remarkAutoTitle() {
  return (tree, file) => {
    if (file.data.astro?.frontmatter?.title) {
      return;
    }

    let title = '';

    visit(tree, 'heading', (node, index, parent) => {
      if (node.depth === 1 && !title) {
        title = toString(node);

        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1);
        }

        return false;
      }
    });

    if (title) {
      if (!file.data.astro) {
        file.data.astro = {};
      }

      if (!file.data.astro.frontmatter) {
        file.data.astro.frontmatter = {};
      }

      file.data.astro.frontmatter.title = title;
    }
  };
}

import { visit } from 'unist-util-visit';

export function rehypeFixLinks() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a' || !node.properties?.href) {
        return;
      }

      let href = node.properties.href;

      if (typeof href !== 'string') {
        return;
      }

      // Skip external links, anchors, and absolute paths
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('/')) {
        return;
      }

      // Transform relative .md links to slug-based paths
      // e.g., "start-installation.md" → "start-installation/"
      // e.g., "start-installation.md#section" → "start-installation/#section"
      if (href.includes('.md')) {
        href = href.replace(/\.md(#|$)/, '/$1');
        node.properties.href = href;
      }
    });
  };
}

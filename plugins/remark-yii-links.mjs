import { visit, SKIP } from 'unist-util-visit';
import { API_LINK, recordUnresolved, resolveApiLink } from './yii-links.mjs';

/**
 * Resolves the guide's apidoc-style references (`[[yii\base\Widget::widget()]]`, `[[yii\base\Widget]]`,
 * `[[yii\base\Widget|label]]`, `[[yii\base\Widget::$id]]`) to links to the generated API reference, using the link
 * map of `tools/bin/reference`. The label is the title, or `Widget` / `Widget::widget()` as inline code.
 *
 * Unknown targets (relative names such as `[[id]]`, members of undocumented classes) become
 * `<span class="api-unresolved" data-target="...">` holding the title or the target as inline code, so no literal
 * `[[` is published and the misses can be counted in `dist/`. Code spans and blocks are not touched.
 */
export function remarkYiiLinks() {
  return (tree) => {
    // Raw HTML blocks (the Arabic translation writes its paragraphs as `<p dir="rtl">`): rewrite outside code.
    visit(tree, 'html', (node) => {
      if (node.value.includes('[[') && !/^\s*<(pre|code|script|style)\b/i.test(node.value)) {
        node.value = rewriteHtml(node.value);
      }
    });

    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number' || !node.value.includes('[[')) {
        return undefined;
      }

      const nodes = [];
      let last = 0;

      for (const match of node.value.matchAll(API_LINK)) {
        const [all, target, title] = match;

        if (match.index > last) {
          nodes.push({ type: 'text', value: node.value.slice(last, match.index) });
        }

        const text = title?.trim();
        const resolved = resolveApiLink(target);

        if (resolved) {
          nodes.push({
            type: 'link',
            url: resolved.url,
            children: [text ? { type: 'text', value: text } : { type: 'inlineCode', value: resolved.label }],
          });
        } else {
          recordUnresolved(target.trim());
          nodes.push({
            type: 'unresolvedApiLink',
            data: {
              hName: 'span',
              hProperties: { className: ['api-unresolved'], dataTarget: target.trim() },
            },
            children: [text ? { type: 'text', value: text } : { type: 'inlineCode', value: target.trim() }],
          });
        }

        last = match.index + all.length;
      }

      if (nodes.length === 0) {
        return undefined;
      }

      if (last < node.value.length) {
        nodes.push({ type: 'text', value: node.value.slice(last) });
      }

      parent.children.splice(index, 1, ...nodes);

      return [SKIP, index + nodes.length];
    });
  };
}

/** Escapes text for HTML content and attributes. */
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Rewrites the references of a raw HTML fragment; `<code>` and `<pre>` elements inside it are left untouched.
 *
 * @param {string} html
 */
function rewriteHtml(html) {
  return html.split(/(<(?:pre|code)\b[\s\S]*?<\/(?:pre|code)>)/i).map((part, index) => (index % 2 === 1 ? part
    : part.replace(API_LINK, (all, target, title) => {
      const text = title?.trim();
      const resolved = resolveApiLink(target);

      if (!resolved) {
        recordUnresolved(target.trim());
        const content = text ? escapeHtml(text) : `<code>${escapeHtml(target.trim())}</code>`;

        return `<span class="api-unresolved" data-target="${escapeHtml(target.trim())}">${content}</span>`;
      }

      const content = text ? escapeHtml(text) : `<code>${escapeHtml(resolved.label)}</code>`;

      return `<a href="${escapeHtml(resolved.url)}">${content}</a>`;
    }))).join('');
}

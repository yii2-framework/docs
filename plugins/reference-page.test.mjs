import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { selectAll } from 'hast-util-select';
import rehypeParse from 'rehype-parse';
import { unified } from 'unified';
import { cleanReferenceMarkdown } from './reference-markdown.mjs';
import { rehypeReferenceWbr } from './rehype-reference-wbr.mjs';

const content = (relative) => fileURLToPath(new URL(`../src/content/docs/${relative}`, import.meta.url));

/** Runs the plugin on an HTML fragment as if it came from `relative` and returns the tree. */
function process(html, relative) {
  const processor = unified().use(rehypeParse, { fragment: true }).use(rehypeReferenceWbr);
  const tree = processor.parse(html);

  return processor.runSync(tree, { path: content(relative) });
}

/** Returns the children of an element as strings, `<wbr>` for break opportunities. */
const parts = (element) => element.children.map((child) => (child.type === 'text' ? child.value : `<${child.tagName}>`));

describe('rehypeReferenceWbr', () => {
  const html = '<table><tr><th><code>yii\\base\\Component</code></th></tr><tr><td><code>a\\b|null</code> '
    + '<a href="x"><code>array&lt;int, string&gt;</code></a></td></tr></table>'
    + '<p><code>yii\\web\\View</code></p><pre><code>a|b</code></pre>';

  test('adds break opportunities after \\, | and , in table code only', () => {
    const tree = process(html, 'api/yii/base/Component.md');
    const [header, cell, link, prose, block] = selectAll('code', tree);

    assert.deepEqual(parts(header), ['yii\\', '<wbr>', 'base\\', '<wbr>', 'Component']);
    assert.deepEqual(parts(cell), ['a\\', '<wbr>', 'b|', '<wbr>', 'null']);
    assert.deepEqual(parts(link), ['array<int,', '<wbr>', ' string>']);
    assert.deepEqual(parts(prose), ['yii\\web\\View']);
    assert.deepEqual(parts(block), ['a|b']);
  });

  test('applies to extension references and leaves other pages alone', () => {
    const reference = process(html, 'extensions/bootstrap6/reference/Alert.md');
    const guide = process(html, 'guide/structure-widgets.md');
    const bootstrapGuide = process(html, 'extensions/bootstrap6/installation.md');

    assert.equal(selectAll('wbr', reference).length, 5);
    assert.equal(selectAll('wbr', guide).length, 0);
    assert.equal(selectAll('wbr', bootstrapGuide).length, 0);
  });
});

describe('cleanReferenceMarkdown', () => {
  test('drops wrappers, turns the summary into a label and unwraps styled spans', () => {
    const body = [
      '<div class="api-crumbs">',
      '',
      '[API reference](../../index.md) › Component',
      '',
      '</div>',
      '',
      '<div class="api-meta">',
      '',
      '| <span class="api-badge api-badge-class">abstract class</span> | `yii\\base\\Component` |',
      '| --- | --- |',
      '',
      '</div>',
      '',
      '<details class="api-relations">',
      '<summary>2 subclasses</summary>',
      '',
      '- [`Action`](Action.md)',
      '- [`Model`](Model.md)',
      '',
      '</details>',
      '',
      '| <span id="method-on"></span>[`on()`](#method-on) <span class="api-flag">static</span> | x |',
    ].join('\n');

    assert.equal(cleanReferenceMarkdown(body), [
      '[API reference](../../index.md) › Component',
      '',
      '| abstract class | `yii\\base\\Component` |',
      '| --- | --- |',
      '',
      '2 subclasses:',
      '',
      '- [`Action`](Action.md)',
      '- [`Model`](Model.md)',
      '',
      '| <span id="method-on"></span>[`on()`](#method-on) static | x |',
    ].join('\n'));
  });

  test('drops the wrap option of signature blocks', () => {
    assert.equal(cleanReferenceMarkdown('```php wrap\npublic function on(): void\n```'),
      '```php\npublic function on(): void\n```');
  });

  test('keeps code blocks verbatim', () => {
    const body = '```html\n<div class="api-member">\n\n\n</div>\n```';

    assert.equal(cleanReferenceMarkdown(body), body);
  });
});

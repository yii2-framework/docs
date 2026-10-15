import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkYiiLinks } from './remark-yii-links.mjs';
import { resolveApiLink, rewriteApiLinksInLine, setLinkMap } from './yii-links.mjs';

setLinkMap({
  base: '/docs/',
  types: {
    'yii\\base\\Component': {
      slug: 'api/yii/base/component',
      members: { 'on()': 'method-on', $behaviors: 'property-behaviors' },
    },
    'yii\\base\\Configurable': { slug: 'api/yii/base/configurable', members: { 'configure()': 'method-configure' } },
    'yii\\base\\Widget': {
      slug: 'api/yii/base/widget',
      extends: 'yii\\base\\Component',
      implements: ['yii\\base\\Configurable'],
      members: { 'widget()': 'method-widget', $id: 'property-id', EVENT_INIT: 'event-EVENT_INIT' },
    },
  },
});

describe('resolveApiLink', () => {
  test('types, members, inherited members and labels', () => {
    assert.deepEqual(resolveApiLink('yii\\base\\Widget'), { url: '/docs/api/yii/base/widget/', label: 'Widget' });
    assert.deepEqual(resolveApiLink('\\yii\\base\\Widget::widget()'), {
      url: '/docs/api/yii/base/widget/#method-widget',
      label: 'Widget::widget()',
    });
    assert.equal(resolveApiLink('yii\\base\\Widget::$id').url, '/docs/api/yii/base/widget/#property-id');
    assert.equal(resolveApiLink('yii\\base\\Widget::on()').url, '/docs/api/yii/base/component/#method-on');
    assert.equal(resolveApiLink('yii\\base\\Widget::behaviors').url,
      '/docs/api/yii/base/component/#property-behaviors');
    assert.equal(resolveApiLink('yii\\base\\Widget::configure()').url,
      '/docs/api/yii/base/configurable/#method-configure');
    assert.equal(resolveApiLink('yii\\base\\Widget::EVENT_INIT', { markdown: true }).url,
      '/docs/api/yii/base/widget/index.md#event-EVENT_INIT');
  });

  test('unknown targets', () => {
    assert.equal(resolveApiLink('id'), null);
    assert.equal(resolveApiLink('yii\\base\\Widget::missing()'), null);
    assert.equal(resolveApiLink('yii\\base\\Widget::'), null);
  });
});

describe('rewriteApiLinksInLine', () => {
  test('links, titles, unknown targets and code spans', () => {
    assert.equal(
      rewriteApiLinksInLine('Call [[yii\\base\\Widget::widget()]] on [[yii\\base\\Widget|widgets]]; `[[x]]`, [[id]].'),
      'Call [`Widget::widget()`](/docs/api/yii/base/widget/index.md#method-widget) on '
        + '[widgets](/docs/api/yii/base/widget/index.md); `[[x]]`, `id`.',
    );
  });
});

describe('remarkYiiLinks', () => {
  // The Markdown pipeline of the site (Astro's unified processor), with only this plugin.
  const render = async (markdown) => {
    const processor = await createMarkdownProcessor({ remarkPlugins: [remarkYiiLinks], syntaxHighlight: false });

    return (await processor.render(markdown)).code;
  };

  test('text, raw HTML and code', async () => {
    const html = await render([
      'Use [[yii\\base\\Widget::widget()]] or [[yii\\base\\Widget|a widget]], not [[id]] or `[[yii\\base\\Widget]]`.',
      '',
      '<p dir="rtl">[[yii\\base\\Widget::$id]] <code>[[keep]]</code></p>',
      '',
      '```php',
      "[['a', 'b'], 'required']",
      '```',
    ].join('\n'));

    assert.match(html,
      /<a href="\/docs\/api\/yii\/base\/widget\/#method-widget"><code>Widget::widget\(\)<\/code><\/a>/);
    assert.match(html, /<a href="\/docs\/api\/yii\/base\/widget\/">a widget<\/a>/);
    assert.match(html, /<span class="api-unresolved" data-target="id"><code>id<\/code><\/span>/);
    assert.match(html, /<code>\[\[yii\\base\\Widget\]\]<\/code>/);
    assert.match(html, /<p dir="rtl"><a href="\/docs\/api\/yii\/base\/widget\/#property-id">/);
    assert.match(html, /<code>Widget::\$id<\/code><\/a> /);
    assert.match(html, / <code>\[\[keep\]\]<\/code><\/p>/);
    assert.match(html, /\[\['a', 'b'\], 'required'\]/);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkDemos, snippetHash } from './remark-demos.mjs';

const ALERT = "echo Alert::widget(['body' => 'Saved.']);";
const OTHER = 'echo Other::widget();';
const catalog = {
  package: 'pkg',
  demos: [
    { slug: 'alert-1', title: 'Alert', number: 1, hash: snippetHash(ALERT), status: 'rendered',
      page: '/docs/demos/pkg/alert-1.html' },
    { slug: 'alert-2', title: 'Alert', number: 2, hash: snippetHash(OTHER), status: 'failed', page: null },
  ],
};
const page = [
  '## Alert',
  '',
  '```php',
  ALERT,
  '```',
  '',
  '```html',
  '<div class="alert">Saved.</div>',
  '```',
  '',
  'A failed snippet keeps its blocks:',
  '',
  '```php',
  OTHER,
  '```',
].join('\n');

// The Markdown pipeline of the site (Astro's unified processor), with only this plugin.
const render = async (markdown, file) => {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [[remarkDemos, { catalog: (name) => (name === 'pkg' ? catalog : null) }]],
    syntaxHighlight: false,
  });

  return (await processor.render(markdown, { fileURL: pathToFileURL(file) })).code;
};

describe('snippetHash', () => {
  test('matches tools/src/Demo/Snippet.php and ignores whitespace variants', () => {
    assert.equal(snippetHash('echo 1;\n'), '67088607fe0d4960');
    assert.equal(snippetHash('\r\n  echo 1;   \r\n\r\n'), '67088607fe0d4960');
  });
});

describe('remarkDemos', () => {
  test('replaces a rendered php + html pair with tabs, an iframe and the original blocks', async () => {
    const html = await render(page, '/site/src/content/docs/extensions/pkg/examples.md');

    assert.match(html, /<docs-demo class="docs-demo not-content" data-demo="alert-1">/);
    assert.match(html, /<div class="docs-demo-tabs" role="tablist" aria-label="Alert example">/);
    assert.ok(html.includes('<button type="button" role="tab" id="demo-alert-1-tab-preview" '
      + 'aria-controls="demo-alert-1-preview" aria-selected="true" tabindex="0">Preview</button>'));
    assert.match(html, /aria-controls="demo-alert-1-html" aria-selected="false" tabindex="-1">HTML<\/button>/);
    assert.match(html, /<iframe src="\/docs\/demos\/pkg\/alert-1.html" loading="lazy" title="Alert demo"><\/iframe>/);
    for (const key of ['php', 'html']) {
      assert.ok(html.includes(`id="demo-alert-1-${key}" aria-labelledby="demo-alert-1-tab-${key}" hidden>`
        + `<pre><code class="language-${key}">`));
    }

    assert.equal((html.match(/<docs-demo /g) ?? []).length, 1, 'the failed snippet has no demo');
    assert.ok(html.includes('</docs-demo>\n<p>A failed snippet keeps its blocks:</p>\n'
      + '<pre><code class="language-php">echo Other::widget();'));
  });

  test('a php block without an html block gets Preview and PHP tabs only', async () => {
    const html = await render(['```php', ALERT, '```', '', 'Text.'].join('\n'),
      '/site/src/content/docs/extensions/pkg/examples.md');

    assert.match(html, /docs-demo-php/);
    assert.doesNotMatch(html, /docs-demo-html|HTML<\/button>/);
  });

  test('other pages and packages without a catalog are unchanged', async () => {
    for (const file of ['/site/src/content/docs/extensions/pkg/installation.md',
      '/site/src/content/docs/extensions/other/examples.md']) {
      const html = await render(page, file);

      assert.doesNotMatch(html, /docs-demo/);
      assert.equal((html.match(/<pre>/g) ?? []).length, 3);
    }
  });
});

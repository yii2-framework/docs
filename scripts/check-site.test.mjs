import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { apiLinkStats, checkLinks, htmlFiles, proseText } from './check-site.mjs';

const dist = mkdtempSync(path.join(tmpdir(), 'check-site-'));
const page = (file, body) => {
  mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  writeFileSync(path.join(dist, file), `<html><body><main>${body}</main></body></html>`);
};

page('guide/a/index.html', '<p id="top">See [[yii\\base\\Widget]]</p><pre><code>[[\'a\'], \'b\']</code></pre>'
  + '<button data-code="[[x]] => y">copy</button>'
  + '<span class="api-unresolved" data-target="toRoute()"><code>toRoute()</code></span>');
page('api/yii/index.html', '<a href="/docs/guide/a/#top">ok</a> <a href="../../guide/a/">relative</a>'
  + ' <a href="/docs/guide/a/#missing">fragment</a> <a href="/docs/api/none/">missing</a>'
  + ' <a href="https://example.org/">external</a>');

after(() => rmSync(dist, { recursive: true, force: true }));

describe('check-site', () => {
  test('prose excludes code, pre and attribute values', () => {
    assert.equal((proseText('<main><p>[[a]]</p><code>[[b]]</code><b title="[[c]] > d">e</b></main>').match(/\[\[/g)
      ?? []).length, 1);
  });

  test('literal [[ and unresolved spans are counted', () => {
    const stats = apiLinkStats(dist, ['guide/a/index.html']);

    assert.equal(stats.literal, 1);
    assert.deepEqual([...stats.unresolved], [['toRoute()', 1]]);
  });

  test('missing pages and fragments are reported, external links skipped', () => {
    assert.deepEqual(htmlFiles(dist).sort(), ['api/yii/index.html', 'guide/a/index.html']);

    const { checked, broken } = checkLinks(dist, ['api/yii/index.html']);

    assert.equal(checked, 4);
    assert.deepEqual(broken, [
      'api/yii/index.html: /docs/guide/a/#missing (no id "missing")',
      'api/yii/index.html: /docs/api/none/ (missing)',
    ]);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { annotateIndex, countPages, distPath, formatTokens, labelFullBundle } from './llms-sizes.mjs';

const INDEX = `# Yii2 Framework

> Documentation.

## Guide

- [Widgets](/docs/guide/structure-widgets/index.md): Widgets are reusable building blocks.
- Bundle [guide.txt](/docs/_llms-txt/guide.txt): all pages above

## API reference

- [yii\\db](/docs/api/yii/db/index.md)

Bundles at \`/docs/_llms-txt/<name>.txt\`:

- Bundles yii\\db: api-yii2-db, api-yii2-db-query

## Documentation Sets

- [Abridged documentation](https://yii2-framework.github.io/docs/llms-small.txt): a compact version
- [Complete documentation](https://yii2-framework.github.io/docs/llms-full.txt): the full documentation
- [Guide](https://yii2-framework.github.io/docs/_llms-txt/guide.txt)
- [api-yii2-db](https://yii2-framework.github.io/docs/_llms-txt/api-yii2-db.txt): yii\\db

## Notes

- The complete documentation includes all content from the official documentation
`;

const SIZES = {
  'guide/structure-widgets/index.md': 8193,
  '_llms-txt/guide.txt': 92000,
  'api/yii/db/index.md': 1800,
  '_llms-txt/api-yii2-db.txt': 110000,
  '_llms-txt/api-yii2-db-query.txt': 60000,
  'llms-small.txt': 1229499,
  'llms-full.txt': 1316593,
};

describe('formatTokens', () => {
  test('keeps two significant digits', () => {
    assert.deepEqual([102, 400, 1800, 9300, 92000, 1500000].map(formatTokens),
      ['0.025k', '0.1k', '0.45k', '2.3k', '23k', '375k']);
  });
});

describe('distPath', () => {
  test('maps site links to dist paths', () => {
    assert.equal(distPath('/docs/guide/x/index.md#a'), 'guide/x/index.md');
    assert.equal(distPath('https://yii2-framework.github.io/docs/llms-full.txt'), 'llms-full.txt');
    assert.equal(distPath('https://example.com/docs/x'), null);
  });
});

describe('annotateIndex', () => {
  const sizeOf = (file) => SIZES[file] ?? null;

  test('adds sizes, lists each bundle once, labels the full bundles and drops the notes', () => {
    const { text, missing, linked } = annotateIndex(INDEX, sizeOf);

    assert.match(text, /^- \[Widgets\]\(.*\): Widgets are reusable building blocks\. \(~2k tokens\)$/m);
    assert.match(text, /^- Bundle \[guide\.txt\]\(.*\): all pages above \(~23k tokens\)$/m);
    assert.match(text, /^- \[yii\\db\]\(\/docs\/api\/yii\/db\/index\.md\) \(~0\.45k tokens\)$/m);
    assert.match(text, /^- Bundles yii\\db: api-yii2-db ~28k, api-yii2-db-query ~15k$/m);
    assert.match(text, /\/docs\/llms-full\.txt\): for indexing tools .*except the API reference \(~329k tokens\)$/m);
    assert.doesNotMatch(text, /_llms-txt\/guide\.txt\)\n|Notes|api-yii2-db\.txt\)/);
    assert.deepEqual(missing, []);
    assert.ok(linked.has('_llms-txt/api-yii2-db-query.txt'));
  });

  test('is idempotent and reports missing files', () => {
    const once = annotateIndex(INDEX, sizeOf).text;

    assert.equal(annotateIndex(once, sizeOf).text, once);
    assert.deepEqual(annotateIndex(INDEX, (file) => (file === 'llms-full.txt' ? null : sizeOf(file))).missing,
      ['llms-full.txt']);
  });
});

describe('labelFullBundle', () => {
  test('labels the first line once', () => {
    const text = '<SYSTEM>This is the full developer documentation for Yii2 Framework</SYSTEM>\n\n# Page\n\n> D.\n';
    const once = labelFullBundle(text);

    const size = formatTokens('\n\n# Page\n\n> D.\n'.length);

    assert.ok(once.startsWith('<SYSTEM>This is the full developer documentation for Yii2 Framework. For indexing '
      + `tools (Cursor, Context7 and similar), about ${size} tokens: do not read it whole. Agents: start at `
      + 'https://yii2-framework.github.io/docs/llms.txt and fetch single pages or topic bundles.</SYSTEM>\n\n# Page'));
    assert.equal(labelFullBundle(once), once);
  });
});

describe('countPages', () => {
  test('counts page headers outside code', () => {
    assert.equal(countPages('<SYSTEM>x</SYSTEM>\n\n# A\n\n> a.\n\n```sh\n# B\n\n> b.\n```\n\n# C\n\n> c.\n'), 2);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { llmsTxtDetails, shortDescription } from './llms-index.mjs';

describe('shortDescription', () => {
  test('keeps short text, cuts after a sentence or at a word boundary', () => {
    assert.equal(shortDescription('Short.'), 'Short.');
    assert.equal(shortDescription(`${'a'.repeat(60)}. ${'b '.repeat(40)}`), `${'a'.repeat(60)}.`);
    assert.equal(shortDescription(`${'word '.repeat(30)}`, 20), 'word word word...');
  });
});

describe('llmsTxtDetails', () => {
  const pages = new Map([
    ['guide/a', { title: 'A', description: 'Page A.' }],
    ['api/yii/db', { title: 'yii\\db', description: '3 classes.' }],
  ]);
  const groups = [
    { label: 'Guide', slugs: ['guide/a'], sections: [] },
    { label: 'API reference', slugs: ['api/yii/db'], sections: [] },
  ];

  test('lists pages with base-absolute links, then the bundles', () => {
    const details = llmsTxtDetails(groups, pages, {
      site: 'https://example.com',
      base: '/docs',
      intro: 'Intro.',
      bundles: [
        { name: 'guide', description: 'A', group: 'Guide', whole: true },
        { name: 'api-yii2-db', description: 'yii\\db', group: 'API reference', topic: 'yii\\db', whole: false },
        { name: 'api-yii2-db-query', description: 'yii\\db', group: 'API reference', topic: 'yii\\db', whole: false },
      ],
    });

    assert.equal(details, 'Intro.\n\n## Guide\n\n- [A](/docs/guide/a/index.md): Page A.\n'
      + '- Bundle [guide.txt](/docs/_llms-txt/guide.txt): all pages above\n\n## API reference\n\n'
      + '- [yii\\db](/docs/api/yii/db/index.md)\n\nBundles at `/docs/_llms-txt/<name>.txt`, named after their first '
      + 'namespace or type (sizes in tokens):\n\n- Bundles yii\\db: api-yii2-db, api-yii2-db-query');
  });
});

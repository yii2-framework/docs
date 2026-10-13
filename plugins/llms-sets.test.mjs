import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { apiBundles, bundleNames, partition, sourceSizer, topicBundles, topicName } from './llms-sets.mjs';

const page = (title) => ({ title, description: `${title} page.`, file: '' });

describe('partition', () => {
  const size = (item) => item;

  test('uses the fewest chunks and balances them', () => {
    assert.deepEqual(partition([50, 50, 50], size, 120), [[50], [50, 50]]);
    assert.deepEqual(partition([30, 30, 30, 30], size, 120), [[30, 30, 30, 30]]);
    assert.deepEqual(partition([60, 20, 20, 60, 40], size, 120), [[60, 20, 20], [60, 40]]);
  });

  test('gives an item above the limit a chunk of its own', () => {
    assert.deepEqual(partition([10, 200, 10], size, 120), [[10], [200], [10]]);
    assert.deepEqual(partition([], size, 120), []);
  });
});

describe('topicName', () => {
  test('drops the shared directory and the shared prefix', () => {
    const unit = ['guide/db-dao', 'guide/db-query-builder', 'guide/db-active-record'];

    assert.equal(topicName('guide/db-active-record', unit), 'active-record');
    assert.equal(topicName('extensions/x/examples', ['extensions/x', 'extensions/x/examples']), 'examples');
    assert.equal(topicName('extensions/x', ['extensions/x', 'extensions/x/examples']), 'overview');
  });
});

describe('topicBundles', () => {
  const pages = new Map([
    ['guide/db-dao', page('DAO')],
    ['guide/db-query-builder', page('Query Builder')],
    ['guide/db-active-record', page('Active Record')],
    ['guide/glossary', page('Glossary')],
    ['extensions/x', page('X')],
    ['extensions/x/examples', page('Examples')],
    ['extensions/x/reference', page('X API reference')],
  ]);
  const sizes = { 'guide/db-dao': 50, 'guide/db-query-builder': 50, 'guide/db-active-record': 90 };
  const size = (slug) => sizes[slug] ?? 10;
  const groups = [
    { label: 'Working with Databases', slugs: ['guide/db-dao', 'guide/db-query-builder', 'guide/db-active-record'],
      sections: [] },
    { label: 'Glossary', slugs: ['guide/glossary'], sections: [] },
    { label: 'Extensions', slugs: ['extensions/x', 'extensions/x/examples', 'extensions/x/reference'],
      sections: [{ label: 'X', slugs: ['extensions/x', 'extensions/x/examples', 'extensions/x/reference'] }] },
    { label: 'API reference', slugs: ['api'], sections: [] },
  ];

  test('splits large groups by topic, keeps the first chunk name and skips the reference', () => {
    const bundles = topicBundles(groups, pages, { size, limit: 120 });

    assert.deepEqual(bundles.map(({ label, paths, whole }) => [label, paths, whole]), [
      ['Working with Databases', ['guide/db-dao', 'guide/db-query-builder'], false],
      ['Working with Databases: active-record', ['guide/db-active-record'], false],
      ['Glossary', ['guide/glossary'], true],
      ['Extensions: x', ['extensions/x', 'extensions/x/examples'], true],
    ]);
    assert.equal(bundles[0].description, 'DAO, Query Builder');
    assert.equal(bundles[3].section, 'X');
    assert.deepEqual(bundleNames(bundles), ['working-with-databases', 'working-with-databases-active-record',
      'glossary', 'extensions-x']);
  });
});

describe('apiBundles', () => {
  const pages = new Map([
    ['api', page('API reference')],
    ['api/yii', page('yii')],
    ['api/yii/baseyii', page('BaseYii')],
    ['api/yii/db', page('yii\\db')],
    ['api/yii/db/activequery', page('ActiveQuery')],
    ['api/yii/db/command', page('Command')],
    ['api/yii/db/query', page('Query')],
    ['api/yii/db/mysql', page('yii\\db\\mysql')],
    ['api/yii/db/mysql/schema', page('Schema')],
    ['api/yii/di', page('yii\\di')],
    ['api/yii/di/container', page('Container')],
    ['extensions/x/reference', page('X API reference')],
    ['extensions/x/reference/widget', page('Widget')],
  ]);
  const types = new Map([
    ['api/yii/baseyii', 'yii\\BaseYii'],
    ['api/yii/db/activequery', 'yii\\db\\ActiveQuery'],
    ['api/yii/db/command', 'yii\\db\\Command'],
    ['api/yii/db/query', 'yii\\db\\Query'],
    ['api/yii/db/mysql/schema', 'yii\\db\\mysql\\Schema'],
    ['api/yii/di/container', 'yii\\di\\Container'],
    ['extensions/x/reference/widget', 'vendor\\x\\Widget'],
  ]);
  const size = (slug) => (slug.startsWith('api/yii/db/') ? 40 : 10);

  test('groups by namespace and package and splits large groups in reading order', () => {
    const bundles = apiBundles(pages, { size, types, limit: 130 });

    assert.deepEqual(bundles.map(({ label, paths }) => [label, paths]), [
      ['api-yii2', ['api', 'api/yii', 'api/yii/baseyii']],
      ['api-yii2-db', ['api/yii/db', 'api/yii/db/activequery', 'api/yii/db/command']],
      ['api-yii2-db-query', ['api/yii/db/mysql', 'api/yii/db/mysql/schema', 'api/yii/db/query']],
      ['api-yii2-di', ['api/yii/di', 'api/yii/di/container']],
      ['api-x', ['extensions/x/reference', 'extensions/x/reference/widget']],
    ]);
    assert.deepEqual(bundles.map(({ description }) => description), [
      'API reference, yii; 1 type',
      'yii\\db (ActiveQuery to Command); 2 types',
      'yii\\db (Query), yii\\db\\mysql; 2 types',
      'yii\\di; 1 type',
      'vendor\\x; 1 type',
    ]);
    assert.deepEqual(bundles.map(({ topic }) => topic), ['index, global namespace, yii', 'yii\\db', 'yii\\db',
      'yii\\di', 'vendor\\x']);
  });
});

describe('sourceSizer', () => {
  test('measures the body without frontmatter and table padding, plus the bundle header', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'llms-sets-'));

    mkdirSync(path.join(dir, 'guide'));
    writeFileSync(path.join(dir, 'guide', 'a.md'), '---\ntitle: A\n---\n| x     |\n| ----- |\n| 1     |\n');

    const size = sourceSizer(new Map([['guide/a', { title: 'A', description: 'D.', file: 'guide/a.md' }]]),
      { contentDir: `${dir}/`, factor: 1 });

    assert.equal(size('guide/a'), '| x |\n| --- |\n| 1 |\n'.length + '# A\n\n> D.\n\n'.length);
    assert.throws(() => size('guide/missing'), /no English page/);
  });
});

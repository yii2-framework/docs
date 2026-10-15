import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { collapseTablePadding, splitRow } from './llms-tables.mjs';

describe('collapseTablePadding', () => {
  test('collapses cell padding and delimiter rows, keeping alignment colons', () => {
    const text = 'Intro  with  spaces.\n\n| Name      | Value |\n| :-------- | ----: |\n| `a`       | 1     |\n'
      + '| `b`       |       |\n\nAfter.';
    const { text: collapsed, tables } = collapseTablePadding(text);

    assert.equal(tables, 1);
    assert.equal(collapsed, 'Intro  with  spaces.\n\n| Name | Value |\n| :--- | ---: |\n| `a` | 1 |\n| `b` | |\n\n'
      + 'After.');
  });

  test('keeps escaped pipes inside cells and indented tables', () => {
    const text = '  | Type          | Note  |\n  | ------------- | ----- |\n  | `a\\|b`        | x \\\\ |\n';

    assert.equal(collapseTablePadding(text).text, '  | Type | Note |\n  | --- | --- |\n  | `a\\|b` | x \\\\ |\n');
  });

  test('leaves code fences and rows without a delimiter row untouched', () => {
    const text = '```\n| a    | b |\n| ---- | - |\n```\n\n| not   | a table |\nText.';

    assert.deepEqual(collapseTablePadding(text), { text, tables: 0 });
  });

  test('is idempotent', () => {
    const once = collapseTablePadding('| a   | b   |\n| --- | --- |\n| 1   | 2   |').text;

    assert.equal(collapseTablePadding(once).text, once);
  });
});

describe('splitRow', () => {
  test('splits at unescaped pipes only', () => {
    assert.deepEqual(splitRow('| a \\| b | c |'), [' a \\| b ', ' c ']);
    assert.equal(splitRow('a | b'), null);
  });
});

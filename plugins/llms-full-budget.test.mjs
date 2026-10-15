import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cutPosition } from './llms-full-budget.mjs';

describe('cutPosition', () => {
  const text = '<SYSTEM>x</SYSTEM>\n\n# Guide\n\n> Guide page.\n\nBody.\n\n# Widget\n\n> Widget class.\n\nTable.\n\n'
    + '# Request\n\n> Request class.\n\nMore.\n';

  test('cuts before the first excluded page', () => {
    const cut = cutPosition(text, ['# Request\n\n> Request class.', '# Widget\n\n> Widget class.'],
      ['# Guide\n\n> Guide page.']);

    assert.equal(text.slice(0, cut), '<SYSTEM>x</SYSTEM>\n\n# Guide\n\n> Guide page.\n\nBody.');
  });

  test('returns -1 without excluded pages and throws when a kept page follows the cut', () => {
    assert.equal(cutPosition(text, ['# Missing\n\n> None.'], []), -1);
    assert.throws(() => cutPosition(text, ['# Widget\n\n> Widget class.'], ['# Request\n\n> Request class.']),
      /come after the API reference/);
  });
});

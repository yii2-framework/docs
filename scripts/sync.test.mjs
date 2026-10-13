// Self-tests of scripts/sync.mjs: `npm run test:sync` (`node --test scripts/sync.test.mjs`).

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { convertPage, linkRewriter, packageNameMismatch, validateManifest } from './sync.mjs';

const work = mkdtempSync(path.join(tmpdir(), 'sync-test-'));

after(() => rmSync(work, { recursive: true, force: true }));

/** Creates a package directory with the given `composer.json` contents (`null` for none). */
function fakePackage(name, composer) {
  const dir = path.join(work, name);

  mkdirSync(dir, { recursive: true });
  if (composer !== null) {
    writeFileSync(path.join(dir, 'composer.json'), composer);
  }

  return dir;
}

describe('packageNameMismatch', () => {
  test('matching name', () => {
    const dir = fakePackage('match', JSON.stringify({ name: 'yii2-extensions/bootstrap6' }));

    assert.equal(packageNameMismatch(dir, 'yii2-extensions/bootstrap6'), null);
  });

  test('template sources', () => {
    const dir = fakePackage('template', JSON.stringify({ name: 'yii2-extensions/template' }));

    assert.equal(packageNameMismatch(dir, 'yii2-extensions/bootstrap6'), 'yii2-extensions/template');
  });

  test('missing and invalid composer.json', () => {
    assert.equal(packageNameMismatch(fakePackage('none', null), 'a/b'), '(no composer.json)');
    assert.equal(packageNameMismatch(fakePackage('invalid', '{'), 'a/b'), '(invalid composer.json)');
  });
});

describe('validateManifest', () => {
  const valid = {
    name: 'demo',
    title: 'Demo',
    repo: 'https://github.com/o/demo',
    ref: 'main',
    docsDir: 'docs',
    srcDir: 'src',
    namespace: 'o\\demo',
    localPath: '../demo',
    packagist: 'o/demo',
  };

  test('accepts a complete entry', () => {
    assert.deepEqual(validateManifest([valid], 'packages.json'), [valid]);
  });

  test('reports every missing key', () => {
    const { ref, packagist, ...partial } = valid;

    assert.throws(() => validateManifest([partial], 'packages.json'), /"ref".*\n.*"packagist"/);
  });

  test('a framework entry needs no docsDir; an unknown type is rejected', () => {
    const { docsDir, ...framework } = { ...valid, type: 'framework' };

    assert.equal(docsDir, 'docs');
    assert.deepEqual(validateManifest([framework], 'packages.json'), [framework]);
    assert.throws(() => validateManifest([{ ...valid, type: 'library' }], 'packages.json'), /"type" must be one of/);
    assert.throws(() => validateManifest([{ ...framework, type: undefined }], 'packages.json'), /"docsDir"/);
  });

  test('rejects duplicates and an empty manifest', () => {
    assert.throws(() => validateManifest([valid, valid], 'packages.json'), /duplicate name "demo"/);
    assert.throws(() => validateManifest([], 'packages.json'), /non-empty array/);
  });
});

describe('linkRewriter', () => {
  const dir = fakePackage('links', null);
  const rewrite = linkRewriter({
    sourceDir: dir,
    blobBase: 'https://github.com/o/demo',
    ref: 'main',
    docsDir: 'docs',
    pages: new Map([['README.md', 'index.md'], ['docs/installation.md', 'installation.md']]),
    images: new Set(['docs/svgs/features.svg']),
  });

  test('links between synced pages stay relative', () => {
    assert.equal(rewrite('docs/installation.md#requirements', 'README.md'), 'installation.md#requirements');
    assert.equal(rewrite('../README.md', 'docs/installation.md'), 'index.md');
  });

  test('images point next to the page', () => {
    assert.equal(rewrite('./docs/svgs/features.svg', 'README.md'), './svgs/features.svg');
  });

  test('other files become GitHub URLs at ref; absolute URLs are kept', () => {
    assert.equal(
      rewrite('../src/Alert.php', 'docs/installation.md'),
      'https://github.com/o/demo/blob/main/src/Alert.php',
    );
    assert.equal(rewrite('LICENSE', 'README.md'), 'https://github.com/o/demo/blob/main/LICENSE');
    assert.equal(rewrite('https://example.com/x.md', 'README.md'), 'https://example.com/x.md');
    assert.equal(rewrite('#top', 'README.md'), '#top');
  });
});

describe('convertPage', () => {
  const options = {
    sourceFile: 'docs/guide.md',
    fallbackTitle: null,
    packageTitle: 'Demo',
    rewrite: (href) => href,
    order: 1,
    label: null,
    editUrl: 'https://github.com/o/demo/edit/main/docs/guide.md',
    generatedFrom: 'https://github.com/o/demo@main',
    extra: null,
  };

  test('title from the first H1, alerts become asides, badges are dropped', () => {
    const page = convertPage([
      '# Guide',
      '',
      '[![Build](https://img.shields.io/badge/build-passing-green.svg)](https://ci.example.com)',
      '',
      'Installs the demo package with Composer.',
      '',
      '> [!WARNING]',
      '> Alpha release.',
      '',
      '```php',
      '# not a title',
      '```',
    ].join('\n'), options);

    assert.match(page, /^---\n# Generated by scripts\/sync\.mjs/);
    assert.match(page, /\ntitle: "Guide"\n/);
    assert.match(page, /\ndescription: "Installs the demo package with Composer\."\n/);
    assert.match(page, /\n:::caution\nAlpha release\.\n:::\n/);
    assert.match(page, /\n# not a title\n/);
    assert.doesNotMatch(page, /shields\.io|\n# Guide/);
  });

  test('Packagist (poser) and StyleCI badges are dropped with their section', () => {
    const page = convertPage([
      '# Guide',
      '',
      'Installs the demo package with Composer.',
      '',
      '## Quality code',
      '',
      '[![Latest Stable Version](https://poser.pugx.org/o/demo/v)](https://github.com/o/demo/releases)',
      '[![StyleCI](https://github.styleci.io/repos/711867018/shield?branch=main)](https://github.styleci.io/repos/1)',
      '',
      '## Next',
      '',
      'Read on.',
    ].join('\n'), options);

    assert.doesNotMatch(page, /poser\.pugx\.org|styleci|## Quality code/);
    assert.match(page, /\n## Next\n\nRead on\.\n/);
  });
});

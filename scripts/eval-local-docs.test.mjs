import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, describe, test } from 'node:test';

const root = mkdtempSync(path.join(tmpdir(), 'eval-local-docs-'));
const source = path.join(root, 'source');
const workspace = path.join(root, 'workspace');
const runner = path.resolve('eval/prepare-local-docs.sh');
const pages = [
  'extensions/bootstrap6/configuration/index.md',
  'extensions/bootstrap6/reference/dialog/index.md',
];

mkdirSync(workspace);
for (const [index, page] of pages.entries()) {
  const file = path.join(source, page);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `# Page ${index + 1}\n\nFixture documentation.\n`);
}

after(() => rmSync(root, { recursive: true, force: true }));

function prepare() {
  return spawnSync('bash', [runner, '09-dialog-options', workspace], {
    encoding: 'utf8',
    env: { ...process.env, EVAL_DOCS_SOURCE: source },
  });
}

describe('local evaluation documentation', () => {
  test('copies only task-declared pages and writes a sized, hashed index', () => {
    const result = prepare();

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Prepared 2 documentation pages/);

    const index = readFileSync(path.join(workspace, '.eval-docs/INDEX.md'), 'utf8');
    for (const page of pages) {
      assert.equal(
        readFileSync(path.join(workspace, '.eval-docs', page), 'utf8'),
        readFileSync(path.join(source, page), 'utf8'),
      );
      assert.match(index, new RegExp(page.replaceAll('/', '\\/')));
    }
    assert.equal((index.match(/SHA-256/g) ?? []).length, 2);

    const repeated = prepare();
    assert.equal(repeated.status, 1);
    assert.match(repeated.stderr, /destination already exists/);
  });

  test('copies the legacy workspace fixture of a task and never overwrites existing files', () => {
    const toastPages = [
      'extensions/bootstrap6/configuration/index.md',
      'extensions/bootstrap6/migration/index.md',
      'extensions/bootstrap6/reference/toast/index.md',
    ];
    for (const page of toastPages) {
      const file = path.join(source, page);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, `# ${page}\n\nFixture documentation.\n`);
    }

    const toastWorkspace = path.join(root, 'toast-workspace');
    mkdirSync(toastWorkspace);
    const run = () =>
      spawnSync('bash', [runner, '10-toast-migration', toastWorkspace], {
        encoding: 'utf8',
        env: { ...process.env, EVAL_DOCS_SOURCE: source },
      });

    const result = run();
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Copied workspace fixture 10-toast-migration/);
    assert.match(
      readFileSync(path.join(toastWorkspace, 'resources/views/post/_saved.php'), 'utf8'),
      /yii\\bootstrap5\\Toast/,
    );

    const conflicting = path.join(root, 'toast-conflict');
    mkdirSync(path.join(conflicting, 'resources/views/post'), { recursive: true });
    writeFileSync(path.join(conflicting, 'resources/views/post/_saved.php'), '<?php // existing\n');
    const blocked = spawnSync('bash', [runner, '10-toast-migration', conflicting], {
      encoding: 'utf8',
      env: { ...process.env, EVAL_DOCS_SOURCE: source },
    });
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /would overwrite/);
    assert.equal(
      readFileSync(path.join(conflicting, 'resources/views/post/_saved.php'), 'utf8'),
      '<?php // existing\n',
    );
  });
});

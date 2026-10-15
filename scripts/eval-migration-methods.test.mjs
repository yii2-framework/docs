import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, describe, test } from 'node:test';

const work = mkdtempSync(path.join(tmpdir(), 'eval-migration-methods-'));
const checker = path.resolve('eval/lib/migration-methods.php');

after(() => rmSync(work, { recursive: true, force: true }));

function check(name, methods) {
  const file = path.join(work, `${name}.php`);
  const body = methods.map((method) => `public function ${method}(): void {}`).join('\n');

  writeFileSync(file, `<?php\nclass Migration {\n${body}\n}\n`);

  return spawnSync('php', [checker, file], { encoding: 'utf8' });
}

describe('migration method classification', () => {
  test('accepts the transactional safeUp/safeDown pair', () => {
    const result = check('safe', ['safeUp', 'safeDown']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /safeUp\/safeDown.*transaction wrapper/);
  });

  test('accepts the supported direct up/down pair', () => {
    const result = check('direct', ['up', 'down']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /up\/down.*supported direct methods/);
  });

  test('rejects incomplete, mixed, or duplicate pairs', () => {
    for (const [name, methods] of [
      ['incomplete', ['safeUp']],
      ['mixed', ['safeUp', 'down']],
      ['both', ['safeUp', 'safeDown', 'up', 'down']],
    ]) {
      const result = check(name, methods);

      assert.equal(result.status, 1);
      assert.match(`${result.stdout}${result.stderr}`, /declare exactly one complete pair/);
    }
  });
});

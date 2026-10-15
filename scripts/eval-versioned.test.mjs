import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

const root = mkdtempSync(path.join(tmpdir(), 'eval-versioned-'));
const task = '10-toast-migration';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
after(() => rmSync(root, { recursive: true, force: true }));

function fixture(name) {
  const run = path.join(root, name);
  mkdirSync(run);
  cpSync(`eval/fixtures/v2/pass/${task}`, path.join(run, task), { recursive: true });
  return run;
}
function check(run, extra = ['--task-version', 'v2']) {
  const out = path.join(run, `checks-${extra.join('-').replaceAll('/', '_') || 'default'}`);
  const env = { ...process.env, EVAL_APP_DIR: path.join(root, 'absent-app') };
  delete env.EVAL_TASKS_DIR;
  const result = spawnSync('bash', ['eval/check.sh', run, '--task', task, '--out', out, ...extra],
    { env, encoding: 'utf8' });
  return { result, out, rows: existsSync(path.join(out, 'results.tsv'))
    ? readFileSync(path.join(out, 'results.tsv'), 'utf8') : '' };
}

test('v1 task definitions retain canonical hashes while v2 publishes B1 and explicit strict typing', () => {
  // Pin the canonical Markdown after Prettier normalized path escapes; acceptance requirements stay unchanged.
  const versions = new Map([
    ['09-dialog-options', '069c1f0197b64ebdcb1895dbf4b93fee6608012d58b5c5e270bc8ce0228d4d45'],
    [task, 'f0c4314130ad8d495951ac1bd3a7ec745a5d759695c5c9b803cbf3ba720b5db6'],
    ['11-filepond-avatar', '367f9fddbc267c5fe5aa0957d32e6a655264209a1e51a5e64f3fbb75a29147fc'],
  ]);
  for (const [id, expected] of versions) {
    assert.equal(sha(readFileSync(`eval/tasks/${id}.md`)), expected);
    const file = `eval/tasks/v2/${id}.md`;
    const definition = JSON.parse(spawnSync('php', ['eval/lib/task.php', file, '--json'], { encoding: 'utf8' }).stdout);
    assert.equal(definition.id, id);
    assert.equal(definition.criterion, 'B1');
    const body = spawnSync('php', ['eval/lib/task.php', file, '--body'], { encoding: 'utf8' }).stdout;
    assert.match(body, /Every PHP file you write must declare `strict_types=1`/);
    const original = JSON.parse(spawnSync('php', ['eval/lib/task.php', `eval/tasks/${id}.md`, '--json'], { encoding: 'utf8' }).stdout);
    assert.deepEqual(definition.docs, original.docs);
    assert.deepEqual(definition.outputs, original.outputs);
    assert.deepEqual(definition.workspace, original.workspace);
  }
});

test('v2 checker accepts the grouped Toast fixture and records the selected contract hash', () => {
  const run = fixture('grouped');
  writeFileSync(path.join(run, task, 'meta.json'), JSON.stringify({
    task_version: 'v2', criterion: 'B1', task_definition_sha256: sha(readFileSync(`eval/tasks/v2/${task}.md`)),
  }));
  const { result, out, rows } = check(run);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(rows, /php-import:[^\t]+\tpass\t/);
  const contracts = JSON.parse(readFileSync(path.join(out, 'contracts.json')));
  assert.equal(contracts.task_version, 'v2');
  assert.equal(contracts.definitions[task].sha256, sha(readFileSync(`eval/tasks/v2/${task}.md`)));
});

test('v2 checker rejects a grouped import from the wrong namespace', () => {
  const run = fixture('wrong-group');
  const file = path.join(run, task, 'files/resources/views/post/_saved.php');
  writeFileSync(file, readFileSync(file, 'utf8').replace('use yii2\\extensions\\bootstrap6\\{Html, Toast};',
    'use unrelated\\bootstrap6\\{Html, Toast};'));
  const { result, rows } = check(run);
  assert.equal(result.status, 1, result.stderr);
  assert.match(rows, /php-import:[^\t]+\tfail\t/);
});

test('v2 checker requires the strict declaration communicated in its task body', () => {
  const run = fixture('no-strict');
  const file = path.join(run, task, 'files/resources/views/post/_saved.php');
  writeFileSync(file, readFileSync(file, 'utf8').replace('declare(strict_types=1);', ''));
  const { result, rows } = check(run);
  assert.equal(result.status, 1, result.stderr);
  assert.match(rows, /strict-types\tfail\t/);
});

test('checker defaults to v1 instead of silently selecting the new acceptance contract', () => {
  const run = fixture('default-v1');
  const { result, out, rows } = check(run, []);
  assert.equal(result.status, 1, result.stderr);
  assert.match(rows, /grep:[^\t]*Toast\tfail\t/);
  assert.equal(JSON.parse(readFileSync(path.join(out, 'contracts.json'))).task_version, 'v1');
});

test('checker refuses legacy metadata under v2 without rescoring output checks', () => {
  const run = fixture('legacy-metadata');
  writeFileSync(path.join(run, task, 'meta.json'), JSON.stringify({ criterion: 'A2' }));
  const { result, rows } = check(run);
  assert.equal(result.status, 1, result.stderr);
  assert.match(rows, /task-version\tfail\trecorded v1; selected v2/);
  assert.equal(rows.trim().split('\n').length, 1);
});

test('checker refuses v2 metadata under v1 and a changed hash under the matching version', () => {
  const run = fixture('versioned-metadata');
  const file = path.join(run, task, 'meta.json');
  writeFileSync(file, JSON.stringify({ task_version: 'v2', task_definition_sha256: sha(readFileSync(`eval/tasks/v2/${task}.md`)) }));
  const wrongVersion = check(run, []);
  assert.equal(wrongVersion.result.status, 1);
  assert.match(wrongVersion.rows, /task-version\tfail\trecorded v2; selected v1/);
  writeFileSync(file, JSON.stringify({ task_version: 'v2', task_definition_sha256: '0'.repeat(64) }));
  const wrongHash = check(run);
  assert.equal(wrongHash.result.status, 1);
  assert.match(wrongHash.rows, /task-contract\tfail\t/);
  assert.equal(wrongHash.rows.trim().split('\n').length, 1);
});

test('checker rejects unsafe or unsupported version selection before writing results', () => {
  const run = fixture('invalid-version');
  const { result, out } = check(run, ['--task-version', '../v2']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown task version/);
  assert.equal(existsSync(out), false);
});

test('checker refuses ambiguous custom task roots combined with a version selector', () => {
  const run = fixture('custom-version');
  const out = path.join(run, 'checks');
  const result = spawnSync('bash', ['eval/check.sh', run, '--task', task, '--task-version', 'v2', '--out', out],
    { env: { ...process.env, EVAL_TASKS_DIR: path.resolve('eval/tasks') }, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Do not combine/);
  assert.equal(existsSync(out), false);
});

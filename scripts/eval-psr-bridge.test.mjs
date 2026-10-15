import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

const root = mkdtempSync(path.join(tmpdir(), 'psr-worker-eval-'));
const task = '12-psr-worker-lifecycle';
const skill = 'yii2-psr-bridge-worker';
const definitionFile = `eval/tasks/${task}.md`;
const parsed = spawnSync('php', ['eval/lib/task.php', definitionFile, '--json'], { encoding: 'utf8' });
assert.ifError(parsed.error);
assert.equal(parsed.status, 0, parsed.stderr);
const definition = JSON.parse(parsed.stdout);
const body = spawnSync('php', ['eval/lib/task.php', definitionFile, '--body'], { encoding: 'utf8' }).stdout;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const docs = path.join(root, 'docs');
const skills = path.join(root, 'skills');
mkdirSync(path.join(skills, skill), { recursive: true });
const canonical = `---\nname: ${skill}\ndescription: Isolated bridge fixture.\n---\n\nUnique portable body.\n`;
writeFileSync(path.join(skills, skill, 'SKILL.md'), canonical);
for (const page of definition.docs) {
  mkdirSync(path.dirname(path.join(docs, page)), { recursive: true });
  writeFileSync(path.join(docs, page), `# ${page}\n\nFixture guide.\n`);
}
after(() => rmSync(root, { recursive: true, force: true }));

test('PSR worker task prepares explicit/automatic native discovery for all three clients without inference', () => {
  for (const client of ['claude', 'codex', 'opencode']) for (const activation of ['explicit', 'auto']) {
    const workspace = path.join(root, `${client}-${activation}`);
    mkdirSync(workspace);
    const model = client === 'codex' ? 'gpt-6-luna' : client === 'opencode' ? 'github-copilot/kimi-k3' : 'sonnet';
    const result = spawnSync(process.execPath, ['eval/prepare-native.mjs', '--client', client,
      '--activation', activation, '--task', task, '--workspace', workspace, '--model', model,
      '--docs-source', docs, '--skill-source', skills], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const meta = JSON.parse(readFileSync(path.join(workspace, '.eval-run/meta.json')));
    const prompt = readFileSync(path.join(workspace, '.eval-run/prompt.md'), 'utf8');
    assert.equal(meta.task_body_sha256, sha(body));
    assert.equal(meta.criterion, 'B1');
    assert.equal(activation === 'auto' ? prompt : prompt.slice(prompt.indexOf('\n\n') + 2), body);
    assert.equal(readFileSync(path.join(workspace, meta.skill_destination, 'SKILL.md'), 'utf8'), canonical);
    assert.doesNotMatch(prompt, /Unique portable body/);
    assert.equal(meta.execution.model_called, false);
    assert.deepEqual(meta.outputs, ['src/Worker.php', 'config/bridge.php']);
    for (const item of meta.protected_inputs) assert.equal(item.sha256, sha(readFileSync(path.join(workspace, item.path))));
    assert.equal(readdirSync(path.join(workspace, '.eval-docs/extensions')).length, 1);
  }
});

const packageRoot = process.env.EVAL_PSR_BRIDGE_PACKAGE;
const fixture = path.resolve(`eval/fixtures/pass/${task}/files`);
const workerSource = readFileSync(path.join(fixture, 'src/Worker.php'), 'utf8');
const configSource = readFileSync(path.join(fixture, 'config/bridge.php'), 'utf8');

function probe(name, worker = workerSource, config = configSource) {
  const files = path.join(root, name, 'files');
  const runtime = path.join(root, name, 'runtime');
  cpSync(fixture, files, { recursive: true });
  mkdirSync(runtime, { recursive: true });
  writeFileSync(path.join(files, 'src/Worker.php'), worker);
  writeFileSync(path.join(files, 'config/bridge.php'), config);
  const result = spawnSync('php', ['eval/lib/psr-worker.php', '--package', packageRoot, '--files', files,
    '--runtime', runtime], { encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('reference worker passes real sequential-session, signing, strict-mode and lifecycle probes', { skip: !packageRoot }, () => {
  const result = probe('pass');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.ok(report.checks.length >= 40);
});

const negativeWorkers = [
  ['no-finalize', workerSource.replace('$this->app->finalize($emitted);', '')],
  ['finalize-twice', workerSource.replace('$this->app->finalize($emitted);', '$this->app->finalize($emitted);\n            $this->app->finalize($emitted);')],
  ['early-finalize', workerSource.replace('$emit($response);', '$this->app->finalize();\n            $emit($response);').replace('$this->app->finalize($emitted);', '')],
  ['false-success', workerSource.replace('$emitted = true;', '')],
  ['catch-finalize-again', workerSource.replace('} finally {\n            $this->app->finalize($emitted);', '} finally {\n            try { $this->app->finalize($emitted); } catch (\\Throwable $error) { $this->app->finalize(false); throw $error; }')],
];
for (const [name, worker] of negativeWorkers) {
  test(`runtime probe rejects ${name}`, { skip: !packageRoot }, () => {
    const result = probe(name, worker);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Failed:/);
  });
}
for (const [name, config] of [
  ['unsigned-cookies', configSource.replace("'enableCookieValidation' => true", "'enableCookieValidation' => false")],
  ['eager-session', configSource.replace("'useSession' => false", "'useSession' => true")],
  ['persist-session', configSource.replace("['db', 'cache']", "['db', 'cache', 'session']")],
]) {
  test(`runtime probe rejects ${name}`, { skip: !packageRoot }, () => {
    const result = probe(name, workerSource, config);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Failed:/);
  });
}

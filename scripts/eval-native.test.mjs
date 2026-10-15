import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

const root = mkdtempSync(path.join(tmpdir(), 'eval-native-'));
const docs = path.join(root, 'docs');
const skills = path.join(root, 'skills');
const runner = path.resolve('eval/prepare-native.mjs');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const tasks = ['09-dialog-options', '10-toast-migration', '11-filepond-avatar'];
const definitions = new Map();
for (const task of tasks) {
  const parsed = spawnSync('php', ['eval/lib/task.php', `eval/tasks/${task}.md`, '--json'], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
  const definition = JSON.parse(parsed.stdout);
  definitions.set(task, definition);
  for (const page of definition.docs) {
    mkdirSync(path.dirname(path.join(docs, page)), { recursive: true });
    writeFileSync(path.join(docs, page), `# ${page}\n\nSelected local guide.\n`);
  }
  mkdirSync(path.join(skills, definition.skill, 'references'), { recursive: true });
  writeFileSync(path.join(skills, definition.skill, 'SKILL.md'), `---\nname: ${definition.skill}\ndescription: Fixture trigger.\n---\n\nUnique canonical fixture body.\n`);
  writeFileSync(path.join(skills, definition.skill, 'references', 'usage.md'), '# Referenced recipe\n');
}
writeFileSync(path.join(docs, 'not-selected.md'), 'Never copy this file.');
after(() => rmSync(root, { recursive: true, force: true }));

function prepare(name, client = 'codex', activation = 'auto', task = tasks[0], extra = []) {
  const workspace = path.join(root, name);
  if (!existsSync(workspace)) mkdirSync(workspace);
  const model = client === 'codex' ? 'gpt-6-luna' : client === 'claude' ? 'sonnet' : 'opencode/space-bunny-free';
  const result = spawnSync(process.execPath, [runner, '--client', client, '--activation', activation,
    '--task', task, '--workspace', workspace, '--model', model,
    '--docs-source', docs, '--skill-source', skills, ...extra], { encoding: 'utf8' });
  return { workspace, result };
}

test('both task versions and all clients preserve prompt parity, exact skills and selected documentation hashes', () => {
  for (const version of ['v1', 'v2']) for (const task of tasks) {
    const definitionFile = `eval/tasks/${version === 'v1' ? '' : 'v2/'}${task}.md`;
    const body = spawnSync('php', ['eval/lib/task.php', definitionFile, '--body'], { encoding: 'utf8' }).stdout;
    if (version === 'v2') assert.match(body, /Every PHP file you write must declare `strict_types=1` with `declare\(strict_types=1\);`/);
    for (const client of ['claude', 'codex', 'opencode']) {
      for (const activation of ['auto', 'explicit']) {
        const { workspace, result } = prepare(`${version}-${task}-${client}-${activation}`, client, activation, task,
          version === 'v2' ? ['--task-version', version] : []);
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
        const meta = JSON.parse(readFileSync(path.join(workspace, '.eval-run/meta.json')));
        const prompt = readFileSync(path.join(workspace, '.eval-run/prompt.md'), 'utf8');
        assert.equal(meta.task_version, version);
        assert.equal(meta.task_definition_sha256, sha(readFileSync(definitionFile)));
        if (version === 'v2') assert.equal(meta.criterion, 'B1');
        assert.equal(meta.task_body_sha256, sha(body));
        assert.equal(meta.prompt_sha256, sha(prompt));
        assert.equal(activation === 'auto' ? prompt : prompt.slice(prompt.indexOf('\n\n') + 2), body);
        assert.doesNotMatch(prompt, /<skill|Unique canonical fixture body/);
        assert.equal(meta.execution.model_called, false);
        assert.equal(meta.execution.provider_contacted, false);
        assert.equal(meta.stages.activation, 'not-run');
        assert.equal(meta.stages.discovery, 'not-run');
        const clientFolder = { claude: '.claude', codex: '.agents', opencode: '.opencode' }[client];
        assert.equal(meta.skill_destination, `${clientFolder}/skills/${definitions.get(task).skill}`);
        assert.equal(readFileSync(path.join(workspace, meta.skill_destination, 'SKILL.md'), 'utf8'),
          readFileSync(path.join(skills, definitions.get(task).skill, 'SKILL.md'), 'utf8'));
        assert.equal(readFileSync(path.join(workspace, meta.skill_destination, 'references/usage.md'), 'utf8'), '# Referenced recipe\n');
        assert.equal(existsSync(path.join(workspace, '.eval-docs/not-selected.md')), false);
        for (const page of meta.docs) {
          const bytes = readFileSync(path.join(workspace, '.eval-docs', page.path));
          assert.equal(page.bytes, bytes.length);
          assert.equal(page.sha256, sha(bytes));
        }
        for (const input of meta.protected_inputs) assert.equal(input.sha256, sha(readFileSync(path.join(workspace, input.path))));
        assert.equal(meta.argv.includes('--dangerously-bypass-approvals-and-sandbox'), false);
      }
    }
  }
});

test('preparation refuses existing workspace content without changing it', () => {
  const { workspace } = prepare('existing');
  const before = readFileSync(path.join(workspace, '.eval-run/meta.json'), 'utf8');
  const { result } = prepare('existing');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be empty/);
  assert.equal(readFileSync(path.join(workspace, '.eval-run/meta.json'), 'utf8'), before);
  const occupied = path.join(root, 'occupied');
  mkdirSync(occupied);
  writeFileSync(path.join(occupied, 'keep.txt'), 'existing work');
  const blocked = prepare('occupied').result;
  assert.equal(blocked.status, 1);
  assert.deepEqual(readdirSync(occupied), ['keep.txt']);
});

test('rejects task traversal, unapproved model defaults and malformed identifiers before writing', () => {
  const traversal = prepare('traversal', 'codex', 'auto', '../09-dialog-options');
  assert.equal(traversal.result.status, 1);
  assert.match(traversal.result.stderr, /Unsafe task/);
  assert.deepEqual(readdirSync(traversal.workspace), []);
  const bad = prepare('bad-model', 'opencode', 'auto', tasks[0], ['--model', 'implicit']);
  assert.equal(bad.result.status, 1);
  assert.deepEqual(readdirSync(bad.workspace), []);
  const missing = spawnSync(process.execPath, [runner, '--client', 'codex', '--activation', 'auto', '--task', tasks[0],
    '--workspace', root], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing --model/);
  const version = prepare('bad-version', 'codex', 'auto', tasks[0], ['--task-version', '../v2']);
  assert.equal(version.result.status, 1);
  assert.match(version.result.stderr, /Unknown task version/);
  assert.deepEqual(readdirSync(version.workspace), []);
  const absent = prepare('absent-v2', 'codex', 'auto', '01-active-record', ['--task-version', 'v2']);
  assert.equal(absent.result.status, 1);
  assert.deepEqual(readdirSync(absent.workspace), []);
});

test('rejects symlink workspaces and documentation escapes before copying anything', () => {
  mkdirSync(path.join(root, 'real-workspace'));
  symlinkSync(path.join(root, 'real-workspace'), path.join(root, 'linked-workspace'));
  const linked = prepare('linked-workspace');
  assert.equal(linked.result.status, 1);
  assert.match(linked.result.stderr, /real directory/);
  assert.deepEqual(readdirSync(path.join(root, 'real-workspace')), []);
  const page = path.join(docs, definitions.get(tasks[0]).docs[0]);
  const content = readFileSync(page);
  rmSync(page);
  symlinkSync(path.join(docs, 'not-selected.md'), page);
  const escaped = prepare('symlink-doc');
  assert.equal(escaped.result.status, 1);
  assert.match(escaped.result.stderr, /Symlink input/);
  assert.deepEqual(readdirSync(escaped.workspace), []);
  rmSync(page);
  writeFileSync(page, content);
});

test('Codex command explicitly uses subscription auth and medium only when requested; no API key is injected', () => {
  const { workspace, result } = prepare('codex-command', 'codex', 'explicit', tasks[0], ['--effort', 'medium']);
  assert.equal(result.status, 0, result.stderr);
  const meta = JSON.parse(readFileSync(path.join(workspace, '.eval-run/meta.json')));
  assert.equal(meta.effort, 'medium');
  for (const flag of ['--ignore-user-config', '--ignore-rules', '--ephemeral', '--json']) assert.ok(meta.argv.includes(flag));
  assert.ok(meta.argv.includes('forced_login_method="chatgpt"'));
  assert.ok(meta.argv.includes('model_reasoning_effort="medium"'));
  assert.doesNotMatch(JSON.stringify(meta.argv), /API_KEY|api_key|Bearer/);
  assert.deepEqual(meta.outputs, ['resources/views/site/_terms.php']);
  assert.equal(meta.execution.requires_external_workspace_isolation, true);
});

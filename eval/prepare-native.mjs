#!/usr/bin/env node
// Deterministic native-client preparation. This script never starts a client or contacts a provider.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(evalDir);
const options = {};
const accepted = new Set(['client', 'activation', 'task', 'task-version', 'workspace', 'model', 'effort', 'docs-source', 'skill-source']);
const usage = 'node eval/prepare-native.mjs --client claude|codex|opencode --activation explicit|auto --task <id> [--task-version v1|v2] --workspace <empty-directory> --model <approved-id> [--effort <level>] [--docs-source <dist>] [--skill-source <skills-root>]';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

function relative(value) {
  if (typeof value !== 'string' || value === '' || value.includes('\\') || path.isAbsolute(value)
      || value.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return value;
}

// Reject symlinks at every component: a copied input must not read outside its declared source tree.
function safeFile(root, name) {
  relative(name);
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink input is not supported: ${current}`);
  }
  if (!lstatSync(current).isFile()) throw new Error(`Expected a regular file: ${current}`);
  return current;
}

function tree(root, prefix = '') {
  const files = [];
  for (const entry of readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    relative(name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink input is not supported: ${path.join(root, name)}`);
    if (entry.isDirectory()) files.push(...tree(root, name));
    else files.push(safeFile(root, name));
  }
  return files;
}

function taskField(file, field) {
  const result = spawnSync('php', [path.join(evalDir, 'lib/task.php'), file, field], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot read task ${field}: ${result.stderr}`);
  return result.stdout;
}

try {
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index].replace(/^--/, '');
    if (!process.argv[index].startsWith('--') || !accepted.has(key) || options[key] !== undefined || !process.argv[index + 1]) {
      throw new Error(usage);
    }
    options[key] = process.argv[index + 1];
  }
  for (const key of ['client', 'activation', 'task', 'workspace', 'model']) {
    if (!options[key]) throw new Error(`Missing --${key}. ${usage}`);
  }
  if (!['claude', 'codex', 'opencode'].includes(options.client)) throw new Error('Unknown client');
  if (!['auto', 'explicit'].includes(options.activation)) throw new Error('Unknown activation condition');
  const taskVersion = options['task-version'] ?? 'v1';
  if (!['v1', 'v2'].includes(taskVersion)) throw new Error('Unknown task version; select v1 or v2');
  if (!/^[0-9]{2}-[a-z0-9-]+$/.test(options.task)) throw new Error('Unsafe task id');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/#-]*$/.test(options.model)) throw new Error('Invalid model identifier');
  if (options.client === 'opencode' && !options.model.includes('/')) throw new Error('OpenCode requires an explicit provider/model identifier');
  if (options.effort && !['low', 'medium', 'high', 'xhigh', 'max'].includes(options.effort)) throw new Error('Invalid effort');
  if (options.client === 'opencode' && options.effort) throw new Error('Use the approved OpenCode model#variant; a separate effort is not supported');

  const workspaceInput = path.resolve(options.workspace);
  if (lstatSync(workspaceInput).isSymbolicLink() || !lstatSync(workspaceInput).isDirectory()) throw new Error('Workspace must be a real directory');
  const workspace = realpathSync(workspaceInput);
  if (workspace !== workspaceInput) throw new Error('Workspace cannot have symlink ancestors');
  if (readdirSync(workspace).length !== 0) throw new Error('Workspace must be empty; refusing to overwrite inputs or outputs');
  if (workspace === repo || repo.startsWith(`${workspace}${path.sep}`)) throw new Error('Workspace must not contain the documentation checkout');
  const tasksDir = path.join(evalDir, 'tasks', taskVersion === 'v1' ? '' : taskVersion);
  const file = safeFile(tasksDir, `${options.task}.md`);
  const task = JSON.parse(taskField(file, '--json'));
  const body = taskField(file, '--body');
  if (!Array.isArray(task.docs) || task.docs.length === 0) throw new Error('Task must declare local docs');
  relative(task.skill);
  const docsSource = realpathSync(options['docs-source'] ?? path.join(repo, 'dist'));
  const candidates = options['skill-source'] ? [path.resolve(options['skill-source'])]
    : [path.join(repo, 'skills'), path.join(repo, '.cache/skills')];
  const source = candidates.find((directory) => existsSync(path.join(directory, task.skill, 'SKILL.md')));
  if (!source) throw new Error(`Missing skill ${task.skill}; run npm run sync:local or supply --skill-source`);
  const skillRoot = path.join(realpathSync(source), task.skill);
  safeFile(realpathSync(source), `${task.skill}/SKILL.md`);
  const skillFiles = tree(skillRoot);
  const docs = task.docs.map((name) => ({ name: relative(name), file: safeFile(docsSource, name) }));
  const fixtures = (task.workspace ?? []).flatMap((name) => {
    relative(name);
    const root = path.join(evalDir, 'workspace', name);
    return tree(root).map((file) => ({ file, name: path.relative(root, file).split(path.sep).join('/') }));
  });
  for (const output of task.outputs ?? []) {
    relative(output);
    if (output.startsWith('.') || output.startsWith('vendor/') || output.startsWith('node_modules/')) throw new Error(`Protected output path: ${output}`);
  }
  for (const fixture of fixtures) {
    if (!(task.outputs ?? []).includes(fixture.name)) throw new Error(`Workspace fixture outside output contract: ${fixture.name}`);
  }

  const clientFolder = { claude: '.claude', codex: '.agents', opencode: '.opencode' }[options.client];
  const skillDestination = `${clientFolder}/skills/${task.skill}`;
  mkdirSync(path.join(workspace, skillDestination), { recursive: true });
  cpSync(skillRoot, path.join(workspace, skillDestination), { recursive: true, dereference: false });
  const protectedInputs = [];
  for (const file of skillFiles) {
    const name = `${skillDestination}/${path.relative(skillRoot, file).split(path.sep).join('/')}`;
    protectedInputs.push({ path: name, sha256: hash(readFileSync(file)) });
  }
  let index = `# Local documentation for ${task.id}\n\nRead only the pages needed for this task. Copied from the generated site.\n\n`;
  for (const doc of docs) {
    const bytes = readFileSync(doc.file);
    const name = `.eval-docs/${doc.name}`;
    mkdirSync(path.dirname(path.join(workspace, name)), { recursive: true });
    writeFileSync(path.join(workspace, name), bytes, { flag: 'wx' });
    const sha256 = hash(bytes);
    protectedInputs.push({ path: name, sha256 });
    index += `- \`${doc.name}\` — ${bytes.length} bytes; SHA-256 \`${sha256}\`\n`;
  }
  writeFileSync(path.join(workspace, '.eval-docs/INDEX.md'), index, { flag: 'wx' });
  protectedInputs.push({ path: '.eval-docs/INDEX.md', sha256: hash(index) });
  for (const fixture of fixtures) {
    mkdirSync(path.dirname(path.join(workspace, fixture.name)), { recursive: true });
    writeFileSync(path.join(workspace, fixture.name), readFileSync(fixture.file), { flag: 'wx' });
  }

  const explicit = options.client === 'claude' ? `/${task.skill}`
    : options.client === 'codex' ? `$${task.skill}` : `Use the ${task.skill} skill through the native skill tool.`;
  const prompt = options.activation === 'explicit' ? `${explicit}\n\n${body}` : body;
  const metadataDir = path.join(workspace, '.eval-run');
  mkdirSync(metadataDir);
  writeFileSync(path.join(metadataDir, 'prompt.md'), prompt, { flag: 'wx' });
  // Reviewable argv templates, not an execution mechanism or isolation guarantee. No API credentials supplied.
  let argv;
  if (options.client === 'codex') {
    argv = ['codex', 'exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--json', '--skip-git-repo-check',
      '--sandbox', 'workspace-write', '--model', options.model, '-c', 'model_provider="openai"',
      '-c', 'forced_login_method="chatgpt"', '-c', 'shell_environment_policy.inherit="none"',
      '-c', 'shell_environment_policy.ignore_default_excludes=false', '-c', 'web_search="disabled"'];
    if (options.effort) argv.push('-c', `model_reasoning_effort="${options.effort}"`);
    argv.push('-');
  } else if (options.client === 'claude') {
    argv = ['claude', '-p', '--model', options.model, '--output-format', 'stream-json', '--verbose',
      '--no-session-persistence', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--tools', 'Read,Write,Edit,Glob,Grep,Skill', '--allowed-tools', 'Read,Write,Edit,Glob,Grep,Skill',
      '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--setting-sources', 'project'];
    if (options.effort) argv.push('--effort', options.effort);
  } else {
    argv = ['opencode', 'run', '--standalone', '--model', options.model, '--format', 'json',
      '--title', `${task.id}-${options.activation}`, '--file', '.eval-run/prompt.md', 'Complete the attached task.'];
  }
  const meta = {
    schema: 1, task: task.id, criterion: task.criterion ?? null, client: options.client, model: options.model,
    task_version: taskVersion, task_definition_sha256: hash(readFileSync(file)),
    effort: options.effort ?? null, activation: options.activation, workspace,
    docs_source: docsSource, skill_source: skillRoot, skill_destination: skillDestination,
    task_body_sha256: hash(body), prompt_sha256: hash(prompt), skill_sha256: hash(readFileSync(path.join(skillRoot, 'SKILL.md'))),
    docs: docs.map(({ name, file }) => ({ path: name, bytes: readFileSync(file).length, sha256: hash(readFileSync(file)) })),
    outputs: task.outputs, protected_inputs: protectedInputs, argv,
    stages: { preparation: 'passed', discovery: 'not-run', activation: 'not-run', selective_reading: 'not-run', functional: 'not-run' },
    execution: { model_identifier_supplied: true, model_called: false, provider_contacted: false,
      requires_external_workspace_isolation: true, requires_login_and_provider_review: true },
  };
  writeFileSync(path.join(metadataDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, { flag: 'wx' });
  const input = options.client === 'opencode' ? '' : ' < .eval-run/prompt.md';
  writeFileSync(path.join(metadataDir, 'command.txt'), `${argv.map(quote).join(' ')}${input}\n`, { flag: 'wx' });
  console.log(`Prepared ${task.id} for ${options.client}/${options.activation}: ${workspace}; no client or model called.`);
} catch (error) {
  writeSync(2, `${error.message}\n`);
  process.exitCode = 1;
}

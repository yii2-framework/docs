import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, describe, test } from 'node:test';

const outputRoot = mkdtempSync(path.join(tmpdir(), 'eval-run-'));
const runner = path.resolve('eval/run.sh');
const task = '03-active-record-migration';
const llms = path.join(outputRoot, 'llms.txt');
writeFileSync(llms, '# Yii 22.0 local evaluation index\n\nFixture pages use https://yii2-framework.github.io/docs/.\n');
const skills = path.join(outputRoot, 'skills');
for (const name of ['yii2-framework', 'yii2-bootstrap6-widgets']) {
  mkdirSync(path.join(skills, name), { recursive: true });
  writeFileSync(path.join(skills, name, 'SKILL.md'), `---\nname: ${name}\ndescription: Fixture only.\n---\n\nUse selected documentation.\n`);
}

after(() => rmSync(outputRoot, { recursive: true, force: true }));

function dryRun(stamp, extraArgs = [], selectedTask = task) {
  const result = spawnSync(
    'bash',
    [runner, '--task', selectedTask, '--docs-base', 'public', '--dry-run', ...extraArgs],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        EVAL_OUT_ROOT: outputRoot,
        EVAL_RUN_STAMP: stamp,
        EVAL_LLMS_SOURCE: llms,
        EVAL_SKILLS_DIR: skills,
      },
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const taskDir = path.join(outputRoot, stamp, selectedTask);

  return {
    command: readFileSync(path.join(taskDir, 'command.txt'), 'utf8'),
    meta: JSON.parse(readFileSync(path.join(taskDir, 'meta.json'), 'utf8')),
    prompt: readFileSync(path.join(taskDir, 'prompt.md'), 'utf8'),
  };
}

describe('evaluation runner conditions', () => {
  test('no-skill changes only the documented prompt material and condition metadata', () => {
    const skill = dryRun('skill');
    const baseline = dryRun('no-skill', ['--no-skill']);

    assert.equal(skill.command, baseline.command);
    assert.equal(skill.meta.condition, 'skill-injected');
    assert.equal(baseline.meta.condition, 'no-skill');
    assert.equal(skill.meta.dry_run, true);
    assert.equal(baseline.meta.dry_run, true);

    assert.match(skill.prompt, /attached: llms\.txt and the skill;/);
    assert.match(skill.prompt, /<skill name="yii2-framework">/);
    assert.match(skill.prompt, /<\/skill>/);

    assert.match(baseline.prompt, /attached: llms\.txt;/);
    assert.doesNotMatch(baseline.prompt, /attached: llms\.txt and the skill;/);
    assert.doesNotMatch(baseline.prompt, /<skill name=/);
    assert.doesNotMatch(baseline.prompt, /<\/skill>/);

    for (const prompt of [skill.prompt, baseline.prompt]) {
      assert.match(prompt, /<llms_txt source=/);
      assert.match(prompt, /# Task: ActiveRecord model and reversible migration/);
    }
  });

  test('records an optional criterion version in task metadata', () => {
    const versioned = dryRun('criterion', [], '10-toast-migration');

    assert.equal(versioned.meta.criterion, 'A2');
  });
});

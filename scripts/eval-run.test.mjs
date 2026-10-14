import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, describe, test } from 'node:test';

const outputRoot = mkdtempSync(path.join(tmpdir(), 'eval-run-'));
const runner = path.resolve('eval/run.sh');
const task = '03-active-record-migration';

after(() => rmSync(outputRoot, { recursive: true, force: true }));

function dryRun(stamp, extraArgs = []) {
  const result = spawnSync(
    'bash',
    [runner, '--task', task, '--docs-base', 'public', '--dry-run', ...extraArgs],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        EVAL_OUT_ROOT: outputRoot,
        EVAL_RUN_STAMP: stamp,
      },
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const taskDir = path.join(outputRoot, stamp, task);

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
});

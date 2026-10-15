import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { safeRelativeDirectory, syncSkills } from './sync-skills.mjs';
import { validateManifest } from './sync.mjs';

const work = mkdtempSync(path.join(tmpdir(), 'sync-skills-'));
after(() => rmSync(work, { recursive: true, force: true }));
const pkg = { name: 'demo', repo: 'https://github.com/example/demo', ref: 'main', skillsDir: 'skills' };

function fixture(id, text = '---\nname: demo-upload\ndescription: Handle a demo upload.\n---\n\nRead [the recipe](references/upload.md).\n') {
  const root = path.join(work, id);
  const folder = path.join(root, 'skills', 'demo-upload');
  mkdirSync(path.join(folder, 'references'), { recursive: true });
  writeFileSync(path.join(folder, 'SKILL.md'), text);
  writeFileSync(path.join(folder, 'references/upload.md'), '# Upload\n\nKeep this resource portable.\n');
  return { root, folder, text, options: { cacheDir: path.join(root, 'cache'), publicDir: path.join(root, 'public'), registry: {} } };
}

test('copies complete bundles unchanged and records package provenance and every file checksum', () => {
  const { root, folder, text, options } = fixture('portable');
  assert.deepEqual(syncSkills(pkg, root, { ...options, commit: 'abc123', source: 'local' }), ['demo-upload']);
  for (const out of [options.cacheDir, options.publicDir]) {
    assert.equal(readFileSync(path.join(out, 'demo-upload/SKILL.md'), 'utf8'), text);
    assert.equal(readFileSync(path.join(out, 'demo-upload/references/upload.md'), 'utf8'),
      readFileSync(path.join(folder, 'references/upload.md'), 'utf8'));
  }
  const entry = options.registry['demo-upload'];
  assert.equal(entry.package, 'demo');
  assert.equal(entry.path, 'skills/demo-upload');
  assert.equal(entry.commit, 'abc123');
  assert.equal(entry.files['SKILL.md'], createHash('sha256').update(text).digest('hex'));
  assert.deepEqual(Object.keys(entry.files), ['SKILL.md', 'references/upload.md']);
});

test('rejects duplicate skill identities rather than replacing another package bundle', () => {
  const { root, options } = fixture('duplicate');
  options.registry['demo-upload'] = { package: 'other' };
  assert.throws(() => syncSkills(pkg, root, options), /Duplicate generated skill/);
  assert.equal(options.registry['demo-upload'].package, 'other');
});

test('rejects missing metadata and a name that differs from its directory', () => {
  for (const [id, text] of [['missing', '# No frontmatter'], ['wrong', '---\nname: another\ndescription: Upload.\n---\n']]) {
    const { root, options } = fixture(id, text);
    assert.throws(() => syncSkills(pkg, root, options), /invalid name or description/);
  }
});

test('rejects linked resources instead of copying files outside the portable bundle', () => {
  const { root, folder, options } = fixture('linked');
  symlinkSync('/etc/hostname', path.join(folder, 'references/host'));
  assert.throws(() => syncSkills(pkg, root, options), /Skill resource is a symlink/);
});

test('validates relative skillsDir paths at manifest load', () => {
  const manifest = { ...pkg, title: 'Demo', docsDir: 'docs', srcDir: 'src', namespace: 'demo', localPath: '../demo', packagist: 'o/demo' };
  for (const value of ['/tmp/out', '../skills', 'skills/../elsewhere', 'skills\\elsewhere', '']) {
    assert.equal(safeRelativeDirectory(value), false);
    assert.throws(() => validateManifest([{ ...manifest, skillsDir: value }], 'packages.json'), /skillsDir/);
  }
  assert.equal(validateManifest([manifest], 'packages.json')[0].skillsDir, 'skills');
});

test('packages without skills remain supported and an explicitly missing source fails clearly', () => {
  const { root, options } = fixture('optional');
  assert.deepEqual(syncSkills({ ...pkg, skillsDir: undefined }, root, options), []);
  assert.throws(() => syncSkills({ ...pkg, skillsDir: 'absent' }, root, options), /missing absent/);
});

test('resync removes retired generated bundles and leaves editable package sources unchanged', () => {
  const { root, folder, text } = fixture('resync');
  const site = path.join(root, 'site');
  mkdirSync(path.join(site, 'scripts/lib'), { recursive: true });
  for (const file of ['sync.mjs', 'sync-skills.mjs', 'lib/description.mjs']) {
    copyFileSync(new URL(file, import.meta.url), path.join(site, 'scripts', file));
  }
  writeFileSync(path.join(root, 'README.md'), '# Demo\n\nA portable package.\n');
  writeFileSync(path.join(root, 'composer.json'), '{"name":"o/demo"}\n');
  mkdirSync(path.join(root, 'docs'));
  const entry = { ...pkg, title: 'Demo', docsDir: 'docs', srcDir: 'src', namespace: 'demo', localPath: '..', packagist: 'o/demo' };
  writeFileSync(path.join(site, 'packages.json'), JSON.stringify([entry]));
  const run = () => spawnSync(process.execPath, [path.join(site, 'scripts/sync.mjs'), '--local', '--strict'], { encoding: 'utf8' });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(folder, 'SKILL.md'), 'utf8'), text);
  const output = path.join(site, 'public/skills/demo-upload/SKILL.md');
  assert.equal(readFileSync(output, 'utf8'), text);
  rmSync(folder, { recursive: true });
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(output), false);
  assert.equal(existsSync(path.join(site, '.cache/skills/demo-upload')), false);
  assert.deepEqual(JSON.parse(readFileSync(path.join(site, 'public/skills/index.json'), 'utf8')).skills, {});
  assert.equal(readFileSync(path.join(root, 'README.md'), 'utf8'), '# Demo\n\nA portable package.\n');
});

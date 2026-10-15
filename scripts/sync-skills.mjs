// Extension skills are authored in their package, copied unchanged during sync, and never maintained here.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function safeRelativeDirectory(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value)
    && !value.includes('\\') && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function skillFiles(directory, base = directory) {
  return readdirSync(directory).sort().flatMap((name) => {
    const file = path.join(directory, name);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Skill resource is a symlink: ${file}`);
    if (stat.isDirectory()) return skillFiles(file, base);
    if (!stat.isFile()) throw new Error(`Unsupported skill resource: ${file}`);
    return [path.relative(base, file).split(path.sep).join('/')];
  });
}

/** Copies a complete portable skill folder, recording checksums separately so SKILL.md stays byte-identical. */
export function syncSkills(pkg, checkout, { cacheDir, publicDir, registry, commit = null, source = 'local' }) {
  if (pkg.skillsDir === undefined) return [];
  if (!safeRelativeDirectory(pkg.skillsDir)) throw new Error(`Invalid skillsDir for ${pkg.name}`);
  const directory = path.join(checkout, pkg.skillsDir);
  if (!existsSync(directory)) throw new Error(`${pkg.name}: missing ${pkg.skillsDir}; sync the package skills first.`);
  const copied = [];

  for (const folder of readdirSync(directory).sort()) {
    const skill = path.join(directory, folder);
    if (!lstatSync(skill).isDirectory() || !existsSync(path.join(skill, 'SKILL.md'))) continue;
    const text = readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
    const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1] ?? '';
    const scalar = (key) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(header)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    const name = scalar('name');
    if (!name || name !== folder || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !scalar('description')) {
      throw new Error(`${pkg.name}: invalid name or description in ${pkg.skillsDir}/${folder}/SKILL.md`);
    }
    if (Object.hasOwn(registry, name)) throw new Error(`Duplicate generated skill: ${name}`);
    const files = skillFiles(skill);
    const hashes = {};
    for (const file of files) {
      const original = path.join(skill, file);
      hashes[file] = createHash('sha256').update(readFileSync(original)).digest('hex');
      for (const output of [cacheDir, publicDir]) {
        const target = path.join(output, name, file);
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(original, target);
      }
    }
    registry[name] = { package: pkg.name, repo: pkg.repo, ref: pkg.ref, commit, source: source.startsWith('local') ? 'local' : 'clone',
      path: `${pkg.skillsDir}/${folder}`, files: hashes };
    copied.push(name);
  }
  return copied;
}

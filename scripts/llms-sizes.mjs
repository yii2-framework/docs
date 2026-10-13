#!/usr/bin/env node
// Post-build step for the llms files (run by `npm run build` through `postbuild`; exits 1 on a failed gate). Running
// it again leaves the files unchanged.
//
// 1. `llms-full.txt` and `llms-small.txt`: the first line says they are for indexing tools, with their size.
// 2. `llms.txt`: every list entry that links a file of the site gets ` (~Nk tokens)` (file size / 4) and every name
//    of a `- Bundles <topic>: <name>, <name>` line (API reference) gets ` ~Nk`; the "Documentation Sets" section
//    keeps only the files not listed above (`llms-full.txt`, `llms-small.txt`, labelled for indexing tools); the
//    generic "Notes" section of starlight-llms-txt is dropped.
// 3. Gates: every linked file exists; every `_llms-txt/*.txt` bundle is linked from `llms.txt`; no bundle of more
//    than one page is larger than the bundle limit (plugins/llms-sets.mjs).
//
// Usage: node scripts/llms-sizes.mjs [--dist=dist]

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUNDLE_LIMIT } from '../plugins/llms-sets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'https://yii2-framework.github.io';
const BASE = '/docs/';
const SUFFIX = / \(~[0-9.]+k tokens\)$/;
const LINK = /\]\(([^)\s]+)\)/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const INDEXING = '. For indexing tools';
const COMPACT = /^(- Bundles [^:]+: )(.+)$/;

/**
 * Formats a size in bytes as an approximate token count (4 bytes per token) with two significant digits (three from
 * 100k): `0.025k`, `0.45k`, `2.3k`, `23k`, `375k`.
 *
 * @param {number} bytes
 */
export function formatTokens(bytes) {
  const thousands = bytes / 4 / 1000;

  if (thousands >= 10) {
    return `${Math.round(thousands)}k`;
  }

  return `${Number(thousands.toPrecision(2))}k`;
}

/**
 * Returns the path inside `dist/` of a link to the site (`https://yii2-framework.github.io/docs/x` or `/docs/x`), or
 * `null` for other links.
 *
 * @param {string} href
 */
export function distPath(href) {
  const pathname = href.startsWith(`${SITE}/`) ? href.slice(SITE.length) : href;

  if (!pathname.startsWith(BASE)) {
    return null;
  }

  return decodeURIComponent(pathname.slice(BASE.length).split('#')[0]);
}

/** Returns the text without the H2 section `title` (up to the next H2). */
function dropSection(text, title) {
  return text.replace(new RegExp(`(^|\\n)## ${title}\\n[\\s\\S]*?(?=\\n## |$)`), '$1').replace(/\n+$/, '\n');
}

/**
 * Annotates `llms.txt`: size suffixes, a "Documentation Sets" section without the files listed above, the full
 * bundles labelled for indexing tools, no "Notes" section.
 *
 * @param {string} text Contents of `llms.txt`.
 * @param {(file: string) => number | null} sizeOf Size in bytes of a file of `dist/`, or `null` when it is missing.
 * @param {{ fullHasReference?: boolean }} [options]
 * @returns {{ text: string, missing: string[], linked: Set<string> }}
 */
export function annotateIndex(text, sizeOf, { fullHasReference = false } = {}) {
  const missing = [];
  const linked = new Set();
  const seen = new Set();
  const output = [];
  let section = '';
  const full = fullHasReference ? 'every English page, the API reference included'
    : 'every English page except the API reference';
  const labels = {
    'llms-full.txt': `for indexing tools (Cursor, Context7 and similar); do not read it whole: ${full}`,
    'llms-small.txt': 'for indexing tools; do not read it whole: the guides without notes and tips, no API reference',
  };

  for (const line of dropSection(text, 'Notes').split('\n')) {
    if (line.startsWith('## ')) {
      section = line.slice(3);
    }

    const compact = COMPACT.exec(line);

    if (compact) {
      // `- Bundles yii\db: api-yii2-db, api-yii2-db-activerecord`: bundle names, each followed by its size.
      const items = compact[2].split(', ').map((item) => {
        const name = item.replace(/ ~[0-9.]+k$/, '');
        const file = `_llms-txt/${name}.txt`;
        const size = sizeOf(file);

        seen.add(file);
        linked.add(file);

        if (size === null) {
          missing.push(file);
          return name;
        }

        return `${name} ~${formatTokens(size)}`;
      });

      output.push(`${compact[1]}${items.join(', ')}`);
      continue;
    }

    const href = line.startsWith('- ') ? LINK.exec(line)?.[1] : undefined;
    const file = href === undefined ? null : distPath(href);

    if (file === null) {
      output.push(line);
      continue;
    }

    if (section === 'Documentation Sets' && seen.has(file)) {
      continue;
    }

    seen.add(file);
    linked.add(file);

    let entry = line.replace(SUFFIX, '');

    if (section === 'Documentation Sets' && labels[file] !== undefined) {
      entry = `${entry.slice(0, entry.indexOf(')') + 1)}: ${labels[file]}`;
    }

    const size = sizeOf(file);

    if (size === null) {
      missing.push(file);
      output.push(entry);
      continue;
    }

    output.push(`${entry} (~${formatTokens(size)} tokens)`);
  }

  return { text: output.join('\n'), missing, linked };
}

/**
 * Labels the first line (`<SYSTEM>...</SYSTEM>`) of `llms-full.txt` or `llms-small.txt` for indexing tools, with the
 * size of the rest of the file.
 *
 * @param {string} text
 * @returns {string}
 */
export function labelFullBundle(text) {
  const newline = text.indexOf('\n');
  const first = newline === -1 ? text : text.slice(0, newline);
  const match = /^<SYSTEM>(.*)<\/SYSTEM>$/.exec(first);

  if (!match) {
    return text;
  }

  const rest = newline === -1 ? '' : text.slice(newline);
  const sentence = match[1].split(INDEXING)[0].replace(/\.$/, '');
  const label = `${sentence}${INDEXING} (Cursor, Context7 and similar), about ${formatTokens(Buffer.byteLength(rest))} `
    + `tokens: do not read it whole. Agents: start at ${SITE}${BASE}llms.txt and fetch single pages or topic bundles.`;

  return `<SYSTEM>${label}</SYSTEM>${rest}`;
}

/**
 * Counts the pages of a starlight-llms-txt bundle: `# Title` lines followed by a `> Description` line, outside code.
 *
 * @param {string} text
 */
export function countPages(text) {
  const lines = text.split('\n');
  let fence = null;
  let pages = 0;

  for (let index = 0; index < lines.length; index++) {
    const match = FENCE.exec(lines[index]);

    if (fence !== null) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }

    if (match) {
      fence = match[1];
      continue;
    }

    if (/^# /.test(lines[index]) && lines[index + 1] === '' && /^> /.test(lines[index + 2] ?? '')) {
      pages++;
    }
  }

  return pages;
}

/** Runs the step on `dist/`; returns the error messages. */
export function run(dist) {
  const errors = [];
  const read = (name) => readFileSync(path.join(dist, name), 'utf8');
  const write = (name, text) => {
    if (read(name) !== text) {
      writeFileSync(path.join(dist, name), text);
    }
  };

  for (const name of ['llms-full.txt', 'llms-small.txt']) {
    write(name, labelFullBundle(read(name)));
  }

  const sizeOf = (file) => {
    const target = path.join(dist, file);

    return existsSync(target) && statSync(target).isFile() ? statSync(target).size : null;
  };
  const before = read('llms.txt');
  const { text, missing, linked } = annotateIndex(before, sizeOf, {
    fullHasReference: /\n# API reference\n\n> /.test(read('llms-full.txt')),
  });

  write('llms.txt', text);
  errors.push(...missing.map((file) => `llms.txt links a missing file: ${file}`));

  const bundles = readdirSync(path.join(dist, '_llms-txt')).filter((name) => name.endsWith('.txt')).sort();
  const sizes = [];

  for (const name of bundles) {
    const file = `_llms-txt/${name}`;
    const bundle = read(file);
    const bytes = Buffer.byteLength(bundle);
    const pages = countPages(bundle);

    sizes.push([name, bytes, pages]);

    if (!linked.has(file)) {
      errors.push(`${file} is not listed in llms.txt.`);
    }

    if (bytes > BUNDLE_LIMIT && pages > 1) {
      errors.push(`${file}: ${bytes} bytes in ${pages} pages, above the ${BUNDLE_LIMIT}-byte bundle limit (adjust `
        + 'the size estimate in plugins/llms-sets.mjs).');
    }
  }

  const largest = sizes.reduce((max, entry) => (entry[1] > max[1] ? entry : max), ['', 0, 0]);
  const index = Buffer.byteLength(text);

  console.log(`[llms-sizes] llms.txt: ${index} bytes (~${formatTokens(index)} tokens), ${text.split('\n').length - 1} `
    + `lines; ${bundles.length} bundles, largest ${largest[0]} ${largest[1]} bytes (~${formatTokens(largest[1])} `
    + `tokens, ${largest[2]} pages); llms-full.txt ~${formatTokens(sizeOf('llms-full.txt'))}, llms-small.txt `
    + `~${formatTokens(sizeOf('llms-small.txt'))} tokens.`);

  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dist = path.resolve(ROOT, process.argv.find((arg) => arg.startsWith('--dist='))?.slice(7) ?? 'dist');
  const errors = run(dist);

  for (const error of errors) {
    console.error(`[llms-sizes] ${error}`);
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

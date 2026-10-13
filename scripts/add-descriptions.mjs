#!/usr/bin/env node
// Adds a `description` frontmatter field to every Markdown page under `src/content/docs` that lacks one.
//
// The description is the first prose paragraph of the page (after the frontmatter and the H1, skipping headings,
// blockquotes, code fences, tables, images, HTML comments, Starlight asides and list blocks), stripped of Markdown,
// collapsed to one line and truncated to at most 160 characters at a sentence or word boundary. The field is inserted
// right after `title:` as a double-quoted YAML string. Running the script twice changes nothing.
//
// Usage: node scripts/add-descriptions.mjs [--dry-run] [--check] [paths...]
//   --dry-run  print `path<TAB>description` for the files that would change; write nothing.
//   --check    write nothing; exit with status 1 when a page has no `description`.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAX_LENGTH = 160;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTENT_DIR = join(ROOT, 'src', 'content', 'docs');

// Paragraphs that are not a summary of the page: license notices, copyright lines, admonition labels.
const SKIP_PARAGRAPH = [
  /yiiframework\.com\/doc\/terms/i,
  /^all rights reserved\.?$/i,
  /\(c\)/i,
  /^(note|tip|info|warning|important|caution)\s*:/i,
];
// Pages whose paragraphs do not summarize them (lists, placeholders, a glossary), keyed by slug without the locale.
// Translations get the same English text: their titles are not usable either (the glossary ones are "A").
const OVERRIDES = {
  'guide/index': 'Table of contents of the guide: getting started, application structure, requests, key concepts, '
    + 'databases, forms, output, security, caching, REST and testing.',
  'guide/glossary': 'Definitions of Yii terms used in the guide, such as alias, application, asset bundle, '
    + 'extension, module, namespace and vendor.',
  'internals/translation-teams': 'Members of the teams that translate the Yii documentation, grouped by language.',
  'project/configuration': 'Configuration reference for the documentation project (template page).',
  'project/examples': 'Usage examples for the documentation project (template page).',
  'project/installation': 'System requirements and Composer installation steps for the project (template page).',
};
const LOCALES = /^(ar|de|es|fa|fr|id|it|ja|pl|pt-br|ru|sr-latn|tr|uk|uz|vi|zh-cn)\//;
const ABBREVIATIONS = /\b(e\.g|i\.e|etc|vs|cf|approx|incl|no)\.$/i;

/**
 * Splits a Markdown file into frontmatter lines and body lines.
 */
function splitFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);

  if (!match) {
    return null;
  }

  return { frontmatter: match[1], body: source.slice(match[0].length), raw: match[0] };
}

/**
 * Returns the prose paragraphs of the body, split into those before the first H2 (`intro`) and the rest (`later`).
 */
export function candidateParagraphs(body) {
  const lines = body.split(/\r?\n/);
  const intro = [];
  const later = [];
  let current = [];
  let seenH2 = false;
  let fence = null;
  let inAside = false;
  let inComment = false;
  let inHtmlParagraph = false;

  const flush = () => {
    if (current.length > 0) {
      (seenH2 ? later : intro).push(current.join(' '));
      current = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (fence !== null) {
      if (trimmed.startsWith(fence)) {
        fence = null;
      }
      continue;
    }

    if (inComment) {
      if (trimmed.includes('-->')) {
        inComment = false;
      }
      continue;
    }

    if (inAside) {
      if (trimmed === ':::') {
        inAside = false;
      }
      continue;
    }

    if (inHtmlParagraph) {
      if (/<\/p>\s*$/i.test(trimmed)) {
        current.push(trimmed.replace(/<\/p>\s*$/i, ''));
        inHtmlParagraph = false;
        flush();
      } else {
        current.push(trimmed);
      }
      continue;
    }

    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);

    if (fenceMatch) {
      flush();
      fence = fenceMatch[1];
      continue;
    }

    if (trimmed.startsWith('<!--')) {
      flush();
      inComment = !trimmed.includes('-->');
      continue;
    }

    if (trimmed.startsWith(':::')) {
      flush();
      inAside = true;
      continue;
    }

    if (trimmed === '') {
      flush();
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      flush();
      if (/^#{2,6}\s/.test(trimmed)) {
        seenH2 = true;
      }
      continue;
    }

    // HTML paragraphs (`<p dir="rtl">` in the Arabic pages) count as prose; other HTML blocks are skipped.
    if (/^<p\b[^>]*>/i.test(trimmed)) {
      flush();
      const inner = trimmed.replace(/^<p\b[^>]*>/i, '');

      if (/<\/p>\s*$/i.test(inner)) {
        current.push(inner.replace(/<\/p>\s*$/i, ''));
        flush();
      } else {
        if (inner !== '') {
          current.push(inner);
        }
        inHtmlParagraph = true;
      }
      continue;
    }

    const startsBlock = /^(>|\||<|!\[|[-*+]\s|\d+[.)]\s|={3,}|-{3,}|\[[^\]]+\]:\s)/.test(trimmed) || /^( {4}|\t)/.test(line);

    if (startsBlock && current.length === 0) {
      continue;
    }

    if (startsBlock) {
      flush();
      continue;
    }

    current.push(trimmed);
  }

  flush();

  return { intro, later };
}

/**
 * Converts inline Markdown to plain text.
 */
export function stripMarkdown(text) {
  const code = [];
  let out = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_all, _ticks, inner) => {
    code.push(inner.trim());

    return `\u0000${code.length - 1}\u0000`;
  });

  // `[[yii\base\Component|label]]` keeps the label; `[[yii\base\Component::on()]]` keeps `Component::on()`.
  out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_all, ref) => ref.trim().replace(/^.*\\/, ''));
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  out = out.replace(/<(https?:[^>\s]+)>/g, '$1');
  out = out.replace(/<\/?[a-z][^>]*>/gi, '');
  out = out.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2');
  out = out.replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1$2');
  out = out.replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1$2');
  out = out.replace(/~~(.*?)~~/g, '$1');
  out = out.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  out = out.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1');
  out = out.replace(/\u0000(\d+)\u0000/g, (_all, index) => code[Number(index)]);

  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Returns the string offsets just after each sentence end: `.!?` followed by a space (not after an abbreviation such
 * as `e.g.`), or a CJK full stop.
 */
function sentenceEnds(text) {
  const ends = [];

  for (const match of text.matchAll(/[.!?](?=\s)|[\u3002\uff01\uff1f]/g)) {
    const end = match.index + match[0].length;

    if (!ABBREVIATIONS.test(text.slice(0, end))) {
      ends.push(end);
    }
  }

  return ends;
}

/**
 * Truncates text to at most `MAX_LENGTH` characters: whole sentences when possible, otherwise at a word boundary
 * with a trailing ellipsis.
 */
export function truncate(text) {
  const chars = [...text];

  if (chars.length <= MAX_LENGTH) {
    return text;
  }

  let best = '';

  for (const end of sentenceEnds(text)) {
    const candidate = text.slice(0, end);

    if ([...candidate].length > MAX_LENGTH) {
      break;
    }

    best = candidate;
  }

  if ([...best].length >= 40) {
    return best;
  }

  const limit = chars.slice(0, MAX_LENGTH - 3).join('');
  const space = limit.lastIndexOf(' ');
  const cut = space >= 40 ? limit.slice(0, space) : limit;

  return `${cut.replace(/[\s,;:(\-]+$/, '')}...`;
}

/**
 * Returns the description for a page body, or `null` when the body has no usable paragraph.
 *
 * Paragraphs before the first H2 are preferred. A paragraph that ends with a colon (it introduces a list or a code
 * block) loses its last sentence when it has more than one, otherwise the colon becomes a full stop.
 */
export function describe(body) {
  const { intro, later } = candidateParagraphs(body);

  for (const paragraph of [...intro, ...later]) {
    let text = stripMarkdown(paragraph);

    // Very short paragraphs ("All Rights Reserved.") are skipped; CJK text is denser, so its floor is lower.
    const minLength = /[\u3040-\u9fff]/.test(text) ? 8 : 20;

    if ([...text].length < minLength || SKIP_PARAGRAPH.some((pattern) => pattern.test(text) || pattern.test(paragraph))) {
      continue;
    }

    if (/[:\uff1a]$/.test(text)) {
      const ends = sentenceEnds(text);

      text = ends.length > 0
        ? text.slice(0, ends.at(-1)).trim()
        : text.replace(/\s*[:\uff1a]$/, /[\u3000-\u9fff\uff00-\uffef]/.test(text) ? '\u3002' : '.');
    }

    return truncate(text);
  }

  return null;
}

/**
 * Returns the description of a content file, given its path relative to `src/content/docs`.
 */
export function describeFile(relativePath, body) {
  const slug = relativePath.replace(/\.md$/, '');
  const locale = LOCALES.exec(slug);
  const key = locale ? slug.slice(locale[0].length) : slug;

  if (key in OVERRIDES) {
    return OVERRIDES[key];
  }

  return describe(body);
}

/**
 * Quotes a string as a double-quoted YAML scalar.
 */
export function yamlQuote(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f\u007f]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);

  return `"${escaped}"`;
}

function listMarkdownFiles(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      files.push(...listMarkdownFiles(path));
    } else if (entry.endsWith('.md')) {
      files.push(path);
    }
  }

  return files.sort();
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const check = argv.includes('--check');
  const paths = argv.filter((arg) => !arg.startsWith('--'));
  const files = paths.length > 0 ? paths.map((path) => join(process.cwd(), path)) : listMarkdownFiles(CONTENT_DIR);
  let changed = 0;
  let missing = 0;
  const failures = [];

  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    const parts = splitFrontmatter(source);

    if (parts === null) {
      failures.push(`${rel}: no frontmatter`);
      continue;
    }

    if (/^description\s*:/m.test(parts.frontmatter)) {
      continue;
    }

    missing++;

    if (check) {
      failures.push(`${rel}: no description`);
      continue;
    }

    const description = describeFile(relative(CONTENT_DIR, file).split(sep).join('/'), parts.body);

    if (description === null) {
      failures.push(`${rel}: no paragraph usable as description`);
      continue;
    }

    const lines = parts.frontmatter.split(/\r?\n/);
    const titleIndex = lines.findIndex((line) => /^title\s*:/.test(line));

    if (titleIndex === -1) {
      failures.push(`${rel}: no title`);
      continue;
    }

    // Insert after the title, including any indented continuation lines of a multi-line title.
    let insertAt = titleIndex + 1;

    while (insertAt < lines.length && /^\s+\S/.test(lines[insertAt])) {
      insertAt++;
    }

    lines.splice(insertAt, 0, `description: ${yamlQuote(description)}`);
    changed++;

    if (dryRun) {
      process.stdout.write(`${rel}\t${description}\n`);
      continue;
    }

    writeFileSync(file, `---\n${lines.join('\n')}\n---\n${parts.body}`);
  }

  for (const failure of failures) {
    process.stderr.write(`${failure}\n`);
  }

  process.stderr.write(
    `${files.length} files, ${missing} without description, ${changed} ${dryRun ? 'would change' : 'changed'}` +
      `${check ? '' : `, ${failures.length} failed`}.\n`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}

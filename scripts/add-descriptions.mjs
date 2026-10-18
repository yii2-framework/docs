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
import { describe, splitFrontmatter, yamlQuote } from './lib/description.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTENT_DIR = join(ROOT, 'src', 'content', 'docs');

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

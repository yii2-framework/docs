import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dropContentCache } from './content-cache.mjs';

// Paths from the project root (the working directory of `astro build` and `astro dev`): this module is also bundled
// into the Markdown endpoint (plugins/llm-render-markdown.mjs), where `import.meta.url` points into `dist/`.
const ROOT = process.cwd();
const LINKS_FILE = path.join(ROOT, '.cache', 'reference', 'links.json');
const LINKS_DIGEST = path.join(ROOT, '.cache', 'reference', 'links.rendered.sha256');

/** Matches `[[target]]` and `[[target|title]]` as written in the guide (apidoc syntax). */
export const API_LINK = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g;

let cache;

/**
 * Replaces the link map (tests).
 *
 * @param {{ base: string, types: object }} map
 */
export function setLinkMap(map) {
  cache = map;
}

/**
 * Returns the link map written by `tools/bin/reference` (`.cache/reference/links.json`), or an empty map with a
 * one-time warning when the reference has not been generated (then every `[[...]]` becomes plain code).
 *
 * @returns {{ base: string, types: Record<string, { slug: string, extends?: string, traits?: string[],
 *   implements?: string[], members: Record<string, string> }> }}
 */
export function linkMap() {
  if (cache === undefined) {
    if (existsSync(LINKS_FILE)) {
      cache = JSON.parse(readFileSync(LINKS_FILE, 'utf8'));
    } else {
      console.warn('[yii-links] .cache/reference/links.json not found (run tools/bin/reference); [[...]] API links '
        + 'are rendered as plain code.');
      cache = { base: '/docs/', types: {} };
    }
  }

  return cache;
}

/**
 * Returns the types to search for an inherited member, in the order PHP resolves implementations: the type, its
 * traits, then each parent class with its traits; the interfaces of all of them come last (they only declare).
 *
 * @returns {string[]}
 */
function lookupOrder(map, type) {
  const classes = [];
  const interfaces = [];
  const seen = new Set();
  const addTraits = (name) => {
    for (const trait of map.types[name]?.traits ?? []) {
      if (!seen.has(trait)) {
        seen.add(trait);
        classes.push(trait);
        addTraits(trait);
      }
    }
  };
  const addInterfaces = (name) => {
    for (const parent of map.types[name]?.implements ?? []) {
      if (!seen.has(parent)) {
        seen.add(parent);
        interfaces.push(parent);
        addInterfaces(parent);
      }
    }
  };

  for (let current = type; current && !seen.has(current); current = map.types[current]?.extends) {
    seen.add(current);
    classes.push(current);
    addTraits(current);
  }

  for (const name of [...classes]) {
    addInterfaces(name);
  }

  return [...classes, ...interfaces];
}

/**
 * Finds the type that declares `member` in `type` or its traits, parents and interfaces: `name()` is a method,
 * `$name` a property; a bare `name` is tried as a method, a property, then a constant, event or enum case.
 *
 * @returns {{ type: string, anchor: string } | null}
 */
function findMember(map, type, member) {
  const keys = member.endsWith('()') || member.startsWith('$') ? [member] : [`${member}()`, `$${member}`, member];
  const order = lookupOrder(map, type);

  for (const key of keys) {
    for (const name of order) {
      const anchor = map.types[name]?.members?.[key];

      if (anchor) {
        return { type: name, anchor };
      }
    }
  }

  return null;
}

/**
 * Resolves an API reference target of the guide (`yii\base\Widget`, `yii\base\Widget::widget()`, `Yii::$app`,
 * `yii\base\Widget::$id`) to the generated reference page.
 *
 * @param {string} target The text between `[[` and `]]` (or before `|`).
 * @param {{ markdown?: boolean }} [options] `markdown: true` returns the Markdown URL (`.../index.md#anchor`).
 * @returns {{ url: string, label: string } | null} `null` when the target is not a documented type or member.
 */
export function resolveApiLink(target, options = {}) {
  const map = linkMap();
  const clean = target.trim().replace(/^\\/, '');
  const separator = clean.indexOf('::');
  const typeName = separator === -1 ? clean : clean.slice(0, separator);
  const member = separator === -1 ? '' : clean.slice(separator + 2);
  const type = map.types[typeName];

  if (!type || (separator !== -1 && member === '')) {
    return null;
  }

  const shortName = typeName.slice(typeName.lastIndexOf('\\') + 1);
  const page = (slug) => `${map.base}${slug}/${options.markdown ? 'index.md' : ''}`;

  if (member === '') {
    return { url: page(type.slug), label: shortName };
  }

  const found = findMember(map, typeName, member);

  if (!found) {
    return null;
  }

  return { url: `${page(map.types[found.type].slug)}#${found.anchor}`, label: `${shortName}::${member}` };
}

/**
 * Drops Astro's content cache when the link map changed since the last build.
 *
 * The content layer reuses the rendered HTML of unchanged pages, so a regenerated reference (new or moved anchors)
 * would not reach the guide pages. Called from `astro.config.mjs` before the content is loaded.
 */
export function invalidateContentCacheOnLinkChange() {
  const digest = existsSync(LINKS_FILE) ? createHash('sha256').update(readFileSync(LINKS_FILE)).digest('hex') : 'none';
  const previous = existsSync(LINKS_DIGEST) ? readFileSync(LINKS_DIGEST, 'utf8').trim() : null;

  if (previous !== digest) {
    dropContentCache(ROOT);

    if (existsSync(LINKS_FILE)) {
      writeFileSync(LINKS_DIGEST, `${digest}\n`);
    }
  }
}

/** Collects unresolved targets for the build report. */
export const unresolvedLinks = new Map();

/**
 * Records an unresolved target.
 *
 * @param {string} target
 */
export function recordUnresolved(target) {
  unresolvedLinks.set(target, (unresolvedLinks.get(target) ?? 0) + 1);
}

/**
 * Rewrites the `[[...]]` references of one Markdown prose line (inline code spans are kept) to Markdown links to the
 * reference Markdown URLs; unknown targets become inline code (or their title).
 *
 * @param {string} line
 */
export function rewriteApiLinksInLine(line) {
  if (!line.includes('[[')) {
    return line;
  }

  return line.split(/(`+[^`]*?`+)/).map((part, index) => (index % 2 === 1 ? part : part.replace(
    API_LINK,
    (all, target, title) => {
      const resolved = resolveApiLink(target, { markdown: true });
      const text = title?.trim();

      if (!resolved) {
        return text || `\`${target.trim()}\``;
      }

      return `[${text || `\`${resolved.label}\``}](${resolved.url})`;
    },
  ))).join('');
}

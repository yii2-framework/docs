#!/usr/bin/env node
// Post-build checks of `dist/` (run by `npm run build` through `postbuild`; exits 1 on a failed gate):
//
// 1. API references: no literal `[[` outside code in the English guide (every `[[yii\...]]` reference must have been
//    turned into a link or an `api-unresolved` span by plugins/remark-yii-links.mjs). The `[[` left in translations
//    and the unresolved targets (top 20) are reported, not gated.
// 2. Links of the generated API reference (`api/`, `extensions/<package>/reference/`): every internal `href`/`src`
//    must point to a built file and every fragment to an `id` on the target page.
//
// Usage: node scripts/check-site.mjs [--dist=dist] [--links=<prefix>,<prefix>...]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASE = '/docs/';
// A start or end tag; quoted attribute values may contain `>` (expressive-code `data-code`).
const TAG = /<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g;
const LOCALES = ['ar', 'de', 'es', 'fa', 'fr', 'id', 'it', 'ja', 'pl', 'pt-br', 'ru', 'sr-latn', 'tr', 'uk', 'uz', 'vi',
  'zh-cn'];

/** Lists the HTML files under `dir`, as POSIX paths relative to `dir`. */
export function htmlFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);

    if (statSync(file).isDirectory()) {
      return htmlFiles(file, base);
    }

    return name.endsWith('.html') ? [path.relative(base, file).split(path.sep).join('/')] : [];
  });
}

/** Decodes the HTML entities used in attributes. */
function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Returns the text of the page content (`<main>`) without `<pre>`, `<code>`, `<script>` and `<style>` elements.
 *
 * @param {string} html
 */
export function proseText(html) {
  const main = /<main\b[\s\S]*<\/main>/i.exec(html)?.[0] ?? html;

  return main.replace(/<(pre|code|script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(TAG, ' ');
}

/**
 * Counts literal `[[` in prose and the `api-unresolved` spans of the given pages.
 *
 * @returns {{ literal: number, pages: string[], unresolved: Map<string, number> }}
 */
export function apiLinkStats(dist, files) {
  let literal = 0;
  const pages = [];
  const unresolved = new Map();

  for (const file of files) {
    const html = readFileSync(path.join(dist, file), 'utf8');
    const count = (proseText(html).match(/\[\[/g) ?? []).length;

    if (count > 0) {
      literal += count;
      pages.push(`${file} (${count})`);
    }

    for (const match of html.matchAll(/class="api-unresolved" data-target="([^"]*)"/g)) {
      const target = decode(match[1]);
      unresolved.set(target, (unresolved.get(target) ?? 0) + 1);
    }
  }

  return { literal, pages, unresolved };
}

/**
 * Checks the internal links of the pages: target file and fragment.
 *
 * @returns {{ checked: number, broken: string[] }}
 */
export function checkLinks(dist, files) {
  const ids = new Map();
  const idsOf = (file) => {
    if (!ids.has(file)) {
      const html = readFileSync(file, 'utf8');
      ids.set(file, new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((match) => decode(match[1]))));
    }

    return ids.get(file);
  };
  let checked = 0;
  const broken = [];

  for (const file of files) {
    const html = readFileSync(path.join(dist, file), 'utf8');
    const pageUrl = `${BASE}${file.replace(/index\.html$/, '').replace(/\.html$/, '/')}`;
    const attributes = [...html.matchAll(TAG)]
      .flatMap((tag) => [...tag[0].matchAll(/\s(?:href|src)="([^"]*)"/g)]);

    for (const [, raw] of attributes) {
      const href = decode(raw);

      if (href === '' || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
        continue;
      }

      checked++;
      const url = new URL(href, `http://site${pageUrl}`);
      const pathname = decodeURIComponent(url.pathname);

      if (!pathname.startsWith(BASE)) {
        broken.push(`${file}: ${href} (outside ${BASE})`);
        continue;
      }

      let target = path.join(dist, pathname.slice(BASE.length));

      if (pathname.endsWith('/')) {
        target = path.join(target, 'index.html');
      } else if (!existsSync(target) && existsSync(path.join(target, 'index.html'))) {
        target = path.join(target, 'index.html');
      }

      if (!existsSync(target)) {
        broken.push(`${file}: ${href} (missing)`);
        continue;
      }

      const fragment = decodeURIComponent(url.hash.slice(1));

      if (fragment !== '' && target.endsWith('.html') && !idsOf(target).has(fragment)) {
        broken.push(`${file}: ${href} (no id "${fragment}")`);
      }
    }
  }

  return { checked, broken };
}

function main(argv) {
  const dist = path.resolve(ROOT, argv.find((arg) => arg.startsWith('--dist='))?.slice(7) ?? 'dist');
  const prefixes = (argv.find((arg) => arg.startsWith('--links='))?.slice(8) ?? 'api/,extensions/')
    .split(',').filter((prefix) => prefix !== '');
  const files = htmlFiles(dist);
  const locale = new RegExp(`^(${LOCALES.join('|')})/`);
  const english = apiLinkStats(dist, files.filter((file) => file.startsWith('guide/')));
  const translated = apiLinkStats(dist, files.filter((file) => locale.test(file) && file.includes('/guide/')));
  let failed = false;

  process.stdout.write(`[check-site] literal [[ in the English guide: ${english.literal}; in translations: `
    + `${translated.literal}.\n`);

  if (english.literal > 0) {
    failed = true;
    process.stderr.write(`[check-site] FAIL: literal [[ left in ${english.pages.slice(0, 20).join(', ')}.\n`);
  }

  const total = [...english.unresolved.values()].reduce((sum, count) => sum + count, 0);
  const top = [...english.unresolved].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([target, count]) => `${target} (${count})`);

  process.stdout.write(`[check-site] unresolved API references in the English guide: ${total} `
    + `(${english.unresolved.size} distinct)${top.length > 0 ? `; top: ${top.join(', ')}` : ''}.\n`);

  const referencePages = files.filter((file) => prefixes.some((prefix) => file.startsWith(prefix))
    && (prefix(file) !== 'extensions/' || /^extensions\/[^/]+\/reference\//.test(file)));
  const links = checkLinks(dist, referencePages);

  process.stdout.write(`[check-site] reference pages: ${referencePages.length}, internal links checked: `
    + `${links.checked}, broken: ${links.broken.length}.\n`);

  if (links.broken.length > 0) {
    failed = true;
    process.stderr.write(`[check-site] FAIL: broken links:\n  ${links.broken.slice(0, 40).join('\n  ')}\n`);
  }

  return failed ? 1 : 0;

  function prefix(file) {
    return prefixes.find((candidate) => file.startsWith(candidate));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}

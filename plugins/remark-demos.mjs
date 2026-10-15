import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Paths from the project root (the working directory of `astro build` and `astro dev`).
const ROOT = process.cwd();
const CATALOG_DIR = path.join(ROOT, '.cache', 'demos');
const CATALOG_DIGEST = path.join(CATALOG_DIR, 'catalogs.rendered.sha256');
const DATA_STORE = path.join(ROOT, 'node_modules', '.astro', 'data-store.json');

/** Matches the synced examples page of an extension package (`src/content/docs/extensions/<package>/examples.md`). */
const EXAMPLES_PAGE = /(?:^|\/)src\/content\/docs\/extensions\/([^/]+)\/examples\.md$/;

/**
 * Returns the key that pairs a `php` code block with its demo: the first 16 hex digits of the SHA-256 of the code
 * with line endings normalized, trailing spaces removed and outer blank lines trimmed. `tools/src/Demo/Snippet.php`
 * computes the same value.
 *
 * @param {string} code
 */
export function snippetHash(code) {
  const normalized = code.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n').trim();

  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Reads `.cache/demos/<package>.json` (written by `tools/bin/demos`), or returns `null` when the package has no
 * catalog (no examples page, or no sources in this build mode).
 *
 * @param {string} name
 * @returns {{ package: string, demos: Array<{ slug: string, title: string, number: number, hash: string,
 *   status: string, page: string | null }> } | null}
 */
export function readCatalog(name) {
  const file = path.join(CATALOG_DIR, `${name}.json`);

  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/** An mdast node rendered as the element `tagName` (mdast-util-to-hast `data.hName`). */
function element(tagName, properties, children = []) {
  return { type: 'docsDemoElement', data: { hName: tagName, hProperties: properties }, children };
}

/**
 * Returns the `<docs-demo>` block of one demo: a tab list (Preview, PHP and, when the page has one, HTML) and one
 * panel per tab. The preview is an `<iframe>` of the static demo page, so Bootstrap's CSS never reaches the site;
 * the PHP and HTML panels hold the original code blocks (highlighted by Expressive Code).
 *
 * `.docs-demo-tabs` and `.docs-demo-preview` are site-only and dropped from the llms bundles (`customSelectors`).
 *
 * @param {{ slug: string, title: string, number: number, page: string }} demo
 * @param {object} php The `php` code node.
 * @param {object | null} html The `html` code node that followed it, or `null`.
 */
export function demoNode(demo, php, html) {
  const id = `demo-${demo.slug}`;
  const label = demo.number > 1 ? `${demo.title} (${demo.number})` : demo.title;
  const panels = [
    {
      key: 'preview',
      label: 'Preview',
      children: [element('iframe', { src: demo.page, loading: 'lazy', title: `${label} demo` })],
    },
    { key: 'php', label: 'PHP', children: [php] },
    ...(html ? [{ key: 'html', label: 'HTML', children: [html] }] : []),
  ];

  return element('docs-demo', { className: ['docs-demo', 'not-content'], dataDemo: demo.slug }, [
    element(
      'div',
      { className: ['docs-demo-tabs'], role: 'tablist', ariaLabel: `${label} example` },
      panels.map((panel, index) => element('button', {
        type: 'button',
        role: 'tab',
        id: `${id}-tab-${panel.key}`,
        ariaControls: `${id}-${panel.key}`,
        ariaSelected: index === 0 ? 'true' : 'false',
        tabIndex: index === 0 ? 0 : -1,
      }, [{ type: 'text', value: panel.label }])),
    ),
    ...panels.map((panel, index) => element('div', {
      className: ['docs-demo-panel', `docs-demo-${panel.key}`],
      role: 'tabpanel',
      id: `${id}-${panel.key}`,
      ariaLabelledBy: `${id}-tab-${panel.key}`,
      hidden: index !== 0,
    }, panel.children)),
  ]);
}

/**
 * Replaces, on the examples page of an extension package, each `php` code block that has a rendered demo (and the
 * `html` block right after it) with a `<docs-demo>` block. Blocks are paired by {@see snippetHash}; blocks without a
 * rendered demo, other pages and packages without a catalog are left unchanged. The per-page Markdown for agents is
 * built from the source file, so it keeps both code blocks.
 *
 * @param {{ catalog?: (name: string) => ReturnType<typeof readCatalog> }} [options] `catalog` replaces the catalog
 * reader (tests).
 */
export function remarkDemos(options = {}) {
  const catalogOf = options.catalog ?? readCatalog;

  return (tree, file) => {
    const match = EXAMPLES_PAGE.exec((file.path ?? '').replace(/\\/g, '/'));
    const catalog = match ? catalogOf(match[1]) : null;

    if (!catalog) {
      return;
    }

    /** @type {Map<string, Array<object>>} */
    const demos = new Map();

    for (const demo of catalog.demos) {
      if (demo.status === 'rendered' && demo.page) {
        demos.set(demo.hash, [...(demos.get(demo.hash) ?? []), demo]);
      }
    }

    const children = [];

    for (let index = 0; index < tree.children.length; index++) {
      const node = tree.children[index];
      const demo = node.type === 'code' && node.lang === 'php' ? demos.get(snippetHash(node.value))?.shift() : null;

      if (!demo) {
        children.push(node);
        continue;
      }

      const next = tree.children[index + 1];
      const html = next?.type === 'code' && next.lang === 'html' ? next : null;

      children.push(demoNode(demo, node, html));
      index += html ? 1 : 0;
    }

    tree.children = children;
  };
}

/**
 * Drops Astro's content cache when the demo catalogs changed since the last build, like
 * `invalidateContentCacheOnLinkChange()`: the content layer would otherwise reuse the rendered examples page with
 * stale or missing demos. Only the fields the plugin reads are digested.
 */
export function invalidateContentCacheOnDemoChange() {
  const files = existsSync(CATALOG_DIR)
    ? readdirSync(CATALOG_DIR).filter((name) => name.endsWith('.json')).sort()
    : [];
  const hash = createHash('sha256');

  for (const name of files) {
    const catalog = JSON.parse(readFileSync(path.join(CATALOG_DIR, name), 'utf8'));
    hash.update(JSON.stringify([name, catalog.demos.map(({ slug, title, number, hash: key, status, page }) => [
      slug, title, number, key, status, page,
    ])]));
  }

  const digest = files.length === 0 ? 'none' : hash.digest('hex');
  const previous = existsSync(CATALOG_DIGEST) ? readFileSync(CATALOG_DIGEST, 'utf8').trim() : 'none';

  if (previous !== digest) {
    rmSync(DATA_STORE, { force: true });
  }

  if (existsSync(CATALOG_DIR)) {
    writeFileSync(CATALOG_DIGEST, `${digest}\n`);
  }
}

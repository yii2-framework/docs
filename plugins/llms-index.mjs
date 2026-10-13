import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentPathToSlug, markdownUrl } from './markdown-links.mjs';

const CONTENT_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));

/**
 * Reads a scalar frontmatter field written on one line (`key: value`, `key: "value"` or `key: 'value'`).
 *
 * @param {string} frontmatter
 * @param {string} key
 * @returns {string | undefined}
 */
function frontmatterField(frontmatter, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(frontmatter);

  if (!match) {
    return undefined;
  }

  const raw = match[1].trim();

  if (raw.startsWith('"')) {
    return JSON.parse(raw.replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1'));
  }

  if (raw.startsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }

  return raw;
}

/**
 * Returns the default-locale (English) pages by slug: `{ title, description }`, read from the frontmatter.
 *
 * @param {string[]} localeKeys Locale directory names to skip (every locale except `root`).
 * @returns {Map<string, { title: string, description: string }>}
 */
export function englishPages(localeKeys) {
  const pages = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      const relative = path.relative(CONTENT_DIR, file).split(path.sep).join('/');

      if (statSync(file).isDirectory()) {
        if (!localeKeys.includes(relative)) {
          walk(file);
        }
        continue;
      }

      if (!/\.mdx?$/.test(name) || name.startsWith('_')) {
        continue;
      }

      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
      const title = frontmatterField(frontmatter, 'title');

      if (!title) {
        throw new Error(`${relative} has no title.`);
      }

      const description = frontmatterField(frontmatter, 'description') ?? '';

      pages.set(contentPathToSlug(relative), { title, description });
    }
  };

  walk(CONTENT_DIR);

  return pages;
}

/**
 * Returns the sidebar groups as `{ label, slugs }`, expanding `autogenerate` directories to their English pages
 * (sorted by slug). Only top-level groups are supported, which is what this site's sidebar uses.
 *
 * @param {Array<{ label: string, items: Array<{ slug?: string, autogenerate?: { directory: string } }> }>} sidebar
 * @param {Map<string, unknown>} pages Result of {@link englishPages}.
 */
export function sidebarGroups(sidebar, pages) {
  return sidebar.map((group) => ({
    label: group.label,
    slugs: group.items.flatMap((item) => {
      if (item.slug !== undefined) {
        return [item.slug];
      }

      if (item.autogenerate) {
        const prefix = `${item.autogenerate.directory}/`;

        return [...pages.keys()].filter((slug) => slug.startsWith(prefix) || slug === item.autogenerate.directory)
          .sort();
      }

      throw new Error(`Unsupported sidebar item in group "${group.label}".`);
    }),
  }));
}

/**
 * Builds the `details` section of `llms.txt`: one Markdown list per sidebar group, each line linking a page's
 * Markdown URL with its one-line description. Pages missing from the sidebar are listed first under "Overview".
 *
 * @param {ReturnType<typeof sidebarGroups>} groups
 * @param {Map<string, { title: string, description: string }>} pages
 * @param {{ site: string, base: string, intro: string }} options
 */
export function llmsTxtDetails(groups, pages, { site, base, intro }) {
  const listed = new Set(groups.flatMap((group) => group.slugs));
  const unlisted = [...pages.keys()].filter((slug) => !listed.has(slug)).sort();
  const sections = [intro];
  const line = (slug) => {
    const page = pages.get(slug);

    if (!page) {
      throw new Error(`Sidebar slug "${slug}" has no English page.`);
    }

    const url = new URL(markdownUrl(slug, base), site).href;

    return `- [${page.title}](${url})${page.description ? `: ${page.description}` : ''}`;
  };

  for (const { label, slugs } of [{ label: 'Overview', slugs: unlisted }, ...groups]) {
    if (slugs.length > 0) {
      sections.push(`## ${label}\n\n${slugs.map(line).join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

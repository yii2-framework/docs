import { getCollection } from 'astro:content';
import { markdownUrl, resolveMarkdownLink } from './markdown-links.mjs';
import { REFERENCE_ID } from './reference-id.mjs';
import { cleanReferenceMarkdown } from './reference-markdown.mjs';
import { rewriteApiLinksInLine } from './yii-links.mjs';

const CONTENT_PREFIX = 'src/content/docs/';

/**
 * Rewrites one line of Markdown prose (no code fence): relative `.md` links in inline links, reference definitions
 * and raw HTML `href` attributes become Markdown URLs. Inline code spans are left untouched.
 *
 * @param {string} line
 * @param {(href: string) => string | null} rewrite Returns the new href, or `null` to keep the original.
 */
function rewriteLine(line, rewrite) {
  const definition = /^(\s{0,3}\[[^\]]+\]:\s*)(\S+)(.*)$/.exec(line);

  if (definition) {
    const href = rewrite(definition[2]);

    return href === null ? line : `${definition[1]}${href}${definition[3]}`;
  }

  // Odd parts are code spans (kept verbatim); even parts are prose.
  return line
    .split(/(`+[^`]*?`+)/)
    .map((part, index) => {
      if (index % 2 === 1) {
        return part;
      }

      return part
        .replace(/\]\(\s*([^)\s]+)((?:\s+(?:"[^"]*"|'[^']*'))?\s*)\)/g, (all, href, title) => {
          const resolved = rewrite(href);

          return resolved === null ? all : `](${resolved}${title})`;
        })
        .replace(/(\shref=")([^"]*)(")/g, (all, open, href, close) => {
          const resolved = rewrite(href);

          return resolved === null ? all : `${open}${resolved}${close}`;
        });
    })
    .join('');
}

/**
 * Returns the page body as served at `<page>/index.md`: the leading H1 removed (the title is prepended by the route)
 * and every relative `.md` link rewritten to the base-absolute Markdown URL (`/docs/guide/x/index.md#a`);
 * `[[yii\...]]` API references become links to the reference Markdown URLs (unknown ones become inline code). Code
 * fences and inline code are left untouched.
 *
 * A translated page that links a page without a translation gets the default-locale Markdown URL, because only
 * content entries have a Markdown version (Starlight's fallback pages are HTML only).
 *
 * @param {string} body Markdown source without frontmatter.
 * @param {string} sourceRelative POSIX path of the source file relative to `src/content/docs`.
 * @param {string} base The Astro `base`.
 * @param {(slug: string) => boolean} [hasEntry] Whether a content entry exists for a slug (default: always).
 */
export function rewriteMarkdown(body, sourceRelative, base, hasEntry = () => true) {
  const rewrite = (href) => {
    const target = resolveMarkdownLink(href, sourceRelative);

    if (target === null) {
      return null;
    }

    let { slug } = target;

    if (!hasEntry(slug)) {
      const unprefixed = slug.includes('/') ? slug.slice(slug.indexOf('/') + 1) : '';

      if (hasEntry(unprefixed)) {
        slug = unprefixed;
      }
    }

    return `${markdownUrl(slug, base)}${target.hash}`;
  };
  const lines = body.split('\n');
  const output = [];
  let fence = null;
  let seenContent = false;

  for (const line of lines) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);

    if (fence !== null) {
      output.push(line);
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }

    if (fenceMatch) {
      fence = fenceMatch[1];
      seenContent = true;
      output.push(line);
      continue;
    }

    if (!seenContent && /^#\s/.test(line)) {
      seenContent = true;
      continue;
    }

    if (line.trim() !== '') {
      seenContent = true;
    }

    output.push(rewriteApiLinksInLine(rewriteLine(line, rewrite)));
  }

  return output.join('\n').trim();
}

/**
 * Markdown renderer for `starlight-llm-actions` (`renderMarkdown: { module }`): returns the body only; the route
 * prepends `# <title>` and `> <description>`. Generated API reference pages lose their HTML styling hooks first
 * (see `cleanReferenceMarkdown()`).
 *
 * @param {{ id: string, filePath?: string, body?: string }} entry
 */
export default async function renderMarkdown(entry) {
  const filePath = (entry.filePath ?? '').replace(/\\/g, '/');

  if (!filePath.startsWith(CONTENT_PREFIX)) {
    // starlight-llm-actions catches this, logs a warning and serves the raw source for the page.
    throw new Error(`Entry "${entry.id}" is not under ${CONTENT_PREFIX}; relative links cannot be resolved.`);
  }

  const ids = await entryIds();
  const sourceRelative = filePath.slice(CONTENT_PREFIX.length);
  const body = REFERENCE_ID.test(sourceRelative) ? cleanReferenceMarkdown(entry.body ?? '') : entry.body ?? '';

  return rewriteMarkdown(body, sourceRelative, import.meta.env.BASE_URL,
    (slug) => ids.has(slug === '' ? 'index' : slug));
}

let ids;

/** Returns the ids of all `docs` entries (loaded once per build). */
function entryIds() {
  ids ??= getCollection('docs').then((entries) => new Set(entries.map((entry) => entry.id)));

  return ids;
}

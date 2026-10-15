// Description heuristic shared by `scripts/add-descriptions.mjs` (content pages) and `scripts/sync.mjs` (extension
// pages): the first prose paragraph of a Markdown body (skipping headings, blockquotes, code fences, tables, images,
// HTML comments, Starlight asides and list blocks), stripped of Markdown, collapsed to one line and truncated to at
// most 160 characters at a sentence or word boundary.

export const MAX_LENGTH = 160;

// Paragraphs that are not a summary of the page: license notices, copyright lines, admonition labels.
const SKIP_PARAGRAPH = [
  /yiiframework\.com\/doc\/terms/i,
  /^all rights reserved\.?$/i,
  /\(c\)/i,
  /^(note|tip|info|warning|important|caution)\s*:/i,
];
const ABBREVIATIONS = /\b(e\.g|i\.e|etc|vs|cf|approx|incl|no)\.$/i;

/**
 * Splits a Markdown file into frontmatter lines and body lines.
 */
export function splitFrontmatter(source) {
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
  // Inside a list item, blockquote or table: lazy continuation lines belong to it until a blank line.
  let inBlock = false;

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
      inBlock = false;
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

    if (startsBlock) {
      flush();
      inBlock = true;
      continue;
    }

    if (inBlock) {
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
export function sentenceEnds(text) {
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
 * Quotes a string as a double-quoted YAML scalar.
 */
export function yamlQuote(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f\u007f]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);

  return `"${escaped}"`;
}

/**
 * Styling hooks that `tools/bin/reference` writes around Markdown blocks of reference pages. Each wrapper tag is on a
 * line of its own, separated from its Markdown content by blank lines.
 */
const WRAPPER_LINE = /^(?:<(?:div|details) class="api-[\w -]+">|<\/div>|<\/details>)$/;
const SUMMARY_LINE = /^<summary>(.*)<\/summary>$/;
const STYLED_SPAN = /<span class="api-[\w -]+">([^<]*)<\/span>/g;

/**
 * Returns the Markdown of a generated reference page without its HTML styling hooks, for the `index.md` copy served to
 * agents: wrapper lines (`<div class="api-...">`, `</div>`, `<details class="api-...">`, `</details>`) are
 * dropped, `<summary>45 subclasses</summary>` becomes the line `45 subclasses:` before its list,
 * `<span class="api-...">x</span>` becomes `x`, ```` ```php wrap ```` becomes ```` ```php ````, and the blank lines left
 * behind collapse. Anchor spans (`<span id="...">`) and code block contents are kept.
 *
 * @param {string} body Markdown source without frontmatter.
 */
export function cleanReferenceMarkdown(body) {
  const output = [];
  let fence = null;

  for (const line of body.split('\n')) {
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
      // Signatures are `php wrap` blocks (an Expressive Code option); the language is enough here.
      output.push(line.replace(/^(\s*`{3,}php) wrap$/, '$1'));
      continue;
    }

    if (WRAPPER_LINE.test(line)) {
      continue;
    }

    const summary = SUMMARY_LINE.exec(line);

    if (summary) {
      output.push(`${summary[1]}:`, '');
      continue;
    }

    if (line.trim() === '' && (output.length === 0 || output[output.length - 1].trim() === '')) {
      continue;
    }

    output.push(line.replace(STYLED_SPAN, '$1'));
  }

  return output.join('\n').trim();
}

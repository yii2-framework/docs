// Generated parts of the Documentation hub (src/content/docs/documentation.md): the extension guides grouped by
// the catalog topics (src/data/catalog-topics.json) and the development tools. One Markdown source for both
// outputs: plugins/remark-hub.mjs renders it into the HTML page and plugins/llm-render-markdown.mjs into its
// index.md. Links are relative `.md` paths from `documentation.md`, like the hand-written links of that page, so
// both pipelines resolve them the same way.
import { packages, topics as catalogTopics, withBase } from "./catalog.mjs";
import { displayOrder, loadHosting } from "./hosting.mjs";

/** Placeholders of `documentation.md`, each replaced by the Markdown of its section. */
export const HUB_PLACEHOLDERS = Object.freeze({
  extensions: "<!-- hub:extensions -->",
  tools: "<!-- hub:tools -->",
});

/** At most this many links per package, so a row stays readable. */
const MAX_LINKS = 7;

/** Short labels of the pages every package guide may have; other pages keep their frontmatter title. */
const STANDARD_LABELS = Object.freeze({
  installation: "Install",
  configuration: "Configure",
  examples: "Examples",
  migration: "Migrate",
  agents: "Agent notes",
  testing: "Testing",
});

// Page links in priority order when a package has more than fit: the first three standard pages, then the package's
// own pages, then the remaining standard pages.
const PRIORITY = ["installation", "configuration", "examples"];
const LATER = ["migration", "agents", "testing"];

/** Escapes inline Markdown in text read from manifests and frontmatter. */
const inline = (text) => String(text).replace(/[\\`*_[\]<>]/g, "\\$&");

const sentence = (text) => {
  const value = text.trim();

  return value === "" || /[.!?]$/.test(value) ? value : `${value}.`;
};

/**
 * Returns one list item: the package title and description, then its page links.
 *
 * @param {object} hosted Hosting facts of `loadHosting()`.
 * @param {{ id: string } | null} record Catalog record, or `null` (no "Package entry" link).
 * @param {string} base The Astro `base`.
 * @param {boolean} markdown Link the package entry's Markdown version (index.md route) instead of its page.
 */
function item(hosted, record, base, markdown) {
  const bySlug = new Map(hosted.pages.map((page) => [page.slug, page]));
  const own = hosted.pages
    .map(({ slug }) => slug)
    .filter((slug) => slug !== "" && !Object.hasOwn(STANDARD_LABELS, slug));
  const label = (page) => {
    if (page.slug === "examples" && hosted.demos) {
      return "Examples, live demos";
    }

    return STANDARD_LABELS[page.slug] ?? page.title;
  };
  const tail = [
    hosted.referenceUrl && {
      label: "API reference",
      href: `${hosted.url.slice(1)}reference/index.md`,
    },
    hosted.skillUrl && {
      label: "Agent skill",
      href: withBase(hosted.skillUrl, base),
    },
    record && {
      label: "Package entry",
      href: withBase(
        `/packages/${record.id}/${markdown ? "index.md" : ""}`,
        base,
      ),
    },
  ].filter(Boolean);
  const head = [...PRIORITY, ...own, ...LATER]
    .map((slug) => bySlug.get(slug))
    .filter(Boolean)
    .slice(0, Math.max(0, MAX_LINKS - tail.length))
    .map((page) => ({ label: label(page), href: page.file }));
  const links = [...head, ...tail]
    .map(({ label: text, href }) => `[${inline(text)}](${href})`)
    .join(" | ");
  const description = sentence(inline(hosted.description));

  return [
    `- **[${inline(hosted.title)}](${hosted.pages[0].file})**${description ? `: ${description}` : ""}`,
    "",
    `  ${links}`,
  ].join("\n");
}

/**
 * Returns the hosting entries of synced guides; unsynced ones are skipped with a warning, like the sidebar.
 *
 * @param {Array<[unknown, object]>} entries Pairs of a key (Composer id or catalog record) and its hosting facts.
 */
function synced(entries) {
  return entries.filter(([, hosted]) => {
    if (!hosted.guide) {
      console.warn(
        `[hub] ${hosted.name} has no synced pages; the Documentation hub omits it. Run \`npm run sync\`.`,
      );
    }

    return hosted.guide;
  });
}

/**
 * Returns the Markdown of a generated hub section: `extensions` (one `### <topic>` per topic of
 * `src/data/catalog-topics.json`, one list item per hosted extension whose catalog record has that topic, with its
 * page links, API reference, agent skill and package entry) or `tools` (one list item per development tool of
 * `tools.json`). Topics keep their display order and topics without a synced extension are skipped; inside a topic
 * the extensions follow `displayOrder()` of `src/lib/hosting.mjs`.
 *
 * Every extension of `packages.json` (except the framework) must have a catalog record, so that it is placed in a
 * topic; otherwise this throws.
 *
 * @param {"extensions" | "tools"} section
 * @param {{ hosting?: ReturnType<typeof loadHosting>, topics?: ReadonlyArray<{ id: string, title: string,
 *   summary: string }>, records?: ReadonlyArray<{ id: string, topic: string, family: string, name: string }>,
 *   base?: string, markdown?: boolean }} [options] `topics`: the catalog topics (default: `catalog-topics.json`);
 *   `records`: the catalog records (default: `src/data/catalog/`); `base`: the Astro `base` for site-absolute links
 *   (package entry, agent skill); `markdown`: link the package entry's index.md.
 */
export function hubMarkdown(section, options = {}) {
  const hosting = options.hosting ?? loadHosting();
  const records = options.records ?? packages;
  const base = options.base ?? "/";
  const markdown = options.markdown === true;
  const entries = [...hosting.entries()];

  if (section === "tools") {
    return synced(entries.filter(([, hosted]) => hosted.type === "tool"))
      .map(([, hosted]) => item(hosted, null, base, markdown))
      .join("\n\n");
  }

  if (section !== "extensions") {
    throw new Error(`[hub] unknown section "${section}".`);
  }

  const topics = options.topics ?? catalogTopics;
  const known = new Set(topics.map((topic) => topic.id));
  const extensions = entries.filter(
    ([, hosted]) => hosted.type === "extension",
  );
  const placed = extensions.map(([id, hosted]) => {
    const record = records.find((pkg) => pkg.id === id);

    if (record === undefined) {
      throw new Error(
        `[hub] ${hosted.name} (${id}) has no catalog record in src/data/catalog/, so it has no topic.`,
      );
    }

    if (!known.has(record.topic)) {
      throw new Error(
        `[hub] ${hosted.name} (${id}) has the topic "${record.topic}", which is not in src/data/catalog-topics.json.`,
      );
    }

    return record;
  });
  const ordered = displayOrder(placed, hosting);

  return topics
    .map((topic) => {
      const items = synced(
        ordered
          .filter((record) => record.topic === topic.id)
          .map((record) => [record, hosting.get(record.id)]),
      ).map(([record, hosted]) => item(hosted, record, base, markdown));

      return items.length === 0
        ? ""
        : [
            `### ${inline(topic.title)}`,
            "",
            inline(topic.summary),
            "",
            items.join("\n\n"),
          ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Replaces the hub placeholders of a Markdown body with the generated sections (for the index.md route).
 *
 * @param {string} body
 * @param {Parameters<typeof hubMarkdown>[1]} [options]
 */
export function replaceHubPlaceholders(body, options = {}) {
  let result = body;

  for (const [section, placeholder] of Object.entries(HUB_PLACEHOLDERS)) {
    if (result.includes(placeholder)) {
      result = result.split(placeholder).join(hubMarkdown(section, options));
    }
  }

  return result;
}

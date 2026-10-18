import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';
import { collapseTablePadding } from './llms-tables.mjs';
import { REFERENCE_ID } from './reference-id.mjs';

/** Largest bundle in bytes: about 30k tokens at 4 bytes per token. A bundle of one larger page is allowed. */
export const BUNDLE_LIMIT = 120_000;

const CONTENT_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

// starlight-llms-txt sorts the pages of a bundle by id with a collator of the default language.
const collator = new Intl.Collator('en');
const byId = (a, b) => collator.compare(a, b);

/**
 * Returns a function that estimates the size in bytes of a page inside a `starlight-llms-txt` bundle, from its source
 * file: the body without frontmatter and table padding, times `factor` (Markdown links grow to site URLs), plus the
 * `# Title` and `> Description` lines the bundle adds. Generated reference pages lose their HTML wrappers in the
 * bundle, so they use `referenceFactor`.
 *
 * @param {Map<string, { title: string, description: string, file: string }>} pages English pages by slug.
 * @param {{ contentDir?: string, factor?: number, referenceFactor?: number }} [options]
 * @returns {(slug: string) => number}
 */
export function sourceSizer(pages, { contentDir = CONTENT_DIR, factor = 1.05, referenceFactor = 0.92 } = {}) {
  const cache = new Map();

  return (slug) => {
    if (!cache.has(slug)) {
      const page = pages.get(slug);

      if (!page) {
        throw new Error(`[llms-sets] no English page for "${slug}".`);
      }

      const source = readFileSync(`${contentDir}${page.file}`, 'utf8').replace(FRONTMATTER, '');
      const body = collapseTablePadding(source).text;
      const header = `# ${page.title}\n\n> ${page.description}\n\n`;
      const scale = REFERENCE_ID.test(slug) ? referenceFactor : factor;

      cache.set(slug, Math.ceil(Buffer.byteLength(body) * scale) + Buffer.byteLength(header));
    }

    return cache.get(slug);
  };
}

/**
 * Splits a sequence into the fewest consecutive chunks whose sizes stay within `limit`, balancing the chunks (the
 * largest chunk is as small as possible). An item larger than `limit` gets a chunk of its own.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} sizeOf
 * @param {number} limit
 * @returns {T[][]}
 */
export function partition(items, sizeOf, limit) {
  if (items.length === 0) {
    return [];
  }

  const sizes = items.map((item) => Math.min(sizeOf(item), limit));
  const prefix = [0];

  for (const size of sizes) {
    prefix.push(prefix.at(-1) + size);
  }

  const span = (from, to) => prefix[to] - prefix[from];
  const count = items.length;

  for (let chunks = Math.max(1, Math.ceil(prefix[count] / limit)); chunks <= count; chunks++) {
    // best[k][i]: smallest possible largest chunk when the first i items form k chunks; cut[k][i]: start of the last.
    const best = Array.from({ length: chunks + 1 }, () => new Array(count + 1).fill(Number.POSITIVE_INFINITY));
    const cut = Array.from({ length: chunks + 1 }, () => new Array(count + 1).fill(0));

    best[0][0] = 0;

    for (let k = 1; k <= chunks; k++) {
      for (let i = k; i <= count; i++) {
        for (let start = k - 1; start < i; start++) {
          const value = Math.max(best[k - 1][start], span(start, i));

          if (value < best[k][i]) {
            best[k][i] = value;
            cut[k][i] = start;
          }
        }
      }
    }

    if (best[chunks][count] > limit) {
      continue;
    }

    const result = [];

    for (let k = chunks, end = count; k > 0; k--) {
      const start = cut[k][end];

      result.unshift(items.slice(start, end));
      end = start;
    }

    return result;
  }

  throw new Error('[llms-sets] partition failed.');
}

/** Returns the path segments shared by every slug. */
function commonSegments(slugs) {
  const split = slugs.map((slug) => slug.split('/'));
  const common = [];

  for (let index = 0; split.every((segments) => index < segments.length - (slugs.length === 1 ? 1 : 0)); index++) {
    const segment = split[0][index];

    if (!split.every((segments) => segments[index] === segment)) {
      break;
    }

    common.push(segment);
  }

  return common;
}

/**
 * Returns the topic name of a page inside a bundle unit: its slug below the directory shared by the unit, without the
 * prefix shared by all those names (`guide/db-active-record` in a unit of `guide/db-*` pages is `active-record`).
 *
 * @param {string} slug
 * @param {string[]} unit Slugs of the unit.
 */
export function topicName(slug, unit) {
  const depth = commonSegments(unit).length;
  const relative = (candidate) => candidate.split('/').slice(depth).join('-');
  const names = unit.map(relative).filter((name) => name !== '');
  const first = /^[^-]+-/.exec(names[0] ?? '')?.[0];
  const prefix = first !== undefined && names.length > 1 && names.every((name) => name.startsWith(first)) ? first : '';
  const name = relative(slug);

  return name === '' ? 'overview' : name.slice(prefix.length) || name;
}

/**
 * Bundles of one unit of guide pages, in sidebar order: the whole unit when it fits, otherwise consecutive chunks; the
 * first chunk keeps the unit label, the next ones are labelled after their first page (`Working with Databases:
 * active-record`).
 */
function guideBundles(base, slugs, { pages, size, limit, group, section }) {
  const chunks = partition(slugs, size, limit);

  return chunks.map((chunk, index) => ({
    label: index === 0 ? base : `${base}: ${topicName(chunk[0], slugs)}`,
    description: chunk.map((slug) => pages.get(slug).title).join(', '),
    paths: chunk,
    group,
    section,
    whole: chunks.length === 1,
  }));
}

/**
 * Returns the guide bundles (every sidebar group except the API reference): one per group, one per nested group
 * (extension package) and, above `limit`, consecutive chunks of the group in sidebar order.
 *
 * @param {Array<{ label: string, slugs: string[], sections: Array<{ label: string, slugs: string[] }> }>} groups
 * @param {Map<string, { title: string }>} pages
 * @param {{ size: (slug: string) => number, limit?: number }} options
 */
export function topicBundles(groups, pages, { size, limit = BUNDLE_LIMIT }) {
  const guide = (slugs) => slugs.filter((slug) => !REFERENCE_ID.test(slug));
  const bundles = [];

  for (const { label, slugs, sections = [] } of groups) {
    if (slugs.length > 0 && slugs.every((slug) => REFERENCE_ID.test(slug))) {
      continue;
    }

    const nested = new Set(sections.flatMap((section) => section.slugs));
    const direct = guide(slugs.filter((slug) => !nested.has(slug)));
    const context = { pages, size, limit, group: label };

    if (direct.length > 0) {
      bundles.push(...guideBundles(label, direct, context));
    }

    for (const section of sections) {
      const sectionSlugs = guide(section.slugs);

      if (sectionSlugs.length === 0) {
        continue;
      }

      const name = commonSegments(sectionSlugs).at(-1) ?? section.label;

      bundles.push(...guideBundles(`${label}: ${name}`, sectionSlugs, { ...context, section: section.label }));
    }
  }

  return bundles;
}

/**
 * Returns the API reference bundles: one per framework namespace group (`yii\db` with its sub-namespaces is
 * `api-yii2-db`; the reference index, the global namespace and `yii` are `api-yii2`) and one per extension package
 * (`api-bootstrap6`). A group above `limit` is split into balanced consecutive chunks of its pages in reading order
 * (namespace page, its types, then each sub-namespace). A chunk is named after its first page: `api-yii2-db` starts
 * with the `yii\db` page, `api-yii2-db-baseactiverecord` with the `BaseActiveRecord` type.
 *
 * @param {Map<string, { title: string }>} pages
 * @param {{ size: (slug: string) => number, types: Map<string, string>, limit?: number }} options `types` maps the
 * slug of every type page to its fully qualified name; the other reference pages are namespace pages.
 */
export function apiBundles(pages, { size, types, limit = BUNDLE_LIMIT }) {
  const slugs = [...pages.keys()].filter((slug) => REFERENCE_ID.test(slug)).sort(byId);
  const namespaces = new Set(slugs.filter((slug) => !types.has(slug)));
  const parentOf = (slug) => {
    for (let parent = slug.slice(0, slug.lastIndexOf('/')); parent.includes('/'); parent = parent.slice(0,
      parent.lastIndexOf('/'))) {
      if (namespaces.has(parent)) {
        return parent;
      }
    }

    return namespaces.has('api') && slug !== 'api' && slug.startsWith('api/') ? 'api' : null;
  };
  const children = new Map([...namespaces].map((slug) => [slug, { types: [], namespaces: [] }]));

  for (const slug of slugs) {
    const parent = parentOf(slug);

    if (parent !== null) {
      children.get(parent)[types.has(slug) ? 'types' : 'namespaces'].push(slug);
    }
  }

  // Group roots: the namespaces below `yii` (framework) and the root namespace of each package; the rest of the
  // framework reference (index, global namespace, `yii` itself) is the `yii2` group.
  const roots = [...namespaces].filter((slug) => parentOf(slug) === 'api/yii'
    || /^extensions\/[^/]+\/reference$/.test(slug))
    .sort((a, b) => (a.startsWith('api/') === b.startsWith('api/') ? byId(a, b) : a.startsWith('api/') ? -1 : 1));
  const isRoot = new Set(roots);
  // Pages of a namespace in reading order: the namespace page, its types, then each sub-namespace (other groups
  // excluded).
  const walk = (namespace) => [
    namespace,
    ...[...children.get(namespace).types].sort(byId),
    ...[...children.get(namespace).namespaces].sort(byId).filter((child) => !isRoot.has(child)).flatMap(walk),
  ];
  const nameOf = (namespace) => {
    const framework = /^api\/yii\/(.+)$/.exec(namespace);

    if (framework) {
      return `yii2-${framework[1].replaceAll('/', '-')}`;
    }

    const extension = /^extensions\/([^/]+)\/reference(?:\/(.+))?$/.exec(namespace);

    return extension ? [extension[1], extension[2]?.replaceAll('/', '-')].filter(Boolean).join('-') : 'yii2';
  };
  // A bundle starting with a namespace page is named after the namespace, otherwise after its first type.
  const nameOfChunk = (first) => (types.has(first)
    ? `${nameOf(parentOf(first))}-${first.slice(first.lastIndexOf('/') + 1)}` : nameOf(first));
  const groups = [...(namespaces.has('api') ? [walk('api')] : []), ...roots.map(walk)];
  // Name of a namespace (`yii\db`), from the name of one of its types; otherwise the title of its page.
  const fqn = (namespace) => {
    const type = children.get(namespace).types[0];
    const name = type === undefined ? '' : types.get(type).split('\\').slice(0, -1).join('\\');

    return name === '' ? pages.get(namespace).title : name;
  };

  /** `yii\db`, or `yii\db (ActiveQuery to BatchQueryResult)` when the bundle holds only some of its types. */
  const describe = (bundle) => {
    const members = new Set(bundle);
    const parentsInBundle = [...new Set(bundle.map((slug) => (types.has(slug) ? parentOf(slug) : slug)))];
    const described = parentsInBundle.map((namespace) => {
      const own = [namespace, ...children.get(namespace).types];
      const present = own.filter((slug) => members.has(slug) && types.has(slug)).sort(byId);

      if (own.every((slug) => members.has(slug))) {
        return fqn(namespace);
      }

      const title = (slug) => pages.get(slug).title;

      if (present.length === 0) {
        return `${fqn(namespace)} (namespace page)`;
      }

      return present.length === 1 ? `${fqn(namespace)} (${title(present[0])})`
        : `${fqn(namespace)} (${title(present[0])} to ${title(present.at(-1))})`;
    });
    const count = bundle.filter((slug) => types.has(slug)).length;

    return `${described.join(', ')}; ${count} ${count === 1 ? 'type' : 'types'}`;
  };

  return groups.flatMap((group) => partition(group, size, limit).map((chunk) => ({
    label: `api-${nameOfChunk(chunk[0])}`,
    description: describe(chunk),
    paths: [...chunk].sort(byId),
    group: 'API reference',
    section: undefined,
    topic: group[0] === 'api' ? 'index, global namespace, yii' : fqn(group[0]),
    whole: false,
  })));
}

/**
 * Returns the file name (without `.txt`) that `starlight-llms-txt` gives each bundle (GitHub slugs of the labels, in
 * order) and fails when two bundles would share a name.
 *
 * @param {Array<{ label: string }>} bundles
 * @returns {string[]}
 */
export function bundleNames(bundles) {
  const slugger = new GithubSlugger();
  const names = bundles.map(({ label }) => slugger.slug(label));
  const plain = bundles.map(({ label }) => new GithubSlugger().slug(label));
  const clash = names.findIndex((name, index) => name !== plain[index]);

  if (clash !== -1) {
    throw new Error(`[llms-sets] bundle "${bundles[clash].label}" clashes with another bundle name (${plain[clash]}).`);
  }

  return names;
}

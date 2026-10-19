#!/usr/bin/env node
// Syncs package guides from `packages.json` and non-Composer tools from `tools.json`.
// Tool guides go to `development-tools/<name>/`; extension guides go to
// `src/content/docs/extensions/<name>/` (git-ignored build input).
//
// For each package the sources come from `localPath` (with `--local` or `SYNC_LOCAL=1`, when the directory exists)
// or from a shallow clone of `repo` at `ref` in `.cache/packages/<name>/`. The package `README.md` becomes the landing
// page (`index.md`) and every `<docsDir>/*.md` file one page; images under `<docsDir>` are copied next to the pages.
// Optional `skillsDir` imports complete package-owned bundles into .cache/skills and public/skills unchanged.
// The required `framework-skills.json` selects the common skill package; without `localPath` it always uses `repo`/`ref`.
// Each page gets frontmatter (`title` from the first H1, which is removed; `description`; `sidebar.order`; `editUrl`)
// and its links are rewritten: links between synced pages stay relative, links to other files of the package become
// GitHub URLs at `ref`, absolute URLs and `[[yii\...]]` references are left untouched. The output has no timestamps,
// so running the script twice yields identical files.
//
// A package whose `composer.json` name differs from the manifest `packagist` value (for example a repository that
// still holds a template) is skipped with a `[sync] skipped <name>: ...` warning and no page; the script still exits 0
// so the deploy is not blocked, unless `--strict` is given.
//
// An entry with `"type": "framework"` (the Yii framework, input of the API reference) has no guides: only its sources
// are obtained, as a shallow sparse clone of `<srcDir>` or, in local mode, as `git archive <ref> <srcDir>` exported
// from the `localPath` clone (which may be checked out on another branch; it is never switched). Its name guard reads
// `<srcDir>/composer.json`.
//
// Every run writes `.cache/sources.json` (mode, directory, ref, commit and skip reason per entry), the input of
// `tools/bin/reference`.
//
// Usage: node scripts/sync.mjs [--local] [--strict] [--manifest=<path>] [--tools-manifest=<path>]

import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, yamlQuote } from "./lib/description.mjs";
import { safeRelativeDirectory, syncSkills } from "./sync-skills.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT_DIR = path.join(ROOT, "src", "content", "docs", "extensions");
const CACHE_DIR = path.join(ROOT, ".cache", "packages");
const SOURCES_FILE = path.join(ROOT, ".cache", "sources.json");
const SKILLS_CACHE = path.join(ROOT, ".cache", "skills");
const SKILLS_PUBLIC = path.join(ROOT, "public", "skills");
const REQUIRED_KEYS = [
  "name",
  "title",
  "repo",
  "ref",
  "srcDir",
  "namespace",
  "localPath",
  "packagist",
];
const TYPES = ["package", "framework", "tool"];
const TOOLS_OUTPUT_DIR = path.join(
  ROOT,
  "src",
  "content",
  "docs",
  "development-tools",
);
// `published`: on Packagist; `unpublished`: not on Packagist (a GitHub release may exist); `template`: a repository users
// copy with "Use this template" instead of installing it with Composer.
const STATUSES = ["published", "unpublished", "template"];
// Sidebar order of the pages when the manifest has no `order`; the landing page is always first.
const DEFAULT_ORDER = [
  "installation",
  "configuration",
  "examples",
  "migration",
  "testing",
];
const IMAGE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
// `](href)` or `](href "title")` of an inline link or image.
const INLINE_LINK = /\]\(\s*<?([^)\s>]+)>?((?:\s+(?:"[^"]*"|'[^']*'))?\s*)\)/g;
// GitHub alert type -> Starlight aside. `IMPORTANT` maps to `caution` so it survives the `llms-small.txt` trimming.
const ALERTS = {
  NOTE: ":::note",
  TIP: ":::tip",
  IMPORTANT: ":::caution[Important]",
  WARNING: ":::caution",
  CAUTION: ":::danger",
};
// Sections whose badges are human calls to action: their badges become text links instead of being dropped.
const CALL_TO_ACTION = /social|sponsor|support|star|follow|license|community/i;

/**
 * Validates the manifest and returns its packages; throws with every problem found.
 *
 * @param {unknown} manifest Parsed `packages.json`.
 * @param {string} file Manifest path, for messages.
 */
export function validateManifest(manifest, file) {
  const errors = [];

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(`${file}: expected a non-empty array of packages.`);
  }

  const names = new Set();

  manifest.forEach((entry, index) => {
    const where = `${file}[${index}]`;

    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${where}: expected an object.`);
      return;
    }

    if (entry.type !== undefined && !TYPES.includes(entry.type)) {
      errors.push(`${where}: "type" must be one of ${TYPES.join(", ")}.`);
    }

    // A framework entry has no guides, so no `docsDir`.
    const required =
      entry.type === "tool"
        ? ["name", "title", "repo", "ref", "localPath", "docsDir"]
        : entry.type === "framework"
          ? REQUIRED_KEYS
          : [...REQUIRED_KEYS, "docsDir"];

    for (const key of required) {
      if (typeof entry[key] !== "string" || entry[key].trim() === "") {
        errors.push(`${where}: "${key}" must be a non-empty string.`);
      }
    }

    if (typeof entry.name === "string") {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) {
        errors.push(
          `${where}: "name" must be lowercase letters, digits and hyphens.`,
        );
      }
      if (names.has(entry.name)) {
        errors.push(`${where}: duplicate name "${entry.name}".`);
      }
      names.add(entry.name);
    }

    if (
      typeof entry.repo === "string" &&
      !/^(https:\/\/|file:\/\/)/.test(entry.repo)
    ) {
      errors.push(
        `${where}: "repo" must be an https:// (or file:// for tests) URL.`,
      );
    }

    if (entry.status !== undefined && !STATUSES.includes(entry.status)) {
      errors.push(`${where}: "status" must be one of ${STATUSES.join(", ")}.`);
    }

    if (
      entry.skillsDir !== undefined &&
      !safeRelativeDirectory(entry.skillsDir)
    ) {
      errors.push(
        `${where}: "skillsDir" must be a relative directory without traversal.`,
      );
    }

    if (
      entry.order !== undefined &&
      (!Array.isArray(entry.order) ||
        entry.order.some((item) => typeof item !== "string"))
    ) {
      errors.push(`${where}: "order" must be an array of page names.`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid manifest:\n${errors.join("\n")}`);
  }

  return manifest;
}

const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

/** Runs git and returns its trimmed stdout, or `null` when it exits with an error. */
function gitOutput(args) {
  const result = spawnSync("git", args, { encoding: "utf8", env: GIT_ENV });

  return result.status === 0 ? result.stdout.trim() : null;
}

/**
 * Exports `<srcDir>` of the framework clone at `localPath` into `.cache/packages/<name>/` with `git archive`, without
 * touching the clone's checkout. The ref is the local branch `ref`, else `origin/<ref>`, else fetched from `origin`.
 *
 * @returns {{ dir: string, source: string, commit: string }}
 */
function exportFramework(pkg, local) {
  let rev = [`refs/heads/${pkg.ref}`, `refs/remotes/origin/${pkg.ref}`].find(
    (candidate) =>
      gitOutput([
        "-C",
        local,
        "rev-parse",
        "--verify",
        "--quiet",
        `${candidate}^{commit}`,
      ]) !== null,
  );

  if (rev === undefined) {
    process.stderr.write(
      `[sync] ${pkg.name}: ${pkg.ref} missing in ${local}, fetching it from origin.\n`,
    );
    execFileSync("git", ["-C", local, "fetch", "--quiet", "origin", pkg.ref], {
      stdio: "inherit",
      env: GIT_ENV,
    });
    rev = "FETCH_HEAD";
  }

  const commit = gitOutput(["-C", local, "rev-parse", `${rev}^{commit}`]);
  const dir = path.join(CACHE_DIR, pkg.name);
  const archive = spawnSync(
    "git",
    ["-C", local, "archive", "--format=tar", rev, pkg.srcDir],
    {
      env: GIT_ENV,
      maxBuffer: 512 * 1024 * 1024,
    },
  );

  if (archive.status !== 0 || commit === null) {
    throw new Error(
      `${pkg.name}: git archive ${rev} ${pkg.srcDir} failed in ${local}: ${archive.stderr}`,
    );
  }

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const tar = spawnSync("tar", ["-x", "-C", dir], { input: archive.stdout });

  if (tar.status !== 0) {
    throw new Error(
      `${pkg.name}: extracting the archive into ${dir} failed: ${tar.stderr}`,
    );
  }

  return { dir, source: `local ${local} at ${rev} (${commit})`, commit };
}

/**
 * Returns the directory holding the package sources: the local checkout or a fresh shallow clone. A framework entry
 * is exported from its local clone (see {@link exportFramework}) or cloned sparsely (`<srcDir>` only).
 *
 * @returns {{ dir: string, source: string, commit: string }}
 */
function obtainSources(pkg, useLocal) {
  const local =
    useLocal && pkg.localPath ? path.resolve(ROOT, pkg.localPath) : null;
  const framework = pkg.type === "framework";

  if (local !== null) {
    if (framework && existsSync(path.join(local, ".git"))) {
      return exportFramework(pkg, local);
    }
    if (!framework && existsSync(path.join(local, "README.md"))) {
      const commit = gitOutput(["-C", local, "rev-parse", "HEAD"]) ?? "unknown";

      return {
        dir: local,
        source: `local ${local} (working tree)`,
        commit: `${commit}+worktree`,
      };
    }
    process.stderr.write(
      `[sync] ${pkg.name}: ${local} not found, cloning ${pkg.repo} instead.\n`,
    );
  }

  const dir = path.join(CACHE_DIR, pkg.name);
  const sparse = framework ? ["--filter=blob:none", "--sparse"] : [];
  const pinned = /^[a-f0-9]{40}$/i.test(pkg.ref);

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(CACHE_DIR, { recursive: true });
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      "--depth",
      "1",
      "--single-branch",
      ...sparse,
      ...(pinned ? ["--no-checkout"] : ["--branch", pkg.ref]),
      pkg.repo,
      dir,
    ],
    { stdio: ["ignore", "inherit", "inherit"], env: GIT_ENV },
  );

  if (pinned) {
    execFileSync(
      "git",
      ["-C", dir, "fetch", "--quiet", "--depth", "1", "origin", pkg.ref],
      { stdio: "inherit", env: GIT_ENV },
    );
    execFileSync(
      "git",
      ["-C", dir, "checkout", "--quiet", "--detach", "FETCH_HEAD"],
      { stdio: "inherit", env: GIT_ENV },
    );
  }

  if (framework) {
    execFileSync("git", ["-C", dir, "sparse-checkout", "set", pkg.srcDir], {
      stdio: "inherit",
      env: GIT_ENV,
    });
  }

  const commit = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();

  return { dir, source: `${pkg.repo}@${pkg.ref} (${commit})`, commit };
}

/**
 * Splits a line into prose and inline code spans; `transform` is applied to the prose parts only.
 */
function mapProse(line, transform) {
  return line
    .split(/(`+[^`]*?`+)/)
    .map((part, index) => (index % 2 === 1 ? part : transform(part)))
    .join("");
}

/**
 * Applies `transform` to every line outside code fences.
 *
 * @param {string[]} lines
 * @param {(line: string) => string} transform
 */
function mapOutsideFences(lines, transform) {
  let fence = null;

  return lines.map((line) => {
    const match = FENCE.exec(line);

    if (fence !== null) {
      if (
        match &&
        match[1][0] === fence[0] &&
        match[1].length >= fence.length
      ) {
        fence = null;
      }
      return line;
    }

    if (match) {
      fence = match[1];
      return line;
    }

    return transform(line);
  });
}

/**
 * Returns the index ranges `[start, end]` of the top-level HTML blocks that start with `<tag` outside code fences.
 */
function htmlBlocks(lines, tag) {
  const blocks = [];
  const open = new RegExp(`^\\s{0,3}<${tag}\\b`, "i");
  const close = new RegExp(`</${tag}>\\s*$`, "i");
  let fence = null;

  for (let index = 0; index < lines.length; index++) {
    const match = FENCE.exec(lines[index]);

    if (fence !== null) {
      if (
        match &&
        match[1][0] === fence[0] &&
        match[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }

    if (match) {
      fence = match[1];
      continue;
    }

    if (open.test(lines[index])) {
      let end = index;

      while (end < lines.length - 1 && !close.test(lines[end])) {
        end++;
      }
      blocks.push([index, end]);
      index = end;
    }
  }

  return blocks;
}

/** Decodes the few HTML entities used in READMEs. */
function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/**
 * Converts the raw HTML blocks GitHub renders but Starlight pages should not carry: `<picture>` becomes a Markdown
 * image (the wide `<source>` when present), `<p>` blocks with a heading, a logo or badges are dropped, and other
 * `<p>` blocks (taglines) become Markdown paragraphs.
 *
 * @returns {{ lines: string[], htmlTitle: string | null }}
 */
function convertHtmlBlocks(lines) {
  let htmlTitle = null;
  const replace = (tag, convert) => {
    for (const [start, end] of htmlBlocks(lines, tag).reverse()) {
      lines.splice(
        start,
        end - start + 1,
        ...convert(lines.slice(start, end + 1).join("\n")),
      );
    }
  };

  replace("p", (html) => {
    const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);

    if (heading) {
      htmlTitle ??= decodeEntities(heading[1].replace(/<[^>]+>/g, "").trim());
      return [];
    }

    if (/<(img|picture)\b/i.test(html)) {
      return [];
    }

    const markdown = decodeEntities(
      html
        .replace(/^\s*<p\b[^>]*>/i, "")
        .replace(/<\/p>\s*$/i, "")
        .replace(/<\/?strong>/gi, "**")
        .replace(/<\/?b>/gi, "**")
        .replace(/<\/?em>/gi, "_")
        .replace(/<\/?i>/gi, "_")
        .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
        .replace(/<br\s*\/?>/gi, "\n\n")
        .replace(/<[^>]+>/g, ""),
    );
    const paragraphs = markdown
      .split(/\n\s*\n/)
      .map((part) =>
        part
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "")
          .join(" "),
      )
      .filter((part) => part !== "");

    return paragraphs.flatMap((part, index) =>
      index === 0 ? [part] : ["", part],
    );
  });

  replace("picture", (html) => {
    const wide =
      /<source\b[^>]*media="[^"]*min-width[^"]*"[^>]*srcset="([^"\s]+)/i.exec(
        html,
      ) ??
      /<source\b[^>]*srcset="([^"\s]+)"[^>]*media="[^"]*min-width/i.exec(html);
    const img = /<img\b[^>]*>/i.exec(html)?.[0] ?? "";
    const src = wide?.[1] ?? /\bsrc="([^"]+)"/i.exec(img)?.[1];
    const alt = /\balt="([^"]*)"/i.exec(img)?.[1] ?? "";

    return src ? [`![${decodeEntities(alt)}](${src})`] : [];
  });

  return { lines, htmlTitle };
}

/**
 * Converts GitHub alerts (`> [!NOTE]`) into Starlight asides.
 */
function convertAlerts(lines) {
  const output = [];
  let fence = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = FENCE.exec(line);

    if (fence !== null) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence[0] &&
        fenceMatch[1].length >= fence.length
      ) {
        fence = null;
      }
      output.push(line);
      continue;
    }

    if (fenceMatch) {
      fence = fenceMatch[1];
      output.push(line);
      continue;
    }

    const alert =
      /^\s{0,3}>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(line);

    if (!alert) {
      output.push(line);
      continue;
    }

    output.push(ALERTS[alert[1].toUpperCase()]);

    while (index + 1 < lines.length && /^\s{0,3}>/.test(lines[index + 1])) {
      index++;
      output.push(lines[index].replace(/^\s{0,3}>\s?/, ""));
    }

    output.push(":::");
  }

  return output;
}

/**
 * Whether a Markdown image URL is a status/badge image: shields.io, poser.pugx.org (Packagist), Codecov graphs,
 * Stryker, StyleCI shields and any URL containing `badge`.
 */
function isBadgeImage(url) {
  return /img\.shields\.io|poser\.pugx\.org|badge|codecov\.io\/.*\/graph|stryker-mutator|styleci\.io\/repos\/\d+\/shield/i.test(
    url,
  );
}

/**
 * Drops badge-only lines; in call-to-action sections (social, sponsor, license) the badges become text links.
 * Sections left without content are removed with their heading.
 */
function convertBadges(lines) {
  const badge =
    /\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)|!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let section = "";

  const converted = mapOutsideFences(lines, (line) => {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);

    if (heading) {
      section = heading[1];
      return line;
    }

    const rest = line.replace(badge, "").trim();
    const badges = [...line.matchAll(badge)];

    if (
      rest !== "" ||
      badges.length === 0 ||
      !badges.every((match) => isBadgeImage(match[2] ?? match[5]))
    ) {
      return line;
    }

    if (!CALL_TO_ACTION.test(section)) {
      return "\u0000";
    }

    const links = badges
      .filter((match) => match[3] !== undefined)
      .map((match) => `[${match[1].trim() || match[3]}](${match[3]})`);

    return links.length > 0 ? links.join(" ") : "\u0000";
  }).filter((line) => line !== "\u0000");

  // Remove headings whose section became empty (only blank lines until the next heading of the same or higher level).
  const output = [];

  for (let index = 0; index < converted.length; index++) {
    const heading = /^(#{2,6})\s/.exec(converted[index]);

    if (heading) {
      let next = index + 1;

      while (next < converted.length && converted[next].trim() === "") {
        next++;
      }

      const nextHeading = /^(#{1,6})\s/.exec(converted[next] ?? "");

      if (
        next >= converted.length ||
        (nextHeading && nextHeading[1].length <= heading[1].length)
      ) {
        index = next - 1;
        continue;
      }
    }

    output.push(converted[index]);
  }

  return output;
}

/**
 * Builds the link rewriter of a package.
 *
 * @param {object} context
 * @param {string} context.sourceDir Package checkout.
 * @param {string} context.blobBase `https://github.com/<owner>/<repo>` without a trailing slash.
 * @param {string} context.ref
 * @param {string} context.docsDir
 * @param {Map<string, string>} context.pages Source path (relative to the package root) -> output file name.
 * @param {Set<string>} context.images Copied image paths relative to the package root.
 * @returns {(href: string, sourceFile: string) => string}
 */
export function linkRewriter({
  sourceDir,
  blobBase,
  ref,
  docsDir,
  pages,
  images,
}) {
  return (href, sourceFile) => {
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(href) ||
      href.startsWith("//") ||
      href.startsWith("#") ||
      href === ""
    ) {
      return href;
    }

    const match = /^([^?#]*)([?#].*)?$/.exec(href);
    const target = href.startsWith("/")
      ? path.posix.normalize(match[1].slice(1))
      : path.posix.normalize(
          path.posix.join(path.posix.dirname(sourceFile), match[1]),
        );
    const suffix = match[2] ?? "";

    if (target.startsWith("../")) {
      process.stderr.write(
        `[sync] ${sourceFile}: link "${href}" points outside the package; left as is.\n`,
      );
      return href;
    }

    if (pages.has(target)) {
      return `${pages.get(target)}${suffix}`;
    }

    if (images.has(target)) {
      return `./${path.posix.relative(docsDir, target)}${suffix}`;
    }

    const absolute = path.join(sourceDir, target);
    const kind =
      existsSync(absolute) && statSync(absolute).isDirectory()
        ? "tree"
        : "blob";
    const clean = target === "." ? "" : `/${target.replace(/\/$/, "")}`;

    return `${blobBase}/${kind}/${ref}${clean}${suffix}`;
  };
}

/**
 * Rewrites the links of Markdown prose lines: inline links and images, reference definitions and raw HTML
 * `href`/`src`/`srcset` attributes. Code fences and inline code are left untouched.
 */
function rewriteLinks(lines, rewrite) {
  return mapOutsideFences(lines, (line) => {
    const definition = /^(\s{0,3}\[[^\]]+\]:\s*)(\S+)(.*)$/.exec(line);

    if (definition && !definition[1].startsWith("[[")) {
      return `${definition[1]}${rewrite(definition[2])}${definition[3]}`;
    }

    return mapProse(line, (part) =>
      part
        .replace(
          INLINE_LINK,
          (_all, href, title) => `](${rewrite(href)}${title})`,
        )
        .replace(
          /(\s(?:href|src|srcset)=")([^"]*)(")/g,
          (_all, open, href, close) => `${open}${rewrite(href)}${close}`,
        ),
    );
  });
}

/**
 * Removes single-line HTML comments (markdownlint directives) outside code fences.
 */
function dropComments(lines) {
  return mapOutsideFences(lines, (line) =>
    /^\s*<!--.*-->\s*$/.test(line) ? "\u0000" : line,
  ).filter((line) => line !== "\u0000");
}

/**
 * Removes the first H1 outside code fences and returns its text.
 *
 * @returns {{ lines: string[], title: string | null }}
 */
function extractTitle(lines) {
  let title = null;
  let fence = null;
  const output = [];

  for (const line of lines) {
    const match = FENCE.exec(line);

    if (fence !== null) {
      if (
        match &&
        match[1][0] === fence[0] &&
        match[1].length >= fence.length
      ) {
        fence = null;
      }
      output.push(line);
      continue;
    }

    if (match) {
      fence = match[1];
      output.push(line);
      continue;
    }

    const heading = /^#\s+(.+?)\s*#*\s*$/.exec(line);

    if (title === null && heading) {
      title = heading[1];
      continue;
    }

    output.push(line);
  }

  return { lines: output, title };
}

/** Collapses runs of blank lines and trims the body. */
function tidy(lines) {
  const output = [];

  for (const line of lines.map((value) => value.replace(/\s+$/, ""))) {
    if (line === "" && (output.length === 0 || output.at(-1) === "")) {
      continue;
    }
    output.push(line);
  }

  while (output.at(-1) === "") {
    output.pop();
  }

  return output;
}

/**
 * Returns the frontmatter block of a generated page.
 */
function frontmatter({
  title,
  description,
  order,
  label,
  editUrl,
  generatedFrom,
}) {
  const lines = [
    "---",
    `# Generated by scripts/sync.mjs from ${generatedFrom}; edit the package repository instead.`,
    `title: ${yamlQuote(title)}`,
    `description: ${yamlQuote(description)}`,
    `editUrl: ${yamlQuote(editUrl)}`,
    "sidebar:",
  ];

  if (label) {
    lines.push(`  label: ${yamlQuote(label)}`);
  }

  lines.push(`  order: ${order}`, "---");

  return lines.join("\n");
}

/**
 * Converts one package file to a Starlight page.
 *
 * @returns {string} The page source (frontmatter and body).
 */
export function convertPage(source, options) {
  const {
    sourceFile,
    fallbackTitle,
    packageTitle,
    rewrite,
    order,
    label,
    editUrl,
    generatedFrom,
    extra,
  } = options;
  let lines = source.replace(/\r\n?/g, "\n").split("\n");

  lines = dropComments(lines);
  const html = convertHtmlBlocks(lines);
  lines = convertAlerts(html.lines);
  lines = convertBadges(lines);
  const extracted = extractTitle(lines);
  const title = fallbackTitle ?? extracted.title ?? html.htmlTitle;

  if (!title) {
    throw new Error(`${sourceFile}: no H1 to use as the page title.`);
  }

  lines = rewriteLinks(extracted.lines, (href) => rewrite(href, sourceFile));
  lines = tidy([...lines, ...(extra ?? [])]);

  const body = lines.join("\n");
  let description = describe(body);

  // A page without prose (a bare list or table) must not break the nightly build: fall back to the titles.
  if (description === null) {
    description = `${title} of the ${packageTitle} extension.`;
    process.stderr.write(
      `[sync] ${sourceFile}: no paragraph usable as description; using "${description}".\n`,
    );
  }

  return `${frontmatter({ title, description, order, label, editUrl, generatedFrom })}\n\n${body}\n`;
}

/** Renders repository-owned skills as guide pages while keeping portable bundles unchanged. */
export function syncFrameworkSkillPages(root, names, source = null) {
  const navigation = JSON.parse(
    readFileSync(path.join(root, "skills/navigation.json"), "utf8"),
  );
  const listed = navigation.map(({ name }) => name);
  if (
    new Set(listed).size !== listed.length ||
    [...names].sort().join("\n") !== [...listed].sort().join("\n")
  ) {
    throw new Error(
      "Every framework skill must have exactly one navigation entry.",
    );
  }
  const output = path.join(root, "src/content/docs/guide/skills");
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const { name, label, after } of navigation) {
    const folder = path.join(source?.dir ?? root, "skills", name);
    const original = readFileSync(path.join(folder, "SKILL.md"), "utf8");
    const body = original.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
    const page = convertPage(body, {
      sourceFile: "SKILL.md",
      fallbackTitle: `Skill: ${label}`,
      packageTitle: "Yii framework",
      order: 0,
      editUrl: `${source?.repo ?? "https://github.com/yii2-framework/docs"}/edit/${source?.ref ?? "main"}/skills/${name}/SKILL.md`,
      generatedFrom: `skills/${name}/SKILL.md`,
      rewrite: (href) => {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return href;
        const resource = href.split(/[?#]/, 1)[0];
        if (
          !safeRelativeDirectory(resource) ||
          !existsSync(path.join(folder, resource))
        ) {
          throw new Error(`${name}: missing portable skill resource ${href}`);
        }
        return `/docs/skills/${name}/${href}`;
      },
      extra: [
        "",
        "## Install and activate this skill",
        "",
        `Select \`${name}\` in the [installation and client verification guide](../../project/ai-agents.md#install-the-relevant-skill).`,
        `Complete the [one-time Composer setup](../../project/ai-agents.md#composer-installation). The common \`yii2-extensions/skill\` package installs all twenty framework skills; no separate installer is needed for \`${name}\`.`,
        "",
        "```bash",
        "composer install",
        "composer skills:show",
        "```",
        "",
        "### Optional npx installation",
        "",
        "```bash",
        `npx skills@1.7.2 add yii2-extensions/skill --skill ${name} --agent codex`,
        "```",
        "",
        `Install the complete bundle, including referenced resources. The [canonical SKILL.md](/docs/skills/${name}/SKILL.md) is also available for direct reading.`,
        "",
        `Continue with the [related framework guide](../../${after}.md).`,
      ],
    });
    writeFileSync(path.join(output, `${name}.md`), page);
  }
  return listed;
}

/**
 * Returns the "Package" section appended to the landing page: repository, Composer package (or, for a template
 * repository, the GitHub link that creates a repository from it) and changelog.
 *
 * @param {{ packagist: string, status?: string }} pkg Manifest entry.
 * @param {string} blobBase `https://github.com/<owner>/<repo>` without a trailing slash.
 * @param {string} ref
 * @param {boolean} changelog Whether the package has a `CHANGELOG.md`.
 * @returns {string[]}
 */
export function packageSection(pkg, blobBase, ref, changelog) {
  return [
    "",
    "## Package",
    "",
    `- Source code and issues: [${blobBase.replace(/^https:\/\/github\.com\//, "")}](${blobBase}). ` +
      "Star the repository if the package is useful to you.",
    ...(pkg.type === "tool"
      ? []
      : [
          pkg.status === "template"
            ? `- Template repository: [create a package from it](${blobBase}/generate) on GitHub.`
            : `- Composer package: [${pkg.packagist}](https://packagist.org/packages/${pkg.packagist}).`,
        ]),
    ...(changelog
      ? [`- Changelog: [CHANGELOG.md](${blobBase}/blob/${ref}/CHANGELOG.md).`]
      : []),
  ];
}

/** Lists files under `dir` recursively, as POSIX paths relative to `dir`, sorted. */
function listFiles(dir, base = dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const file = path.join(dir, name);

      return statSync(file).isDirectory()
        ? listFiles(file, base)
        : [path.relative(base, file).split(path.sep).join("/")];
    });
}

/**
 * Compares the `name` in the package `composer.json` with the manifest `packagist` value.
 *
 * @param {string} dir Package checkout.
 * @param {string} expected Manifest `packagist` value, e.g. `yii2-extensions/bootstrap6`.
 * @returns {string | null} `null` when the names match, otherwise the name found (`(no composer.json)` or
 * `(invalid composer.json)` when it cannot be read).
 */
export function packageNameMismatch(dir, expected) {
  const file = path.join(dir, "composer.json");

  if (!existsSync(file)) {
    return "(no composer.json)";
  }

  let found;

  try {
    found = JSON.parse(readFileSync(file, "utf8")).name;
  } catch {
    return "(invalid composer.json)";
  }

  return found === expected ? null : String(found);
}

/**
 * Returns the page names listed in a manifest `order` that the package does not have, in `order` sequence.
 *
 * @param {string[]} order Page names from `packages.json`, without `.md`.
 * @param {string[]} markdown Guide files found in the docs directory, relative to it.
 * @returns {string[]}
 */
export function missingOrderPages(order, markdown) {
  const names = new Set(
    markdown.map((file) => file.replace(/\.md$/i, "").toLowerCase()),
  );

  return order.filter((name) => !names.has(name));
}

/**
 * Syncs one package into `src/content/docs/extensions/<name>/`; a framework entry only gets its sources.
 *
 * @returns {{ pages: number, images: number, source: string, dir: string, commit: string }
 *   | { skipped: string, source: string, dir: string, commit: string }}
 */
export function syncPackage(pkg, useLocal) {
  const { dir, source, commit } = obtainSources(pkg, useLocal);
  const framework = pkg.type === "framework";
  const found =
    pkg.type === "tool"
      ? null
      : packageNameMismatch(
          framework ? path.join(dir, pkg.srcDir) : dir,
          pkg.packagist,
        );

  if (found !== null) {
    return {
      skipped: `sources at ${pkg.ref} are "${found}", expected "${pkg.packagist}"`,
      source,
      dir,
      commit,
    };
  }

  if (framework) {
    return { pages: 0, images: 0, source, dir, commit };
  }

  const docsDir = pkg.docsDir.replace(/^\.\/|\/$/g, "");
  const docsPath = path.join(dir, docsDir);
  const docsFiles = existsSync(docsPath) ? listFiles(docsPath) : [];
  const markdown = docsFiles.filter(
    (file) => /^[^/]+\.md$/i.test(file) && !/^readme\.md$/i.test(file),
  );
  const images = new Set(
    docsFiles
      .filter((file) => IMAGE.test(file))
      .map((file) => `${docsDir}/${file}`),
  );
  const pages = new Map([["README.md", "index.md"]]);

  for (const file of markdown) {
    pages.set(`${docsDir}/${file}`, file.toLowerCase());
  }

  const blobBase = pkg.repo.replace(/\.git$/, "").replace(/\/$/, "");
  const rewrite = linkRewriter({
    sourceDir: dir,
    blobBase,
    ref: pkg.ref,
    docsDir,
    pages,
    images,
  });
  const order = pkg.order ?? DEFAULT_ORDER;

  // A stale `order` entry (a guide the package removed) only costs a sidebar slot: warn, do not fail the build.
  for (const name of pkg.order === undefined
    ? []
    : missingOrderPages(pkg.order, markdown)) {
    process.stderr.write(
      `[sync] ${pkg.name}: "order" lists "${name}", but ${docsDir}/${name}.md does not exist.\n`,
    );
  }

  const outDir = path.join(
    pkg.type === "tool" ? TOOLS_OUTPUT_DIR : OUTPUT_DIR,
    pkg.name,
  );
  const generatedFrom = `${blobBase}@${pkg.ref}`;
  const rank = (name) => {
    const index = order.indexOf(name);

    return index === -1
      ? 100 + markdown.map((file) => file.replace(/\.md$/i, "")).indexOf(name)
      : index + 1;
  };
  const extra = packageSection(
    pkg,
    blobBase,
    pkg.ref,
    existsSync(path.join(dir, "CHANGELOG.md")),
  );

  mkdirSync(outDir, { recursive: true });

  for (const [sourceFile, outName] of pages) {
    const isIndex = outName === "index.md";
    const page = convertPage(readFileSync(path.join(dir, sourceFile), "utf8"), {
      sourceFile,
      fallbackTitle: isIndex ? pkg.title : null,
      packageTitle: pkg.title,
      rewrite,
      order: isIndex ? 0 : rank(outName.replace(/\.md$/, "")),
      label: isIndex ? "Overview" : null,
      editUrl: `${blobBase}/edit/${pkg.ref}/${sourceFile}`,
      generatedFrom,
      extra: isIndex ? extra : null,
    });

    writeFileSync(path.join(outDir, outName), page);
  }

  for (const image of images) {
    const target = path.join(outDir, path.posix.relative(docsDir, image));

    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(dir, image), target);
  }

  return { pages: pages.size, images: images.size, source, dir, commit };
}

function main(argv) {
  const useLocal = argv.includes("--local") || process.env.SYNC_LOCAL === "1";
  const strict = argv.includes("--strict");
  const manifestArg = argv.find((arg) => arg.startsWith("--manifest="));
  const manifestFile = manifestArg
    ? path.resolve(manifestArg.slice("--manifest=".length))
    : path.join(ROOT, "packages.json");
  const toolsArg = argv.find((arg) => arg.startsWith("--tools-manifest="));
  // Custom package manifests used by callers/tests are isolated unless tools are explicitly requested.
  const toolsFile = toolsArg
    ? path.resolve(toolsArg.slice("--tools-manifest=".length))
    : manifestArg || !existsSync(path.join(ROOT, "tools.json"))
      ? null
      : path.join(ROOT, "tools.json");
  const entries = JSON.parse(readFileSync(manifestFile, "utf8"));
  if (toolsFile !== null) {
    const tools = validateManifest(
      JSON.parse(readFileSync(toolsFile, "utf8")),
      path.relative(ROOT, toolsFile),
    );
    if (tools.some((entry) => entry.type !== "tool"))
      throw new Error(`${toolsFile}: expected tool entries only.`);
    entries.push(...tools);
  }
  const packages = validateManifest(entries, path.relative(ROOT, manifestFile));
  const common = manifestArg
    ? null
    : JSON.parse(
        readFileSync(path.join(ROOT, "framework-skills.json"), "utf8"),
      );
  if (!manifestArg) {
    if (
      common === null ||
      typeof common !== "object" ||
      Array.isArray(common)
    ) {
      throw new Error("framework-skills.json: expected an object.");
    }
    for (const key of ["name", "repo", "ref", "skillsDir"]) {
      if (typeof common[key] !== "string" || common[key].trim() === "") {
        throw new Error(`framework-skills.json: missing ${key}`);
      }
    }
    if (
      common.localPath !== undefined &&
      (typeof common.localPath !== "string" || common.localPath.trim() === "")
    ) {
      throw new Error(
        "framework-skills.json: localPath must be a non-empty string when supplied.",
      );
    }
  }

  // The whole directory is generated: start from scratch so removed pages and packages disappear.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  rmSync(TOOLS_OUTPUT_DIR, { recursive: true, force: true });
  rmSync(SKILLS_CACHE, { recursive: true, force: true });
  rmSync(SKILLS_PUBLIC, { recursive: true, force: true });
  const skills = {};

  // Common bundles come only from the owning package, with site-owned navigation.
  let commonSource = null;
  if (common !== null) {
    commonSource = {
      ...common,
      ...obtainSources({ ...common, type: "tool" }, useLocal),
    };
    const frameworkNames = syncSkills(
      { ...common, name: "yii2-extensions/skill" },
      commonSource.dir,
      {
        cacheDir: SKILLS_CACHE,
        publicDir: SKILLS_PUBLIC,
        registry: skills,
        commit: commonSource.commit,
        source: commonSource.source,
      },
    );
    syncFrameworkSkillPages(ROOT, frameworkNames, commonSource);
  }

  let skipped = 0;
  const sources = {};

  for (const pkg of packages) {
    const result = syncPackage(pkg, useLocal);

    sources[pkg.name] = {
      type: pkg.type ?? "package",
      dir: path.relative(ROOT, result.dir).split(path.sep).join("/"),
      ref: pkg.ref,
      commit: result.commit,
      source: result.source,
      skipped: "skipped" in result ? result.skipped : null,
    };

    if ("skipped" in result) {
      // Greppable: `[sync] skipped <name>: ...`. No page is written, so the sidebar hides the package.
      process.stderr.write(
        `[sync] skipped ${pkg.name}: ${result.skipped} (${result.source}).\n`,
      );
      skipped++;
      continue;
    }

    if (pkg.type === "framework") {
      process.stdout.write(
        `[sync] ${pkg.name}: sources only (${pkg.srcDir}) from ${result.source}.\n`,
      );
      continue;
    }

    const names = syncSkills(pkg, result.dir, {
      cacheDir: SKILLS_CACHE,
      publicDir: SKILLS_PUBLIC,
      registry: skills,
      commit: result.commit,
      source: result.source,
    });
    process.stdout.write(
      `[sync] ${pkg.name}: ${result.pages} pages, ${result.images} images, ${names.length} skills from ${result.source}.\n`,
    );
  }

  for (const dir of [SKILLS_CACHE, SKILLS_PUBLIC]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "index.json"),
      `${JSON.stringify({ generated: true, skills }, null, 2)}\n`,
    );
  }

  // Input of tools/bin/reference: which sources this run used.
  mkdirSync(path.dirname(SOURCES_FILE), { recursive: true });
  writeFileSync(
    SOURCES_FILE,
    `${JSON.stringify(
      {
        mode: useLocal ? "local" : "clone",
        commonSkills: commonSource,
        manifest: path.relative(ROOT, manifestFile).split(path.sep).join("/"),
        packages: sources,
      },
      null,
      2,
    )}\n`,
  );

  if (skipped > 0 && strict) {
    throw new Error(`${skipped} package(s) skipped (--strict).`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `[sync] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

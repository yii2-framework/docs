import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { packages, topics as catalogTopics } from "../src/lib/catalog.mjs";
import { loadHosting } from "../src/lib/hosting.mjs";
import {
  HUB_PLACEHOLDERS,
  hubMarkdown,
  replaceHubPlaceholders,
} from "../src/lib/hub.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("../packages.json", import.meta.url), "utf8"),
).filter(({ type }) => type !== "framework");

// A small project: `demo` (synced, demos, skill, nine pages), `later` (not synced), `alpha` (synced, landing page only)
// and the tool `box`.
const root = mkdtempSync(path.join(tmpdir(), "hub-"));
const write = (file, content) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
};
const page = (title, description = "") =>
  `---\ntitle: "${title}"\n${description ? `description: "${description}"\n` : ""}---\n`;

write(
  "packages.json",
  JSON.stringify([
    { name: "yii2", type: "framework", packagist: "yiisoft/yii2" },
    {
      name: "demo",
      title: "Demo",
      status: "published",
      packagist: "vendor/demo",
      order: [
        "installation",
        "configuration",
        "examples",
        "uploads",
        "migration",
        "agents",
        "testing",
      ],
      demos: true,
      skillsDir: "skills",
    },
    {
      name: "later",
      title: "Later",
      status: "published",
      packagist: "vendor/later",
    },
    {
      name: "alpha",
      title: "Alpha",
      status: "published",
      packagist: "vendor/alpha",
    },
  ]),
);
write(
  "tools.json",
  JSON.stringify([{ name: "box", title: "Box", order: ["installation"] }]),
);
write(
  "public/skills/index.json",
  JSON.stringify({ skills: { "demo-skill": { package: "demo" } } }),
);
write(
  "src/content/docs/extensions/demo/index.md",
  page("Demo", "Demo widgets for *Yii2* forms"),
);
for (const [slug, title] of [
  ["installation", "Installation guide"],
  ["configuration", "Configuration guide"],
  ["examples", "Usage examples"],
  ["uploads", "Receive and store uploads"],
  ["migration", "Migration guide"],
  ["agents", "AI assistance"],
  ["testing", "Testing"],
]) {
  write(`src/content/docs/extensions/demo/${slug}.md`, page(title));
}
write("src/content/docs/extensions/demo/reference/index.md", page("Reference"));
write("src/content/docs/extensions/alpha/index.md", page("Alpha", "Alpha."));
write("src/content/docs/development-tools/box/index.md", page("Box", "Boxes."));
write(
  "src/content/docs/development-tools/box/installation.md",
  page("Install a box"),
);

const hosting = loadHosting({ root });
const record = (name, topic) => ({
  id: `vendor/${name}`,
  name: name[0].toUpperCase() + name.slice(1),
  family: "yii2-extensions",
  topic,
});
const records = [
  record("demo", "widgets"),
  record("later", "later"),
  record("alpha", "widgets"),
];
const topics = [
  { id: "empty", title: "Empty", summary: "No package yet." },
  { id: "widgets", title: "Widgets", summary: "Form widgets." },
  { id: "later", title: "Later", summary: "Not synced yet." },
];

after(() => rmSync(root, { recursive: true, force: true }));

describe("hubMarkdown", () => {
  test("lists each synced package once under its catalog topic with relative .md links", () => {
    const result = hubMarkdown("extensions", {
      hosting,
      topics,
      records,
      base: "/docs",
    });

    assert.match(result, /^### Widgets\n\nForm widgets\.\n\n- \*\*\[Alpha\]/);
    assert.ok(
      result.includes(
        "- **[Demo](extensions/demo/index.md)**: Demo widgets for \\*Yii2\\* forms.",
      ),
    );
    assert.equal((result.match(/^- \*\*/gm) ?? []).length, 2);
    assert.ok(!result.includes("### Later"), "an unsynced topic is skipped");
    assert.ok(!result.includes("### Empty"), "an empty topic is skipped");

    const row = result.split("\n").at(-1);
    const links = [...row.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];

    assert.ok(row.startsWith("  ["), "the link row is a second paragraph");
    assert.equal(links.length, 7);
    assert.deepEqual(
      links.map(([, label]) => label),
      [
        "Install",
        "Configure",
        "Examples, live demos",
        "Receive and store uploads",
        "API reference",
        "Agent skill",
        "Package entry",
      ],
    );
    assert.deepEqual(
      links.map(([, , href]) => href),
      [
        "extensions/demo/installation.md",
        "extensions/demo/configuration.md",
        "extensions/demo/examples.md",
        "extensions/demo/uploads.md",
        "extensions/demo/reference/index.md",
        "/docs/skills/demo-skill/SKILL.md",
        "/docs/packages/vendor/demo/",
      ],
    );
    assert.ok(
      hubMarkdown("extensions", {
        hosting,
        topics,
        records,
        markdown: true,
      }).includes("(/packages/vendor/demo/index.md)"),
    );
  });

  test("topics keep their order and the packages of a topic follow the display order", () => {
    const result = hubMarkdown("extensions", {
      hosting,
      topics: [...topics].reverse(),
      records: [record("demo", "later"), records[1], records[2]],
    });

    assert.deepEqual(result.match(/^(?:###|- \*\*).*$/gm), [
      "### Later",
      "- **[Demo](extensions/demo/index.md)**: Demo widgets for \\*Yii2\\* forms.",
      "### Widgets",
      "- **[Alpha](extensions/alpha/index.md)**: Alpha.",
    ]);
  });

  test("a hosted extension without a catalog record or with an unknown topic throws", () => {
    assert.throws(
      () =>
        hubMarkdown("extensions", {
          hosting,
          topics,
          records: records.slice(0, 2),
        }),
      /\[hub\] alpha \(vendor\/alpha\) has no catalog record/,
    );
    assert.throws(
      () =>
        hubMarkdown("extensions", {
          hosting,
          topics: topics.slice(0, 2),
          records,
        }),
      /\[hub\] later \(vendor\/later\) has the topic "later", which is not in src\/data\/catalog-topics\.json/,
    );
    assert.throws(() => hubMarkdown("other", { hosting }), /unknown section/);
  });

  test("the tools section lists each development tool with its pages", () => {
    const result = hubMarkdown("tools", { hosting });

    assert.equal(
      result,
      "- **[Box](development-tools/box/index.md)**: Boxes.\n\n" +
        "  [Install](development-tools/box/installation.md)",
    );
  });

  test("placeholders in a Markdown body are replaced and other text is kept", () => {
    const body = `Intro\n\n${HUB_PLACEHOLDERS.tools}\n\n<!-- other -->\n`;

    assert.equal(
      replaceHubPlaceholders(body, { hosting }),
      `Intro\n\n${hubMarkdown("tools", { hosting })}\n\n<!-- other -->\n`,
    );
    assert.equal(
      replaceHubPlaceholders("No hub here.", { hosting }),
      "No hub here.",
    );
  });
});

describe("catalog topics in the hub", () => {
  test("every non-framework package of packages.json has a catalog record with a known topic", () => {
    const known = new Set(catalogTopics.map(({ id }) => id));
    const unplaced = manifest
      .filter(({ packagist }) => {
        const pkg = packages.find(({ id }) => id === packagist);

        return pkg === undefined || !known.has(pkg.topic);
      })
      .map(({ name }) => name);

    assert.deepEqual(unplaced, []);
  });

  test("the repository hub keeps the extension topic headings in catalog order", () => {
    const headings = hubMarkdown("extensions").match(/^### .+$/gm);
    const titles = catalogTopics.map(({ title }) => `### ${title}`);

    assert.deepEqual(
      headings,
      titles.filter((title) => headings.includes(title)),
    );
    for (const title of [
      "Forms and widgets",
      "Routing, languages and frontend",
      "Data modelling",
      "Application servers and workers",
      "Quality and debugging",
      "Build your own extension",
    ]) {
      assert.ok(headings.includes(`### ${title}`), title);
    }
  });

  test("the repository hub and tools sections generate without errors", () => {
    const extensions = hubMarkdown("extensions", { base: "/docs" });
    const tools = hubMarkdown("tools", { base: "/docs" });

    for (const [, href] of extensions.matchAll(/\]\((extensions\/[^)]+)\)/g)) {
      assert.match(
        href,
        /^extensions\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.md$/,
      );
    }
    assert.ok(typeof tools === "string");
  });
});

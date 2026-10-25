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
import { loadHosting } from "../src/lib/hosting.mjs";
import {
  HUB_PLACEHOLDERS,
  hubMarkdown,
  loadTopics,
  replaceHubPlaceholders,
} from "../src/lib/hub.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("../packages.json", import.meta.url), "utf8"),
).filter(({ type }) => type !== "framework");

// A small project: `demo` (synced, demos, skill, nine pages), `later` (not synced) and the tool `box`.
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
write("src/content/docs/development-tools/box/index.md", page("Box", "Boxes."));
write(
  "src/content/docs/development-tools/box/installation.md",
  page("Install a box"),
);

const hosting = loadHosting({ root });
const records = [{ id: "vendor/demo" }];
const topics = [
  { title: "Widgets", summary: "Form widgets.", packages: ["demo"] },
  { title: "Later", summary: "Not synced yet.", packages: ["later"] },
];

after(() => rmSync(root, { recursive: true, force: true }));

describe("hubMarkdown", () => {
  test("lists each synced package once under its topic with relative .md links", () => {
    const result = hubMarkdown("extensions", {
      hosting,
      topics,
      records,
      base: "/docs",
    });

    assert.match(result, /^### Widgets\n\nForm widgets\.\n\n- \*\*\[Demo\]/);
    assert.ok(
      result.includes(
        "- **[Demo](extensions/demo/index.md)**: Demo widgets for \\*Yii2\\* forms.",
      ),
    );
    assert.equal((result.match(/^- \*\*/gm) ?? []).length, 1);
    assert.ok(!result.includes("### Later"), "an unsynced topic is skipped");

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

  test("a package missing from the topics or an unknown topic package throws", () => {
    assert.throws(
      () =>
        hubMarkdown("extensions", {
          hosting,
          topics: [topics[0]],
          records,
        }),
      /missing from src\/data\/documentation-topics\.json: later/,
    );
    assert.throws(
      () =>
        hubMarkdown("extensions", {
          hosting,
          topics: [...topics, { title: "X", summary: "", packages: ["ghost"] }],
          records,
        }),
      /topic "X" names "ghost"/,
    );
    assert.throws(
      () =>
        hubMarkdown("extensions", {
          hosting,
          topics: [...topics, { title: "Y", summary: "", packages: ["demo"] }],
          records,
        }),
      /"demo" is in two topics/,
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

describe("documentation topics", () => {
  test("every non-framework package of packages.json is in exactly one topic", () => {
    const listed = loadTopics().flatMap((topic) => topic.packages);

    assert.deepEqual(
      [...listed].sort(),
      manifest.map(({ name }) => name).sort(),
    );
    for (const topic of loadTopics()) {
      assert.ok(topic.title.length > 0 && topic.summary.length > 0);
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

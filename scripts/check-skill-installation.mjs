import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function installationErrors(markdown) {
  const errors = [];
  const composer = markdown.search(
    /\bcomposer (?:install|require|skills:add)\b/,
  );
  const npx = markdown.search(/\bnpx skills(?:@[^\s]+)?\s+add\b/);
  const optional = markdown.search(/^### Optional npx installation\s*$/m);
  if (composer < 0)
    errors.push("missing the automatic Composer installation path");
  if (npx >= 0 && (optional < 0 || npx < optional || composer > npx)) {
    errors.push(
      "npx is presented before its optional section or before Composer",
    );
  }
  return errors;
}

export function checkSkillInstallation(
  root = ROOT,
  dist = path.join(root, "dist"),
) {
  const index = JSON.parse(
    readFileSync(path.join(root, "public/skills/index.json"), "utf8"),
  );
  const manifests = ["packages.json", "tools.json"].flatMap((name) =>
    JSON.parse(readFileSync(path.join(root, name), "utf8")),
  );
  const rows = [];
  for (const [name, entry] of Object.entries(index.skills)) {
    const framework = ["yii2-extensions/skill", "yii2-docs"].includes(
      entry.package,
    );
    const owner = manifests.find((candidate) => candidate.repo === entry.repo);
    if (!framework && !owner)
      throw new Error(`${name}: missing owner in the site manifests`);
    const route = framework
      ? `guide/skills/${name}`
      : `${owner.type === "tool" ? "development-tools" : "extensions"}/${owner.name}/agents`;
    const file = path.join(dist, route, "index.md");
    if (!existsSync(file))
      throw new Error(`${name}: missing published Markdown ${route}`);
    const errors = installationErrors(readFileSync(file, "utf8"));
    for (const [resource, expected] of Object.entries(entry.files)) {
      for (const output of [
        path.join(root, ".cache/skills"),
        path.join(root, "public/skills"),
        path.join(dist, "skills"),
      ]) {
        const copied = path.join(output, name, resource);
        if (
          !existsSync(copied) ||
          createHash("sha256").update(readFileSync(copied)).digest("hex") !==
            expected
        ) {
          errors.push(`resource does not match provenance: ${copied}`);
        }
      }
    }
    rows.push({ name, owner: entry.package, ref: entry.ref, route, errors });
  }
  const errors = rows.filter((row) => row.errors.length > 0);
  if (errors.length)
    throw new Error(
      errors.map((row) => `${row.name}: ${row.errors.join("; ")}`).join("\n"),
    );
  return rows;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const rows = checkSkillInstallation();
    const report = process.argv.find((arg) => arg.startsWith("--report="));
    if (report)
      writeFileSync(
        report.slice("--report=".length),
        JSON.stringify(rows, null, 2) + "\n",
      );
    console.log(
      `Verified ${rows.length} published skill routes, Composer-first instructions and complete bundle hashes.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

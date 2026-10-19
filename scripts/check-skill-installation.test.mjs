import assert from "node:assert/strict";
import { test } from "node:test";
import { installationErrors } from "./check-skill-installation.mjs";

test("rejects the stale FrankenPHP installer section that caused the regression", () => {
  const old =
    "## Install in an application\n\nFrom the application root, list and install the skill from a package checkout or Composer installation:\n\n```bash\nnpx skills@1.7.2 add ./vendor/yii2-extensions/franken-php --list\n```\n";
  assert.equal(installationErrors(old).length, 2);
});

test("accepts automatic package and explicit Git bootstrap paths with optional npx", () => {
  for (const command of [
    "composer install",
    "composer skills:add yii2-extensions/docker-images --ref=main",
  ]) {
    assert.deepEqual(
      installationErrors(
        `## Install\n\n${command}\n\n### Optional npx installation\n\nnpx skills@1.7.2 add example/repo`,
      ),
      [],
    );
  }
});

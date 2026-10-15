import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

// The caller supplies a writable disposable app with FilePond installed. No package installation or network here.
const app = process.env.EVAL_TEST_APP;
const viewRelative = 'resources/views/site/_avatar.php';
const modelRelative = 'src/models/UploadForm.php';
const fixture = path.resolve('eval/fixtures/pass/11-filepond-avatar/files');
const view = readFileSync(path.join(fixture, viewRelative), 'utf8');
const model = readFileSync(path.join(fixture, modelRelative), 'utf8');
const originals = new Map();
if (app) {
  const directory = realpathSync(app);
  assert.ok(directory.startsWith(`${realpathSync(tmpdir())}${path.sep}`), 'EVAL_TEST_APP must be a disposable app under the temp directory');
  for (const relative of [viewRelative, modelRelative]) {
    const file = path.join(app, relative);
    originals.set(file, existsSync(file) ? readFileSync(file) : null);
    mkdirSync(path.dirname(file), { recursive: true });
  }
}
after(() => {
  for (const [file, content] of originals) {
    if (content === null) rmSync(file, { force: true });
    else writeFileSync(file, content);
  }
});

function probe(name, changedModel = model, changedView = view) {
  writeFileSync(path.join(app, modelRelative), changedModel);
  writeFileSync(path.join(app, viewRelative), changedView);
  return spawnSync('php', ['eval/lib/probe.php', app, name,
    name === 'filepond-widget' ? viewRelative : 'app\\models\\UploadForm'], { encoding: 'utf8' });
}

test('FilePond reference solution passes real widget options and byte-derived MIME/storage probes', { skip: !app }, () => {
  for (const name of ['filepond-widget', 'filepond-upload']) {
    const result = probe(name);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
});

test('effective config overriding the typed client transform is rejected', { skip: !app }, () => {
  const result = probe('filepond-widget', model, view.replace("'config' => ['imageEditInstantEdit' => true]",
    "'config' => ['imageEditInstantEdit' => true, 'allowImageTransform' => false]"));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /effective allowImageTransform is not true/);
});

test('omitting byte MIME validation is rejected even with filename restrictions', { skip: !app }, () => {
  const result = probe('filepond-upload', model.replace("                'mimeTypes' => ['image/jpeg', 'image/png', 'image/webp'],\n", ''));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /validation accepted forged HTML MIME/);
});

test('writing a decoded rejected image before validation is detected', { skip: !app }, () => {
  const changed = model.replace('        if (!$this->validate()) {',
    "        $payload = is_string($this->avatar) ? json_decode($this->avatar, true) : null;\n"
    + "        if (is_array($payload) && is_string($payload['data'] ?? null) && base64_decode($payload['data'], true) !== false) {\n"
    + "            $file = EncodedFile::fromInput($this->avatar)[0];\n"
    + "            (new FileSaver($directory))->save($file, 'avatar');\n"
    + '        }\n\n        if (!$this->validate()) {');
  const result = probe('filepond-upload', changed);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /invalid forged HTML MIME was stored/);
});

test('square initial ratio with unrestricted editor presets is rejected', { skip: !app }, () => {
  const result = probe('filepond-widget', model, view.replace("    'cropper' => ['aspectRatios' => ['1:1']],\n", ''));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /only the square crop preset/);
});

test('equivalent effective numeric size and square ratios satisfy the same consumer contract', { skip: !app }, () => {
  const changed = view.replace("'imageCropAspectRatio' => '1:1'", "'imageCropAspectRatio' => '2:2'")
    .replace("'aspectRatios' => ['1:1']", "'aspectRatios' => [1]")
    .replace("'config' => ['imageEditInstantEdit' => true]", "'config' => ['imageEditInstantEdit' => true, 'maxFileSize' => 2000000]");
  const result = probe('filepond-widget', model, changed);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('a 2 MiB server rule is rejected because the client 2MB limit is decimal', { skip: !app }, () => {
  const result = probe('filepond-upload', model.replace("'maxSize' => 2_000_000", "'maxSize' => 2 * 1024 * 1024"));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /validation accepted excess size/);
});

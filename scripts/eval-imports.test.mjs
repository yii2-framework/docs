import assert from 'node:assert/strict';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

const root = mkdtempSync(path.join(tmpdir(), 'eval-imports-'));
const target = 'yii2\\extensions\\bootstrap6\\Toast';
after(() => rmSync(root, { recursive: true, force: true }));

const positive = new Map([
  ['ordinary import', `use ${target};`],
  ['grouped import', 'use yii2\\extensions\\bootstrap6\\{Html, Toast};'],
  ['grouped alias', 'use yii2\\extensions\\bootstrap6\\{Html, Toast as Notification};'],
  ['grouped trailing comma', 'use yii2\\extensions\\bootstrap6\\{Html, Toast,};'],
  ['comma separated import', `use yii\\web\\View, ${target} as Notification;`],
  ['leading namespace separator', `use \\${target};`],
  ['case insensitive class name', 'use YII2\\Extensions\\BOOTSTRAP6\\Toast;'],
  ['bracketed namespace', `namespace app { use ${target}; }`],
  ['multiple bracketed namespaces', `namespace first { class A {} } namespace app { use ${target}; }`],
  ['mixed grouped imports', 'use yii2\\extensions\\bootstrap6\\{function helper, const FLAG, Toast};'],
  ['comments within grouped import', 'use yii2\\extensions\\bootstrap6\\{/* import */ Html, Toast /* class */ as Notification};'],
  ['fully qualified static access', `echo \\${target}::widget([]);`],
  ['fully qualified construction', `$toast = new \\${target}();`],
]);
const negative = new Map([
  ['wrong group namespace', 'use unrelated\\bootstrap6\\{Html, Toast};'],
  ['group alias named Toast imports another class', 'use yii2\\extensions\\bootstrap6\\{Html as Toast};'],
  ['comment pretending to import', `// use ${target};`],
  ['string pretending to import', `$text = 'use ${target};';`],
  ['function import', `use function ${target};`],
  ['constant import', `use const ${target};`],
  ['mixed group with function named Toast', 'use yii2\\extensions\\bootstrap6\\{Html, function Toast};'],
  ['mixed group with constant named Toast', 'use yii2\\extensions\\bootstrap6\\{Html, const Toast};'],
  ['trait use', `trait Example { use \\${target}; }`],
  ['trait adaptation', `trait Example { use \\${target} { \\${target}::foo as bar; } }`],
  ['trait use after interpolation', `class Example { public function a() { $x = "{$this->x}"; } use \\${target}; }`],
  ['closure capture', `$Toast = null; $fn = function () use ($Toast) { return $Toast; };`],
  ['longer class name', `use ${target}Extra;`],
  ['relative static access inside a namespace', `namespace app; echo ${target}::widget([]);`],
  ['fully qualified function call is not class access', `\\${target}();`],
]);
let number = 0;
for (const [expected, cases] of [[0, positive], [1, negative]]) {
  for (const [name, source] of cases) {
    test(`class import parser ${expected === 0 ? 'accepts' : 'rejects'} ${name}`, () => {
      const file = path.join(root, `${++number}.php`);
      writeFileSync(file, `<?php\n${source}\n`);
      const result = spawnSync('php', ['eval/lib/php-import.php', target, file], { encoding: 'utf8' });
      assert.equal(result.status, expected, `${result.stdout}\n${result.stderr}`);
    });
  }
}

test('class import CLI rejects missing arguments without undefined-variable diagnostics', () => {
  // Match check.sh's regular-file diagnostics instead of a PHP 8.5 socket-backed stderr pipe in isolation.
  const diagnostics = path.join(root, 'usage.stderr');
  const descriptor = openSync(diagnostics, 'w');
  let result;
  try {
    result = spawnSync('php', ['-d', 'register_argc_argv=0', 'eval/lib/php-import.php'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', descriptor] });
  } finally {
    closeSync(descriptor);
  }
  assert.equal(result.status, 2);
  const error = readFileSync(diagnostics, 'utf8');
  assert.match(error, /Usage:/);
  assert.doesNotMatch(error + result.stdout, /Warning|Undefined|Fatal|Notice/);
});

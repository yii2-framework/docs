<?php

declare(strict_types=1);

/**
 * Classifies the migration method pair declared by each supplied PHP file.
 *
 * A migration must declare exactly one complete pair: `safeUp`/`safeDown` or `up`/`down`. Functional reversibility
 * and type compatibility are checked separately by `app-migrate` and `app-static`.
 *
 * Usage: php migration-methods.php <migration.php> [<migration.php> ...]
 */

if ($argc < 2) {
    fwrite(STDERR, "Usage: php migration-methods.php <migration.php> [<migration.php> ...]\n");
    exit(2);
}

$classifications = [];

foreach (array_slice($argv, 1) as $file) {
    $source = file_get_contents($file);

    if ($source === false) {
        fwrite(STDERR, "Cannot read {$file}\n");
        exit(1);
    }

    $tokens = token_get_all($source);
    $methods = [];

    foreach ($tokens as $index => $token) {
        if (!is_array($token) || $token[0] !== T_FUNCTION) {
            continue;
        }

        for ($next = $index + 1, $count = count($tokens); $next < $count; $next++) {
            if (is_array($tokens[$next]) && $tokens[$next][0] === T_STRING) {
                $methods[strtolower($tokens[$next][1])] = true;
                break;
            }

            if ($tokens[$next] === '(') {
                break;
            }
        }
    }

    $safe = isset($methods['safeup'], $methods['safedown']);
    $direct = isset($methods['up'], $methods['down']);
    $partial = isset($methods['safeup']) !== isset($methods['safedown'])
        || isset($methods['up']) !== isset($methods['down']);

    if ($partial || $safe === $direct) {
        echo basename($file), ': declare exactly one complete pair: safeUp/safeDown or up/down', "\n";
        exit(1);
    }

    $classifications[] = basename($file) . ': ' . ($safe
        ? 'safeUp/safeDown (Yii transaction wrapper requested)'
        : 'up/down (supported direct methods; no Yii transaction wrapper)');
}

echo implode('; ', $classifications), "\n";

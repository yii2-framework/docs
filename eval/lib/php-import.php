<?php

declare(strict_types=1);

/**
 * Finds a declared PHP class import without executing the source.
 *
 * Accepts ordinary, comma-separated and grouped imports, including aliases, and fully qualified class access.
 * Function/constant imports, comments, strings, closure captures and trait uses do not declare a class import.
 * Rendering/static probes verify widget behavior.
 *
 * Usage: php php-import.php <fully-qualified-class> <php-file>...
 */

if (PHP_SAPI !== 'cli' || !isset($argv) || count($argv) < 3) {
    fwrite(STDERR, "Usage: php php-import.php <fully-qualified-class> <php-file>...\n");
    exit(2);
}

/**
 * Returns imported or explicitly fully qualified class names in a syntactically valid PHP source.
 *
 * @return list<string>
 */
function classReferences(string $source): array
{
    $tokens = array_values(array_filter(
        token_get_all($source, TOKEN_PARSE),
        static fn (array|string $token): bool => !is_array($token)
            || !in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true),
    ));
    $depth = 0;
    $namespaceDepth = 0;
    $namespacePending = false;
    $imports = [];

    for ($index = 0; $index < count($tokens); ++$index) {
        $token = $tokens[$index];

        if (is_array($token) && $token[0] === T_USE && $depth !== $namespaceDepth
            && ($tokens[$index + 1] ?? null) !== '(') {
            // Trait adaptation syntax contains :: too, but it does not reference the widget as a class.
            while (++$index < count($tokens) && $tokens[$index] !== ';') {
                if ($tokens[$index] === '{') {
                    $adaptationDepth = 1;

                    while (++$index < count($tokens) && $adaptationDepth > 0) {
                        $adaptationDepth += ($tokens[$index] === '{' ? 1 : 0) - ($tokens[$index] === '}' ? 1 : 0);
                    }

                    --$index;
                    break;
                }
            }

            continue;
        }

        if (is_array($token) && $token[0] === T_NAME_FULLY_QUALIFIED
            && ((is_array($tokens[$index + 1] ?? null) && $tokens[$index + 1][0] === T_DOUBLE_COLON)
                || (is_array($tokens[$index - 1] ?? null) && in_array($tokens[$index - 1][0], [T_NEW, T_INSTANCEOF], true)))) {
            $imports[] = ltrim($token[1], '\\');
        }

        if ($token === '{' || (is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
            ++$depth;

            if ($namespacePending) {
                $namespaceDepth = $depth;
                $namespacePending = false;
            }
        } elseif ($token === '}') {
            --$depth;

            if ($depth < $namespaceDepth) {
                $namespaceDepth = 0;
            }
        } elseif (is_array($token) && $token[0] === T_NAMESPACE) {
            $namespacePending = true;
        } elseif ($token === ';') {
            $namespacePending = false;
        } elseif (is_array($token) && $token[0] === T_USE && $depth === $namespaceDepth
            && ($tokens[$index + 1] ?? null) !== '(') {
            $clause = [];

            while (++$index < count($tokens) && $tokens[$index] !== ';') {
                $clause[] = $tokens[$index];
            }

            if (is_array($clause[0] ?? null) && in_array($clause[0][0], [T_FUNCTION, T_CONST], true)) {
                continue;
            }

            $open = array_search('{', $clause, true);
            $prefix = '';

            if ($open !== false) {
                foreach (array_slice($clause, 0, $open) as $part) {
                    $prefix .= is_array($part) ? $part[1] : $part;
                }

                $clause = array_slice($clause, $open + 1, -1);
            }

            $entries = [[]];

            foreach ($clause as $part) {
                if ($part === ',') {
                    $entries[] = [];
                } else {
                    $entries[array_key_last($entries)][] = $part;
                }
            }

            foreach ($entries as $entry) {
                if ($entry === [] || (is_array($entry[0]) && in_array($entry[0][0], [T_FUNCTION, T_CONST], true))) {
                    continue;
                }

                $name = '';

                foreach ($entry as $part) {
                    if (is_array($part) && $part[0] === T_AS) {
                        break;
                    }

                    $name .= is_array($part) ? $part[1] : $part;
                }

                $imports[] = ltrim($prefix . $name, '\\');
            }
        }
    }

    return $imports;
}

$expected = strtolower(ltrim($argv[1], '\\'));

try {
    foreach (array_slice($argv, 2) as $file) {
        $source = file_get_contents($file);

        if ($source === false) {
            throw new RuntimeException("Cannot read {$file}");
        }

        foreach (classReferences($source) as $class) {
            if (strtolower($class) === $expected) {
                echo "pass: class import or fully qualified access to {$argv[1]} in {$file}\n";
                exit(0);
            }
        }
    }
} catch (ParseError|RuntimeException $exception) {
    fwrite(STDERR, "fail: {$exception->getMessage()}\n");
    exit(1);
}

echo "fail: class import {$argv[1]} not declared\n";
exit(1);

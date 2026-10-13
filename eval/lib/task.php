<?php

declare(strict_types=1);

/**
 * Reads the YAML frontmatter and the body of an evaluation task file.
 *
 * Usage:
 *   php task.php <task-file> <field>   prints a scalar, or one list item per line
 *   php task.php <task-file> --body    prints the body (the user prompt)
 *   php task.php <task-file> --json    prints the frontmatter as JSON
 *
 * Supported frontmatter subset: `key: value` scalars and `key:` followed by `  - item` lists. Values may be plain or
 * single-quoted (`''` escapes a quote), so check patterns keep their backslashes verbatim. Exit code 1 means the file
 * is malformed or the field is missing.
 */

if ($argc !== 3) {
    fwrite(STDERR, "Usage: php task.php <task-file> <field>|--body|--json\n");
    exit(2);
}

$source = file_get_contents($argv[1]);

if ($source === false || preg_match('/\A---\n(.*?)\n---\n(.*)\z/s', $source, $parts) !== 1) {
    fwrite(STDERR, "{$argv[1]}: missing frontmatter\n");
    exit(1);
}

/**
 * Unquotes a single-quoted YAML scalar; plain scalars are returned trimmed.
 */
function scalar(string $value): string
{
    $value = trim($value);

    if (strlen($value) >= 2 && $value[0] === "'" && str_ends_with($value, "'")) {
        return str_replace("''", "'", substr($value, 1, -1));
    }

    if ($value !== '' && $value[0] === '"') {
        throw new InvalidArgumentException("double-quoted scalars are not supported: {$value}");
    }

    return $value;
}

$data = [];
$current = null;

try {
    foreach (explode("\n", $parts[1]) as $number => $line) {
        if (trim($line) === '' || str_starts_with(ltrim($line), '#')) {
            continue;
        }

        if (preg_match('/^\s+-\s+(.*)$/', $line, $match) === 1 && $current !== null) {
            $data[$current][] = scalar($match[1]);

            continue;
        }

        if (preg_match('/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/', $line, $match) === 1) {
            $current = $match[1];
            $data[$current] = $match[2] === '' ? [] : scalar($match[2]);

            continue;
        }

        throw new InvalidArgumentException(sprintf('line %d not understood: %s', $number + 2, $line));
    }
} catch (InvalidArgumentException $e) {
    fwrite(STDERR, "{$argv[1]}: {$e->getMessage()}\n");
    exit(1);
}

$field = $argv[2];

if ($field === '--body') {
    echo ltrim($parts[2], "\n");
    exit(0);
}

if ($field === '--json') {
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
    exit(0);
}

if (!array_key_exists($field, $data)) {
    exit(1);
}

echo is_array($data[$field]) ? implode("\n", $data[$field]) . ($data[$field] === [] ? '' : "\n") : $data[$field] . "\n";

<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use PhpToken;

use function count;
use function explode;
use function implode;
use function in_array;
use function is_string;
use function ltrim;
use function preg_replace;
use function preg_split;
use function strrpos;
use function strtolower;
use function substr;
use function trim;

use const T_CLOSE_TAG;
use const T_COMMENT;
use const T_CONST;
use const T_CURLY_OPEN;
use const T_DOC_COMMENT;
use const T_DOLLAR_OPEN_CURLY_BRACES;
use const T_FUNCTION;
use const T_OPEN_TAG;
use const T_USE;
use const T_WHITESPACE;

/**
 * Collects the top-level `use` imports of the snippets of one examples section, so a snippet that relies on the
 * imports of an earlier one (as the examples pages do) still compiles when it runs alone.
 */
final class ImportSet
{
    /**
     * @var array<string, string> Import statements (`use x\Y as Z;`) keyed by kind and lower-case alias.
     */
    private array $imports = [];

    /**
     * Removes the top-level `use` statements from the code and records them; later imports of the same alias replace
     * earlier ones.
     *
     * @return string The code without its import statements.
     */
    public function absorb(string $code): string
    {
        $tokens = PhpToken::tokenize("<?php\n" . $code);
        $count = count($tokens);
        $depth = 0;
        $body = '';

        for ($i = 0; $i < $count; $i++) {
            $token = $tokens[$i];

            if ($token->id === T_OPEN_TAG) {
                continue;
            }

            if ($token->text === '{' || $token->id === T_CURLY_OPEN || $token->id === T_DOLLAR_OPEN_CURLY_BRACES) {
                $depth++;
            } elseif ($token->text === '}') {
                $depth--;
            }

            if ($token->id === T_USE && $depth === 0 && !$this->followsParenthesis($tokens, $i)) {
                $end = $i;

                while ($end < $count && $tokens[$end]->text !== ';') {
                    $end++;
                }

                $this->record($tokens, $i + 1, $end);
                $i = $end;

                continue;
            }

            $body .= $token->text;
        }

        return ltrim($body, "\n");
    }

    /**
     * Returns the recorded import statements, one per line.
     */
    public function statements(): string
    {
        return implode("\n", $this->imports);
    }

    /**
     * Returns whether the `use` token at `$index` is a closure `use (...)` clause.
     *
     * @param list<PhpToken> $tokens
     */
    private function followsParenthesis(array $tokens, int $index): bool
    {
        for ($i = $index - 1; $i >= 0; $i--) {
            if (!in_array($tokens[$i]->id, [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                return $tokens[$i]->text === ')';
            }
        }

        return false;
    }

    /**
     * Records the imports of one `use` statement (tokens between `use` and `;`): plain, `function`, `const` and
     * grouped forms.
     *
     * @param list<PhpToken> $tokens
     */
    private function record(array $tokens, int $start, int $end): void
    {
        $kind = '';
        $text = '';

        for ($i = $start; $i < $end; $i++) {
            $token = $tokens[$i];

            if ($kind === '' && trim($text) === '' && ($token->id === T_FUNCTION || $token->id === T_CONST)) {
                $kind = strtolower($token->text);
                continue;
            }

            if (in_array($token->id, [T_COMMENT, T_DOC_COMMENT, T_CLOSE_TAG], true)) {
                continue;
            }

            $text .= $token->text;
        }

        $text = (string) preg_replace('/\s+/', ' ', trim($text));
        $prefix = '';
        $group = $text;
        $open = strrpos($text, '{');

        if ($open !== false) {
            $prefix = trim(substr($text, 0, $open));
            $group = trim(substr($text, $open + 1), " }");
        }

        foreach (explode(',', $group) as $item) {
            $item = trim($item);

            if ($item === '') {
                continue;
            }

            $parts = preg_split('/\s+as\s+/i', $item);
            $name = ltrim($prefix . trim(is_string($parts[0] ?? null) ? $parts[0] : ''), '\\');
            $alias = isset($parts[1]) ? trim($parts[1]) : substr($name, (int) strrpos('\\' . $name, '\\'));
            $statement = 'use ' . ($kind === '' ? '' : $kind . ' ') . $name
                . (isset($parts[1]) ? ' as ' . $alias : '') . ';';

            $this->imports[$kind . ':' . strtolower($alias)] = $statement;
        }
    }
}

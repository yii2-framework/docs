<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use Closure;
use ErrorException;
use ReflectionClass;
use Throwable;
use Yii;
use yii\base\Widget;
use yii\web\View;

use function array_diff;
use function array_filter;
use function array_map;
use function array_values;
use function extract;
use function get_declared_classes;
use function get_defined_vars;
use function is_int;
use function ob_end_clean;
use function ob_get_clean;
use function ob_get_level;
use function ob_implicit_flush;
use function ob_start;
use function restore_error_handler;
use function set_error_handler;
use function str_contains;
use function str_starts_with;

use const E_DEPRECATED;
use const E_USER_DEPRECATED;

/**
 * Runs PHP snippets in a fresh `yii\web\View` each, as the examples pages describe them: widget ids start at `w0`,
 * `$this` is the view, and warnings stop the snippet like exceptions.
 */
final class SnippetRunner
{
    /**
     * @param string $namespace Root namespace of the package; public static integer `$counter` properties of its
     * classes (automatic id counters) are reset before every run, like `yii\base\Widget::$counter`.
     */
    public function __construct(private readonly string $namespace)
    {
    }

    /**
     * Runs the code (without `<?php`) in a new view registered as the application `view` component.
     *
     * Widgets among the variables are moved to the new view, so a form started by an earlier snippet registers its
     * scripts where the current snippet renders.
     *
     * @param array<string, mixed> $variables Variables available to the snippet.
     */
    public function run(string $code, array $variables = []): RunResult
    {
        $view = new View();
        Yii::$app->set('view', $view);
        $this->resetCounters();

        foreach ($variables as $value) {
            if ($value instanceof Widget) {
                $value->setView($view);
            }
        }

        $classes = get_declared_classes();
        $level = ob_get_level();
        $defined = $variables;
        $returned = null;
        $error = null;

        ob_start();
        ob_implicit_flush(false);
        set_error_handler(
            static function (int $severity, string $message, string $file, int $line): bool {
                if (($severity & (E_DEPRECATED | E_USER_DEPRECATED)) !== 0) {
                    return true;
                }

                throw new ErrorException($message, 0, $severity, $file, $line);
            },
        );

        try {
            [$defined, $returned] = $this->evaluate($view, $code, $variables);
        } catch (Throwable $e) {
            $error = $e;
        } finally {
            restore_error_handler();
        }

        $unclosed = array_map(static fn(Widget $widget): string => $widget::class, Widget::$stack);
        Widget::$stack = [];

        while (ob_get_level() > $level + 1) {
            ob_end_clean();
        }

        $output = (string) ob_get_clean();

        return new RunResult(
            $view,
            $output,
            $defined,
            $returned,
            $error,
            $unclosed,
            array_values(array_filter(
                array_diff(get_declared_classes(), $classes),
                // Autoloaded classes (a parent class, a dependency) are not declarations of the snippet.
                static fn(string $class): bool => str_contains(
                    (string) (new ReflectionClass($class))->getFileName(),
                    "eval()'d code",
                ),
            )),
        );
    }

    /**
     * Evaluates the code with `$this` bound to the view and returns the defined variables and the returned value.
     *
     * @param array<string, mixed> $variables
     *
     * @return array{array<string, mixed>, mixed}
     */
    private function evaluate(View $view, string $code, array $variables): array
    {
        $run = function (array $__variables, string $__code): array {
            unset($__variables['this']);
            extract($__variables);
            unset($__variables);
            $__returned = eval($__code);
            $__defined = get_defined_vars();
            unset($__defined['__code'], $__defined['__returned']);

            return [$__defined, $__returned];
        };

        /** @var array{array<string, mixed>, mixed} */
        return Closure::bind($run, $view, View::class)($variables, $code);
    }

    /**
     * Resets `yii\base\Widget::$counter` and the public static integer `$counter` properties of the package classes.
     */
    private function resetCounters(): void
    {
        Widget::$counter = 0;

        foreach (get_declared_classes() as $class) {
            if (!str_starts_with($class, $this->namespace . '\\')) {
                continue;
            }

            $reflection = new ReflectionClass($class);

            if (!$reflection->hasProperty('counter')) {
                continue;
            }

            $property = $reflection->getProperty('counter');

            if ($property->isStatic() && $property->isPublic() && $property->getDeclaringClass()->name === $class
                && is_int($property->getValue())
            ) {
                $property->setValue(null, 0);
            }
        }
    }
}

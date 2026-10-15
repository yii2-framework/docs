<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Demo;

use yii\web\View;

use function array_keys;
use function array_map;
use function array_merge;
use function basename;
use function count;
use function htmlspecialchars;
use function ob_get_clean;
use function ob_start;
use function preg_replace_callback;
use function rawurlencode;
use function sprintf;
use function str_starts_with;

use const ENT_QUOTES;
use const ENT_XML1;

/**
 * Renders a demo page: a standalone HTML document with the snippet markup and the CSS, JavaScript files and script
 * blocks its view registered, laid out by the view itself as a Yii layout would (`beginPage()` to `endPage()`).
 *
 * The page loads `frame.js` and `frame.css` from the frame directory: theme sync with the embedding page, iframe
 * height, and no navigation away from the demo.
 */
final class DemoPage
{
    /**
     * @param string $frameUrl URL of the directory that holds `frame.js` and `frame.css`, without a trailing slash.
     * @param string $base Site base path (`/docs/`); root-relative image sources outside it get a placeholder.
     */
    public function __construct(private readonly string $frameUrl, private readonly string $base = '/docs/')
    {
    }

    /**
     * Returns the page and the assets the view registered.
     *
     * @param View $view View the snippet ran in.
     * @param string $fragment Markup echoed by the snippet.
     * @param string $title Page title.
     *
     * @return array{html: string, assets: array{css: list<string>, js: list<string>, jsBlocks: int}}
     */
    public function render(View $view, string $fragment, string $title): array
    {
        $assets = ['css' => [], 'js' => [], 'jsBlocks' => 0];
        $view->on(
            View::EVENT_END_PAGE,
            static function () use ($view, &$assets): void {
                $js = [];
                $blocks = 0;

                foreach ($view->jsFiles as $files) {
                    $js = array_merge($js, array_keys($files));
                }

                foreach ($view->js as $codes) {
                    $blocks += count($codes);
                }

                $assets = [
                    'css' => array_map('strval', array_keys($view->cssFiles)),
                    'js' => array_map('strval', $js),
                    'jsBlocks' => $blocks,
                ];
            },
        );
        $frame = htmlspecialchars($this->frameUrl, ENT_QUOTES);

        ob_start();
        $view->beginPage();
        echo "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            . "<meta name=\"robots\" content=\"noindex\">\n"
            . '<title>' . htmlspecialchars($title, ENT_QUOTES) . "</title>\n"
            . "<script src=\"$frame/frame.js\"></script>\n";
        $view->head();
        echo "<link href=\"$frame/frame.css\" rel=\"stylesheet\">\n</head>\n<body>\n";
        $view->beginBody();
        echo "<main id=\"demo\">\n" . $this->placeholders($fragment) . "\n</main>\n";
        $view->endBody();
        echo "</body>\n</html>\n";
        $view->endPage();

        return ['html' => (string) ob_get_clean(), 'assets' => $assets];
    }

    /**
     * Replaces root-relative `<img>` sources outside the site base (`/img/user.png` in the examples) with an inline
     * SVG placeholder that names the file, so the demo shows an image instead of a failed request.
     */
    private function placeholders(string $html): string
    {
        return (string) preg_replace_callback(
            '/(<img\b[^>]*?\ssrc=")(\/[^"]*)(")/i',
            function (array $match): string {
                if (str_starts_with($match[2], $this->base)) {
                    return $match[0];
                }

                $svg = sprintf(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">'
                    . '<rect width="640" height="360" fill="#8a8f98"/><text x="320" y="190" fill="#fff" '
                    . 'font-family="sans-serif" font-size="32" text-anchor="middle">%s</text></svg>',
                    htmlspecialchars(basename($match[2]), ENT_QUOTES | ENT_XML1),
                );

                return $match[1] . 'data:image/svg+xml,' . rawurlencode($svg) . $match[3];
            },
            $html,
        );
    }
}

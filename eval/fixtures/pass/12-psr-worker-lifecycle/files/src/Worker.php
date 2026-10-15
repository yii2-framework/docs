<?php

declare(strict_types=1);

namespace app;

use Psr\Http\Message\ServerRequestInterface;
use yii2\extensions\psrbridge\http\Application;

final class Worker
{
    public function __construct(private Application $app) {}

    public function serve(ServerRequestInterface $request, callable $emit): void
    {
        $response = $this->app->handle($request);
        $emitted = false;

        try {
            $emit($response);
            $emitted = true;
        } finally {
            $this->app->finalize($emitted);
        }
    }
}

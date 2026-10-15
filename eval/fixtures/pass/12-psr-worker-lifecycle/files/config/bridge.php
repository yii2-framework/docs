<?php

declare(strict_types=1);

return static fn(string $cookieValidationKey): array => [
    'useSession' => false,
    'syncCookieValidation' => true,
    'persistentComponents' => ['db', 'cache'],
    'components' => [
        'request' => [
            'cookieValidationKey' => $cookieValidationKey,
            'enableCookieValidation' => true,
        ],
        'session' => [
            'useCookies' => false,
            'useStrictMode' => true,
        ],
    ],
];

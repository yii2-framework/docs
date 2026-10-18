<?php

declare(strict_types=1);

namespace vendor\pkg\enum;

/**
 * Represents the theme colors.
 */
enum Theme: string
{
    /**
     * Applies the primary color.
     */
    case PRIMARY = 'primary';
    /**
     * Applies the danger color.
     */
    case DANGER = 'danger';
}

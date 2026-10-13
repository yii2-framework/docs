<?php

namespace yii\base;

/**
 * BaseObject is the base class of the fixture framework.
 *
 * @property-read string $className Fully qualified class name.
 */
class BaseObject implements Configurable
{
    /**
     * Returns the class name.
     *
     * @return string the fully qualified name.
     */
    public function getClassName()
    {
        return static::class;
    }
}

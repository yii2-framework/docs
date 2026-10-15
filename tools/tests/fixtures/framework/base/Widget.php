<?php

namespace yii\base;

/**
 * Widget is the base class for widgets.
 *
 * See the [guide article on widgets](guide:structure-widgets) and [[Configurable]].
 *
 * @since 2.0
 */
class Widget extends BaseObject
{
    /**
     * @event WidgetEvent an event raised before running the widget.
     * @since 2.0.11
     */
    public const EVENT_BEFORE_RUN = 'beforeRun';
    /**
     * Position of the widget in a pipe-separated list: `a|b`.
     */
    public const POSITION = 'a|b';
    /**
     * @var array<string, mixed> HTML attributes; keys are `<tag>` names with a | sign.
     */
    public $options = [];
    /**
     * @var string
     */
    public $name;
    /**
     * View that renders the widget.
     *
     * Defaults to the application view when not set.
     *
     * @var \yii\web\View|null
     */
    public $view;

    /**
     * Begins a widget.
     *
     * Values lower than 1 (`x < 1`) are ignored; see [[end()]].
     *
     * @param array $config name-value pairs.
     * @return static the widget.
     * @throws InvalidCallException when called twice.
     */
    public static function begin($config = [])
    {
        return new static();
    }

    /**
     * Ends a widget.
     *
     * @return static the widget.
     * @deprecated 2.0.14 Use [[begin()]] with a callback.
     */
    public static function end()
    {
        return new static();
    }
}

# Usage examples

## Widgets

### Badge

```php
use fixture\demos\Badge;
use fixture\demos\Counter;

echo Badge::widget(['label' => 'New']);
echo Counter::next();
```

```html
<span id="w0" class="badge">New</span>i0
```

The second snippet reuses the imports of the first one:

```php
echo Badge::widget(['label' => 'Again']) . Counter::next();
echo '<img src="/img/logo.png" alt="Logo">';
```

A script for the previous demo:

```php
$this->registerJs('document.getElementById("w0").hidden = false;', \yii\web\View::POS_END);
```

### Panel

```php
use fixture\demos\Panel;

Panel::begin();
echo 'Body';
Panel::end();
```

A fragment:

```php
Panel::begin();
```

### Panel

```php
echo 'Same heading text, other slug.';
```

## Configuration

```php
return ['components' => []];
```

## Forms

```php
use yii\base\Model;

final class FixtureForm extends Model
{
    public $name = 'Ada';
}
```

### Model

```php
echo $model->name;
```

### Failure

```php
echo $missing;
```

### Script

```php
$this->registerJs('console.log(1);', \yii\web\View::POS_END);
```

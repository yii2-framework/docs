---
title: "Classes assistantes"
---

> Note: cette section est en cours de développement.

Yii procure de nombreuses classes qui vous aident à simplifier le code de tâches courantes, telles que la manipulation de chaînes de caractères ou de tableaux, la génération de code HTML, et ainsi de suite. Ces classes assistantes sont organisées dans l'espace de noms `yii\helpers` et sont toutes des classes statiques (ce qui signifie qu'elles ne contiennent que des propriétés et des méthodes statiques et ne doivent jamais être instanciées).

Vous utilisez une classe assistante en appelant directement une de ses méthodes statiques, comme ceci :

```php
use yii\helpers\Html;

echo Html::encode('Test > test');
```

> Note: pour prendre en charge la [personnalisation des classes assistantes](#customizing-helper-classes), Yii éclate chacune des classes assistantes du noyau en deux classes : une classe de base (p. ex. `BaseArrayHelper`) et une classe concrète (p. ex. `ArrayHelper`). Lorsque vous utilisez une classe assistante, vous devez utiliser la version concrète uniquement et ne jamais utiliser la classe de base.

## Classes assistantes du noyau

Les versions de Yii fournissent les classes assistantes du noyau suivantes :

- [ArrayHelper](helper-array.md)
- Console
- FileHelper
- FormatConverter
- [Html](helper-html.md)
- HtmlPurifier
- Imagine (provided by yii2-imagine extension)
- Inflector
- Json
- Markdown
- StringHelper
- [Url](helper-url.md)
- VarDumper

## Personnalisation des classes assistantes <span id="customizing-helper-classes"></span>

Pour personnaliser une classe assistante du noyau (p. ex. [[yii\helpers\ArrayHelper]]), vous devez créer une nouvelle classe qui étend la classe de base correspondant à la classe assistante (p. ex. [[yii\helpers\ArrayHelper]]), y compris son espace de noms. Cette classe sera ensuite configurée pour remplacer l'implémentation originale de Yii.

L'exemple qui suit montre comment personnaliser la méthode [[yii\helpers\ArrayHelper::merge()|merge()]] de la classe [[yii\helpers\ArrayHelper]] :

```php
<?php

namespace yii\helpers;

class ArrayHelper extends BaseArrayHelper
{
    public static function merge($a, $b)
    {
        // votre implémentation personnalisée
    }
}
```

Sauvegardez votre classe dans un fichier nommé `ArrayHelper.php`. Le fichier peut se trouver dans n'importe quel dossier, par exemple, `@app/components`.

Ensuite, dans le fichier `composer.json` de votre application, ajoutez la configuration d'autoload suivante
pour charger votre classe personnalisée au lieu de la classe d'assistance originale de Yii.

```json
{
  "autoload": {
    "classmap": ["overrides/yii/helpers/ArrayHelper.php"],
    "exclude-from-classmap": ["vendor/yiisoft/yii2/helpers/ArrayHelper.php"]
  }
}
```

Notez que la personnalisation d'une classe assistante n'est utile que si vous désirez changer le comportement d'une fonction existante de la classe assistante. Si vous désirez ajouter une fonction additionnelle à utiliser dans votre application, le mieux est de créer une classe assistante séparée pour cela.

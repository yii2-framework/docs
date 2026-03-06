---
title: "Helpers"
---

> Observação: Esta seção está em desenvolvimento.

O Yii oferece muitas classes que ajudam a simplificar as tarefas comuns de codificação, como manipulação de string ou de array,
geração de código HTML, e assim por diante. Essas classes helpers (auxiliares) são organizadas no namespace `yii\helpers` e
são todas classes estáticas (o que significa que contêm apenas propriedades e métodos estáticos e não devem ser instanciadas).

Você usa uma classe helper chamando diretamente um de seus métodos estáticos, como o seguinte:

```php
use yii\helpers\Html;

echo Html::encode('Test > test');
```

> Observação: Para oferecer suporte à [personalização de classes helper](#customizing-helper-classes), o Yii divide cada classe helper principal
> em duas classes: uma classe base (ex. `BaseArrayHelper`) e uma classe concreta (ex. `ArrayHelper`).
> Ao usar um helper, você deve usar apenas a versão concreta e nunca a classe base.

## Principais Classes Helper

As seguintes classes helper são fornecidas nas versões Yii:

- [ArrayHelper](helper-array.md)
- Console
- FileHelper
- FormatConverter
- [Html](helper-html.md)
- HtmlPurifier
- Imagine (fornecido pela extensão yii2-imagine)
- Inflector
- [Json](helper-json.md)
- Markdown
- StringHelper
- [Url](helper-url.md)
- VarDumper

## Personalização de Classes Helper <span id="customizing-helper-classes"></span>

Para personalizar uma classe helper principal (ex. [[yii\helpers\ArrayHelper]]), você deve criar uma nova classe que
estende da classe base correspondente ao helper (ex. [[yii\helpers\BaseArrayHelper]]) e nomear a sua classe da mesma
forma que a classe concreta correspondente (ex. [[yii\helpers\ArrayHelper]]), Essa classe será então configurada para
substituir a implementação original da estrutura.

O exemplo a seguir mostra como personalizar o método [[yii\helpers\ArrayHelper::merge()|merge()]] da classe
[[yii\helpers\ArrayHelper]]:

```php
<?php

namespace yii\helpers;

class ArrayHelper extends BaseArrayHelper
{
    public static function merge($a, $b)
    {
        // sua implementação personalizada
    }
}
```

Salve sua classe em um arquivo chamado `ArrayHelper.php`. O arquivo pode estar em qualquer diretório, por exemplo `@app/components`.

Em seguida, no arquivo `composer.json` da sua aplicação, adicione a configuração de autoload abaixo
para carregar sua classe personalizada em vez da classe Helper original do framework:

```json
{
  "autoload": {
    "classmap": ["overrides/yii/helpers/ArrayHelper.php"],
    "exclude-from-classmap": ["vendor/yiisoft/yii2/helpers/ArrayHelper.php"]
  }
}
```

Observe que personalizar as classes Helper só é útil se você quiser mudar o comportamento de uma função existente
dos Helpers. Se você deseja adicionar outras funções para usar em sua aplicação, é melhor criar um
Helper para isso.

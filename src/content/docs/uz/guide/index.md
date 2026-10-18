---
title: "Yii 2.0 bo'yicha to'liq qo'llanma"
description: "Table of contents of the guide: getting started, application structure, requests, key concepts, databases, forms, output, security, caching, REST and testing."
---

Ushbu qo'llanma [Yii qo'llanmalarining holati](https://www.yiiframework.com/doc/terms/) bilan mos holda yo'lga qo'yildi.

All Rights Reserved.

2014 © Yii Software LLC.

## Kirish

- [Yii haqida](intro-yii.md)
- [1.1 dan keyingi yangilanishlar](intro-upgrade-from-v1.md)

## Birinchi tanishuv

- [Yii ni o'rnatish](start-installation.md)
- [Ilovani ishga tushirish](start-workflow.md)
- [«Salom» deymiz](start-hello.md)
- [Formalar bilan ishlash](start-forms.md)
- [Ma'lumotlar ombori bilan ishlash](start-databases.md)
- [Gii yordamida kodlarni generatsiya qilish](start-gii.md)
- [Keyin nima?](start-looking-ahead.md)

## Ilova strukturasi

- [Sharh](structure-overview.md)
- [Kirish skriptlari](structure-entry-scripts.md)
- [Ilova](structure-applications.md)
- [Ilova komponentlari](structure-application-components.md)
- [Kontrollyorlar](structure-controllers.md)
- [Namoyish](structure-views.md)
- [Modellar](structure-models.md)
- **TBD** [Filtrlar](structure-filters.md)
- **TBD** [Vidjetlar](structure-widgets.md)
- **TBD** [Modullar](structure-modules.md)
- [Resurslar](structure-assets.md)
- **TBD** [Kengaytmalar](structure-extensions.md)

## So'rovlarni qayta ishlash

- **TBD** [Bootstrapping](runtime-bootstrapping.md)
- **TBD** [Routing](runtime-routing.md)
- **TBD** [So'rovlar](runtime-requests.md)
- **TBD** [Javoblar](runtime-responses.md)
- **TBD** [Sessiyalar va kuklar](runtime-sessions-cookies.md)
- [URL ni tahlil va generatsiya qilish](runtime-routing.md)
- [Xatoliklarni qayta ishlash](runtime-handling-errors.md)
- [Jurnallarga yozish](runtime-logging.md)

## Asosiy tushunchalar

- [Komponentlar](concept-components.md)
- [Xususiyat](concept-properties.md)
- [Xodisa](concept-events.md)
- [O'zini tutish](concept-behaviors.md)
- [Muhim sozlashlar](concept-configurations.md)
- [Taxalluslar](concept-aliases.md)
- [Sinflarni avtoyuklash](concept-autoloading.md)
- [Service Locator](concept-service-locator.md)
- [Dependency Injection Container](concept-di-container.md)

## Ma'lumotlar ombori bilan ishlash

- [Ma'lumotlar bilan ishlashga imkon beruvchi obektlar(DAO)](db-dao.md) - Ma'lumotlar ombori bilan bog'lanish, oddiy so'rovlar, tranzaksiya va sxema bilan ishlash.
- [So'rovlarni yaratuvchi](db-query-builder.md) - Ma'lumotlar omboriga abstraksiyaning oddiy qatlamidan so'rovlar.
- [Active Record](db-active-record.md) - AR obektlarini olish, ular bilan ishlash va bog'lanishlarni aniqlash.
- [Migratsiyalar](db-migrations.md) - Komandada (jamoada) ishlaganda ma'lumotlar sxemasini talqinlarini boshqarish.
- **TBD** [Sphinx](https://www.yiiframework.com/extension/yiisoft/yii2-sphinx/doc/guide)
- **TBD** [Redis](https://www.yiiframework.com/extension/yiisoft/yii2-redis/doc/guide)
- **TBD** [MongoDB](https://www.yiiframework.com/extension/yiisoft/yii2-mongodb/doc/guide)
- **TBD** [ElasticSearch](https://www.yiiframework.com/extension/yiisoft/yii2-elasticsearch/doc/guide)

## Foydalanuvchidan ma'lumotlarni qabul qilish

- [Formani yaratish](input-forms.md)
- [Validatsiya](input-validation.md)
- **TBD** [Fayllarni yuklash](input-file-upload.md)
- **TBD** [Bir nechta modellar bilan ishlash](input-multiple-models.md)

## Ma'lumotlarni namoyish etish

- **TBD** [Ma'lumotlarni formatlash](output-formatting.md)
- **TBD** [Sahifalar bo'yicha ajratish](output-pagination.md)
- **TBD** [Saralash](output-sorting.md)
- [Ma'lumotlar provayderlari](output-data-providers.md)
- [Ma'lumotlar uchun vidjetlar](output-data-widgets.md)
- [Mavzulashtirish](output-theming.md)

## Xavfsizlik

- [Autentifikatsiya](security-authentication.md)
- [Avtorizatsiya](security-authorization.md)
- [Parollar bilan ishlash](security-passwords.md)
- **TBD** [Avtorizatsiya mijozlari](https://www.yiiframework.com/extension/yiisoft/yii2-authclient/doc/guide)
- **TBD** [Eng yaxshi amaliyotlar](security-best-practices.md)

## Keshlash

- [Sharh](caching-overview.md)
- [Ma'lumotlarni keshlash](caching-data.md)
- [Fragmentlarni keshlash](caching-fragment.md)
- [Sahifalarni keshlash](caching-page.md)
- [HTTP ni keshlash](caching-http.md)

## REST web-xizmatlari

- [Tezkor boshlash](rest-quick-start.md)
- [Resurslar](rest-resources.md)
- [Kontrollyorlar](rest-controllers.md)
- [Routing](rest-routing.md)
- [Javoblarni formatlash](rest-response-formatting.md)
- [Autentifikatsiya](rest-authentication.md)
- [So'rovlarni chastotasini chegaralash](rest-rate-limiting.md)
- [Talqin yaratish](rest-versioning.md)
- [Xatoliklarni qayta ishlash](rest-error-handling.md)

## Ishlab chiquvchining uskunalari

- [Qayta ishlash paneli va qayta ishlovchi](../../extensions/debug/index.md)
- [Gii bilan kodni generatsiya qilish](https://www.yiiframework.com/extension/yiisoft/yii2-gii/doc/guide)
- **TBD** [API qo'llanmani generatori](https://www.yiiframework.com/extension/yiisoft/yii2-apidoc)

## Test o'tkazish

- [Sharh](test-overview.md)
- **TBD** [MOdulli testlar](test-unit.md)
- **TBD** [Funksional testlar](test-functional.md)
- **TBD** [Qabul qiluvchi testlar](test-acceptance.md)
- [Fiksturalar](test-fixtures.md)

## Yii kengaytmalari

- [Kengaytmani yaratish](structure-extensions.md#creating-extensions)
- [Freymvork kodini kengaytirish](concept-di-container.md#practical-usage)
- [Tashqi kutubxonalarni qo'llash](tutorial-yii-integration.md#using-libs-in-yii)
- **TBD** [Tashqi tizimlarda Yii integratsiyasi](tutorial-yii-integration.md#using-yii-in-others)
- **TBD** [Yii 1.1 va 2.0 larni bir vaqtda ishlatish](tutorial-yii-integration.md#using-both-yii2-yii1)
- [Composer ni ishlatish](tutorial-yii-integration.md#using-composer-packages)

## Maxsus mavzular

- [advanced ilova shabloni](https://www.yiiframework.com/extension/yiisoft/yii2-app-advanced/doc/guide)
- [Ilovani noldan yaratish](tutorial-start-from-scratch.md)
- [Konsol komandalari](tutorial-console.md)
- [Xalqarolashtirish](tutorial-i18n.md)
- [Pochta yuborish](tutorial-mailing.md)
- [Ish inumdorligini oshirish](tutorial-performance-tuning.md)
- **TBD** [shared xostingida ishlash](tutorial-shared-hosting.md)
- [Shablonlashtiruvchilar](tutorial-template-engines.md)

## Vidjetlar

- GridView: link to demo page
- ListView: link to demo page
- DetailView: link to demo page
- ActiveForm: link to demo page
- Pjax: link to demo page
- Menu: link to demo page
- LinkPager: link to demo page
- LinkSorter: link to demo page
- [Bootstrap vidjetlari](https://www.yiiframework.com/extension/yiisoft/yii2-bootstrap/doc/guide)
- **TBD** [Jquery UI vidjetlari](https://www.yiiframework.com/extension/yiisoft/yii2-jui/doc/guide)

## Xelperlar

- [Sharh](helper-overview.md)
- **TBD** [ArrayHelper](helper-array.md)
- **TBD** [Html](helper-html.md)
- **TBD** [Url](helper-url.md)
- **TBD** [Security](security-cryptography.md)

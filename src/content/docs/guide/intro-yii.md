---
title: "What is Yii"
description: "Yii is a high performance, component-based PHP framework for rapidly developing modern Web applications."
---

Yii is a high performance, component-based PHP framework for rapidly developing modern Web applications.
The name Yii (pronounced `Yee` or `[ji:]`) means "simple and evolutionary" in Chinese. It can also
be thought of as an acronym for **Yes It Is**!

## What is Yii Best for?

Yii is a generic Web programming framework, meaning that it can be used for developing all kinds
of Web applications using PHP. Because of its component-based architecture and sophisticated caching
support, it is especially suitable for developing large-scale applications such as portals, forums, content
management systems (CMS), e-commerce projects, RESTful Web services, and so on.

## How does Yii Compare with Other Frameworks?

If you're already familiar with another framework, you may appreciate knowing how Yii compares:

- Like most PHP frameworks, Yii implements the MVC (Model-View-Controller) architectural pattern and promotes code
  organization based on that pattern.
- Yii takes the philosophy that code should be written in a simple yet elegant way. Yii will never try to
  over-design things mainly for the purpose of strictly following some design pattern.
- Yii is a full-stack framework providing many proven and ready-to-use features: query builders
  and ActiveRecord for both relational and NoSQL databases; RESTful API development support; multi-tier
  caching support; and more.
- Yii is extremely extensible. You can customize or replace nearly every piece of the core's code. You can also
  take advantage of Yii's solid extension architecture to use or develop redistributable extensions.
- High performance is always a primary goal of Yii.

Yii is not a one-man show, it is backed up by a [strong core developer team](https://www.yiiframework.com/team/), as well as a large community
of professionals constantly contributing to Yii's development. The Yii developer team
keeps a close eye on the latest Web development trends and on the best practices and features
found in other frameworks and projects. The most relevant best practices and features found elsewhere are regularly incorporated into the core framework and exposed
via simple and elegant interfaces.

## Yii Versions

This guide covers Yii 22.0 (`yiisoft/yii2`, branch `22.0`), the development line of the Yii 2 framework.
It retains the component and MVC architecture while requiring PHP 8.3 and using Composer for class autoloading.
The framework's own autoloader and class map from Yii 2.0 are removed.

Use the version constraints in [Installing Yii](start-installation.md). Installing the template without a version
constraint can select the older Yii 2.0 line, whose requirements and application layout differ from this guide.

## Requirements and Prerequisites

Yii 22.0 requires PHP 8.3 or newer and the `mbstring` extension. The Basic Project Template also needs Composer 2,
Node.js and npm for assets, and `pdo_sqlite` for its default database. Run the template's `requirements.php` checker
and `composer check-platform-reqs` to check your installation.

Using Yii requires basic knowledge of object-oriented programming (OOP), as Yii is a pure OOP-based framework.
Yii uses PHP features such as [namespaces](https://www.php.net/manual/en/language.namespaces.php)
and [traits](https://www.php.net/manual/en/language.oop5.traits.php). Understanding these concepts will help
you more easily pick up Yii.

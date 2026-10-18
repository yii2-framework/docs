---
title: "La guida definitiva a Yii 2.0"
description: "Table of contents of the guide: getting started, application structure, requests, key concepts, databases, forms, output, security, caching, REST and testing."
---

Questa guida è rilasciata nei [termini della documentazione di Yii](https://www.yiiframework.com/doc/terms/).

Tutti i diritti riservati.

2014 (c) Yii Software LLC.

Traduzione italiana a cura di Lorenzo Milesi ([yetopen.it](https://www.yetopen.it)).

## Introduzione

- [Informazioni su Yii](intro-yii.md)
- [Aggiornare dalla versione 1.1](intro-upgrade-from-v1.md)

## Primi passi

- [Installare Yii](start-installation.md)
- [Esecuzione applicazioni](start-workflow.md)
- [Dire Ciao](start-hello.md)
- [Utilizzo dei form](start-forms.md)
- [Utilizzo dei database](start-databases.md)
- [Generare codice con Gii](start-gii.md)
- [Passi successivi](start-looking-ahead.md)

## Struttura dell'applicazione

- [Panoramica](structure-overview.md)
- [Entry Scripts](structure-entry-scripts.md)
- [Applicazioni](structure-applications.md)
- [Componenti applicazioni](structure-application-components.md)
- [Controller](structure-controllers.md)
- [Modelli](structure-models.md)
- [Viste](structure-views.md)
- [Moduli](structure-modules.md)
- [Filtri](structure-filters.md)
- [Widget](structure-widgets.md)
- [Asset](structure-assets.md)
- [Estensioni](structure-extensions.md)

## Gestione delle richieste

- [Panoramica](runtime-overview.md)
- [Bootstrapping](runtime-bootstrapping.md)
- [Instradamenti (routing)](runtime-routing.md)
- [Richieste](runtime-requests.md)
- [Risposte](runtime-responses.md)
- **TBD** [Sessioni e cookie](runtime-sessions-cookies.md)
- [Analisi e generazione URL](runtime-routing.md)
- [Gestione errori](runtime-handling-errors.md)
- [Log](runtime-logging.md)

## Concetti chiave

- [Componenti](concept-components.md)
- [Proprietà](concept-properties.md)
- [Eventi](concept-events.md)
- [Behavior](concept-behaviors.md)
- [Configurazioni](concept-configurations.md)
- [Alias](concept-aliases.md)
- [Caricamento automatico delle classi (autoload)](concept-autoloading.md)
- [Service Locator](concept-service-locator.md)
- [Container per Dependency Injection](concept-di-container.md)

## Utilizzo del database

- [Data Access Objects](db-dao.md): Connessione ad un database, query semplici, transazioni e modifiche allo schema
- [Query Builder](db-query-builder.md): Esecuzione di query al database usando un semplice livello di astrazione
- [Active Record](db-active-record.md): The Active Record ORM, retrieving and manipulating records, and defining relations
- [Migrazoni](db-migrations.md): Applicare il controllo di versione al database in un ambiente di sviluppo di gruppo
- **TBD** [Sphinx](https://www.yiiframework.com/extension/yiisoft/yii2-sphinx/doc/guide)
- **TBD** [Redis](https://www.yiiframework.com/extension/yiisoft/yii2-redis/doc/guide)
- **TBD** [MongoDB](https://www.yiiframework.com/extension/yiisoft/yii2-mongodb/doc/guide)
- **TBD** [ElasticSearch](https://www.yiiframework.com/extension/yiisoft/yii2-elasticsearch/doc/guide)

## Ricezione dati dagli utenti

- [Creare form](input-forms.md)
- [Validazione informazioni](input-validation.md)
- **TBD** [Caricamento file](input-file-upload.md)
- **TBD** [Raccogliere dati per più modelli](input-multiple-models.md)

## Visualizzazione dei dati

- **TBD** [Formattazione](output-formatting.md)
- **TBD** [Paginazione](output-pagination.md)
- **TBD** [Ordinamento](output-sorting.md)
- [Data Provider](output-data-providers.md)
- [Data Widget](output-data-widgets.md)
- [Utilizzo del Client Scripts](output-client-scripts.md)
- [Temi](output-theming.md)

## Sicurezza

- [Autenticazione](security-authentication.md)
- [Autorizzazione](security-authorization.md)
- [Utilizzo delle password](security-passwords.md)
- **TBD** [Auth Clients](https://www.yiiframework.com/extension/yiisoft/yii2-authclient/doc/guide)
- **TBD** [Buona prassi](security-best-practices.md)

## Cache

- [Panoramica](caching-overview.md)
- [Cache dati](caching-data.md)
- [Fragment Caching](caching-fragment.md)
- [Cache pagina](caching-page.md)
- [Cache HTTP](caching-http.md)

## Servizi web RESTful

- [Avvio veloce](rest-quick-start.md)
- [Risorse](rest-resources.md)
- [Controller](rest-controllers.md)
- [Instradamenti](rest-routing.md)
- [Formattazione risposte](rest-response-formatting.md)
- [Autenticazione](rest-authentication.md)
- [Limitazione di utilizzo](rest-rate-limiting.md)
- [Versioning](rest-versioning.md)
- [Gestione degli errori](rest-error-handling.md)

## Strumenti di sviluppo

- [Barra di debug e debugger](../../extensions/debug/index.md)
- [Generazione codice con Gii](https://www.yiiframework.com/extension/yiisoft/yii2-gii/doc/guide)
- **TBD** [Generazione documentazione API](https://www.yiiframework.com/extension/yiisoft/yii2-apidoc)

## Test

- [Panoramica](test-overview.md)
- [Inizializzazione ambiente di test](test-environment-setup.md)
- [Unit Test](test-unit.md)
- [Functional Test](test-functional.md)
- [Acceptance Test](test-acceptance.md)
- [Fixture](test-fixtures.md)

## Argomenti speciali

- [Modello di applicazione avanzata](https://www.yiiframework.com/extension/yiisoft/yii2-app-advanced/doc/guide)
- [Creazione di una applicazione da zero](tutorial-start-from-scratch.md)
- [Comandi da console](tutorial-console.md)
- [Validazioni predefinite](tutorial-core-validators.md)
- [Internazionalizzazione](tutorial-i18n.md)
- [Invio email](tutorial-mailing.md)
- [Ottimizzazione delle prestazioni](tutorial-performance-tuning.md)
- **TBD** [Ambienti di hosting condiviso](tutorial-shared-hosting.md)
- [Template Engine](tutorial-template-engines.md)
- [Utilizzo di codice di terze parti](tutorial-yii-integration.md)

## Widget

- GridView: link to demo page
- ListView: link to demo page
- DetailView: link to demo page
- ActiveForm: link to demo page
- Pjax: link to demo page
- Menu: link to demo page
- LinkPager: link to demo page
- LinkSorter: link to demo page
- [Widget Bootstrap](https://www.yiiframework.com/extension/yiisoft/yii2-bootstrap/doc/guide)
- [Widget Jquery UI](https://www.yiiframework.com/extension/yiisoft/yii2-jui/doc/guide)

## Helper

- [Panoramica](helper-overview.md)
- **TBD** [ArrayHelper](helper-array.md)
- **TBD** [Html](helper-html.md)
- **TBD** [Url](helper-url.md)
- **TBD** [Security](security-cryptography.md)

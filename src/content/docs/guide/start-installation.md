---
title: "Installing Yii"
description: "Create a Yii 22.0 application with Composer, run it from public/, and check the installed development tools."
---

Start with the [Basic Project Template, branch `22`](https://github.com/yiisoft/yii2-app-basic/tree/22). It provides
controllers, views, authentication, a SQLite database, and a console application. This guide follows that template's
`src/`, `resources/`, and `public/` layout.

Yii 22.0 and this template are development versions. Keep the explicit version constraint below: an unversioned
`composer create-project` can install the older Yii 2.0 template.

## Installing via Composer <span id="installing-via-composer"></span>

Install these prerequisites before creating the application:

- PHP 8.3 or newer, with `mbstring` and `pdo_sqlite` for the template's database;
- [Composer 2](https://getcomposer.org/download/), available as `composer`;
- Node.js and npm, used by the template's Foxy integration to install CSS and JavaScript dependencies.

See the [template requirements](https://github.com/yiisoft/yii2-app-basic/blob/22/README.md#requirements) and
[Composer troubleshooting](https://getcomposer.org/doc/articles/troubleshooting.md) if dependency installation fails.

### Installing Yii <span id="installing-from-composer"></span>

Run these commands in the directory where you keep your projects:

```bash
composer create-project --prefer-dist --stability=dev yiisoft/yii2-app-basic:^22.0 basic
cd basic
mkdir -p runtime
./yii migrate
./yii serve --docroot=public
```

On Windows, create `runtime` if it is missing and use `php yii` in place of `./yii`. Review and confirm the migration
prompt to create the database tables. Open `http://localhost:8080/` to use the application. Choose another port with
`./yii serve --docroot=public --port=8888` if needed.

Composer installs the dependencies and its template scripts generate a random `cookieValidationKey` in
`config/web.php`. Keep this secret out of version control. The initial administrator credentials come from
`config/params.php`; change them before deployment.

> Note: The built-in server is for local development. For deployment, configure a Web server with `public/` as
> its document root, as described below.

Next, learn the [application structure](start-workflow.md). To work with a coding agent, follow
[the application skill setup](../project/ai-agents.md#install-the-relevant-skill) from the new application's directory.

## Installing from an Archive File <span id="installing-from-archive-file"></span>

Composer's `--prefer-dist` option already uses distribution archives when available. A source archive of
`yiisoft/yii2-app-basic` does not contain installed dependencies; it still needs `composer install` and the template's
setup steps. Archives for the Yii 2.0 template are not interchangeable with the `22` branch.

The distribution excludes some development files. See [Development checks](#development-checks) before trying to
run the template's test and analysis scripts.

## Other Installation Options <span id="other-installation-options"></span>

For an existing application, add the framework with:

```bash
composer require yiisoft/yii2:^22.0@dev
```

This installs the framework without creating entry scripts, configuration, or application code. Check the
[Composer autoload mappings](concept-autoloading.md) and each extension's Yii 22.0 requirements when migrating an
older application. Use only templates that explicitly support Yii 22.0.

## Installing Assets <span id="installing-assets"></span>

The Basic Project Template uses [Foxy](https://github.com/php-forge/foxy) and npm to install JavaScript and CSS packages
alongside Composer dependencies. Keep its `config.foxy` and `config.allow-plugins` configuration and make npm
available when running Composer. Its `@npm` alias points to the application's `node_modules/` directory.

Follow each extension's asset instructions and version constraints. The Yii 22.0 core does not require jQuery;
this template adds `yiisoft/yii2-jquery` and Bootstrap 5 for its views. Do not add the old global Composer asset
plugin or Bower packages to reproduce a Yii 2.0 installation. See [Assets](structure-assets.md#bower-npm-assets).

## Verifying the Installation <span id="verifying-installation"></span>

From the application's root directory, run:

```bash
composer validate
composer check-platform-reqs
php requirements.php
php -l public/index.php
./yii help
```

Also request the home page through the development server. A successful dependency install alone does not verify
that the database, assets, and application configuration work together.

### Development checks <span id="development-checks"></span>

Inspect `composer.json` and `composer run-script --list` before running project-specific quality checks. The template
source defines `ecs`, `static`, and `tests`, but its
[distribution rules](https://github.com/yiisoft/yii2-app-basic/blob/22/.gitattributes) exclude `tests/`, `ecs.php`,
`phpstan*.neon*`, and `codeception.yml`. A script being listed does not mean its configuration was installed.

If you need the template's development setup, obtain the needed files from the source revision that matches your
installed template and adapt them to your application. Alternatively, configure the tools for your own project.
Then run only checks for which the dependencies, configuration, and test suites are present:

```bash
composer ecs
composer static
composer tests
```

`composer ecs` runs ECS with `--fix` and changes files. Review those changes. The tests need their configured
database and server environment. Report unavailable checks as not run, with the missing prerequisite; do not
report them as passing. See [Testing](test-overview.md) and the [application skill](../project/ai-agents.md).

## Configuring Web Servers <span id="configuring-web-servers"></span>

Use PHP 8.3 or newer with the Web server as well as on the command line. Point the document root at `basic/public`,
so `config/`, `src/`, `runtime/`, and `vendor/` are not exposed to HTTP requests. The application URL should be such
as `https://www.example.com/index.php`, without the filesystem path `basic/public` in it.

To hide `index.php`, configure [routing and URL creation](runtime-routing.md). If the application runs behind a
reverse proxy, configure [trusted proxies and headers](runtime-requests.md#trusted-proxies).

### Recommended Apache Configuration <span id="recommended-apache-configuration"></span>

Use the following configuration in Apache's `httpd.conf` file or within a virtual host configuration. Note that you
should replace `path/to/basic/public` with the actual path for `basic/public`.

```apache
# Set document root to be "basic/public"
DocumentRoot "path/to/basic/public"

<Directory "path/to/basic/public">
    # use mod_rewrite for pretty URL support
    RewriteEngine on

    # if $showScriptName is false in UrlManager, do not allow accessing URLs with script name
    RewriteRule ^index.php/ - [L,R=404]

    # If a directory or a file exists, use the request directly
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d

    # Otherwise forward the request to index.php
    RewriteRule . index.php

    # ...other settings...
</Directory>
```

### Recommended Nginx Configuration <span id="recommended-nginx-configuration"></span>

To use [Nginx](https://wiki.nginx.org/), you should install PHP as an [FPM SAPI](https://www.php.net/install.fpm).
You may use the following Nginx configuration, replacing `path/to/basic/public` with the actual path for
`basic/public` and `mysite.test` with the actual hostname to serve.

```nginx
server {
    charset utf-8;
    client_max_body_size 128M;

    listen 80; ## listen for ipv4
    #listen [::]:80 default_server ipv6only=on; ## listen for ipv6

    server_name mysite.test;
    root        /path/to/basic/public;
    index       index.php;

    access_log  /path/to/basic/log/access.log;
    error_log   /path/to/basic/log/error.log;

    location / {
        # Redirect everything that isn't a real file to index.php
        try_files $uri $uri/ /index.php$is_args$args;
    }

    # uncomment to avoid processing of calls to non-existing static files by Yii
    #location ~ \.(js|css|png|jpg|gif|swf|ico|pdf|mov|fla|zip|rar)$ {
    #    try_files $uri =404;
    #}
    #error_page 404 /404.html;

    # deny accessing php files for the /assets directory
    location ~ ^/assets/.*\.php$ {
        deny all;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass 127.0.0.1:9000;
        # Or use the socket path configured for your PHP 8.3+ FPM service.
        try_files $uri =404;
    }

    location ~* /\. {
        deny all;
    }
}
```

When using this configuration, you should also set `cgi.fix_pathinfo=0` in the `php.ini` file
in order to avoid many unnecessary system `stat()` calls.

Also note that when running an HTTPS server, you need to add `fastcgi_param HTTPS on;` so that Yii
can properly detect if a connection is secure.

### Recommended NGINX Unit Configuration <span id="recommended-nginx-unit-configuration"></span>

You can run Yii-based apps using [NGINX Unit](https://unit.nginx.org/) with a PHP language module.
Here is a sample configuration.

```json
{
  "listeners": {
    "*:80": {
      "pass": "routes/yii"
    }
  },

  "routes": {
    "yii": [
      {
        "match": {
          "uri": ["!/assets/*", "*.php", "*.php/*"]
        },

        "action": {
          "pass": "applications/yii/direct"
        }
      },
      {
        "action": {
          "share": "/path/to/app/public/",
          "fallback": {
            "pass": "applications/yii/index"
          }
        }
      }
    ]
  },

  "applications": {
    "yii": {
      "type": "php",
      "user": "www-data",
      "targets": {
        "direct": {
          "root": "/path/to/app/public/"
        },

        "index": {
          "root": "/path/to/app/public/",
          "script": "index.php"
        }
      }
    }
  }
}
```

You can also [set up](https://unit.nginx.org/configuration/#php) your PHP environment or supply a custom `php.ini` in the same configuration.

### IIS Configuration <span id="iis-configuration"></span>

It's recommended to host the application in a virtual host (Web site) where document root points to `path/to/app/public` folder and that Web site is configured to run PHP. In that `public` folder you have to place a file named `web.config` i.e. `path/to/app/public/web.config`. Content of the file should be the following:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
<system.webServer>
<directoryBrowse enabled="false" />
  <rewrite>
    <rules>
      <rule name="Hide Yii Index" stopProcessing="true">
        <match url="." ignoreCase="false" />
        <conditions>
        <add input="{REQUEST_FILENAME}" matchType="IsFile"
              ignoreCase="false" negate="true" />
        <add input="{REQUEST_FILENAME}" matchType="IsDirectory"
              ignoreCase="false" negate="true" />
        </conditions>
        <action type="Rewrite" url="index.php" appendQueryString="true" />
      </rule>
    </rules>
  </rewrite>
</system.webServer>
</configuration>
```

Also the following list of Microsoft's official resources could be useful in order to configure PHP on IIS:

1. [How to set up your first IIS Web site](https://docs.microsoft.com/en-us/iis/manage/creating-websites/scenario-build-a-static-website-on-iis)
2. [Configure a PHP Website on IIS](https://docs.microsoft.com/en-us/iis/application-frameworks/scenario-build-a-php-website-on-iis/configure-a-php-website-on-iis)

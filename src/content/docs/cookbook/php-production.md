---
title: "Configuring PHP for production"
description: "Apply and verify PHP-FPM settings for Yii, with current security updates, protected diagnostics, and application-specific limits."
---

Configure the PHP runtime that serves your application, then verify its behavior through that runtime. This recipe
targets up-to-date Yii 2.0 and Yii 22.0 applications behind nginx and PHP-FPM. Use it alongside
[VPS hardening with Tailscale and Cloudflare](hardening-vps.md).

Reviewed on 2026-10-23. The security notice below is time-sensitive; check the linked PHP advisories before applying it
later. These settings complement updates and application security; they are not a universal `php.ini` replacement.

## 1. Identify the serving runtime and configuration

Work on the server through your administration connection, or use the equivalent settings in your hosting control panel.
PHP's server interface (**SAPI**) is the way it runs: CLI handles terminal commands, while FPM serves web requests. An
FPM **pool** groups PHP worker processes that share configuration.

Record the PHP service, executable, FPM pool, socket, package version, and configuration files for each application
instance. Match nginx's `fastcgi_pass` to that pool. A machine can serve several PHP versions simultaneously; `php -v`
and `php --ini` describe the selected CLI executable, not necessarily the website.

Inspect the service's startup arguments and its
[configuration file selection](https://www.php.net/manual/en/configuration.file.php). Record the loaded `php.ini` and
additional startup `.ini` files, then review pool overrides and any FastCGI `PHP_VALUE` or `PHP_ADMIN_VALUE` parameters.
Back up the affected files and arrange a maintenance or rolling-restart procedure before editing.

Use [PHP's supported branches](https://www.php.net/supported-versions.php) and the installed application's Composer
constraints. Yii's `master` branch represents 2.0.x; it is distinct from `22.0`. Both support the approach below, but
their PHP requirements differ. Do not use a framework's historical minimum PHP version as a production support
recommendation.

On Debian/Ubuntu, a PHP 8.4 installation might use `/etc/php/8.4/fpm/php.ini` and `/etc/php/8.4/fpm/pool.d/www.conf`.
These are examples, not paths to copy without checking. In managed hosting, ask the provider which settings apply before
request parsing and how to restart all workers.

Stop if the public request cannot be mapped to its actual service and pool. Ask the server operator to identify them
before editing files or restarting services.

## 2. Apply the security updates and current upload-progress precaution

The [21 October security release](https://www.php.net/archive/2026.php#2026-10-21-5) provides PHP 8.5.12, 8.4.27,
8.3.36, and 8.2.35 for CVE-2026-109618 and CVE-2026-109619. Update each serving runtime to a fixed release or verify the
equivalent vendor backport. Choose a branch compatible with your application; this list does not override Yii's PHP
requirement.

The [23 October notice](https://www.php.net/archive/2026.php#2026-10-23-1) separately recommends disabling session
upload progress until the next regular bugfix release. CVE-2026-115560 concerns an unusual combination: configuration
selects `php_binary` or `php_serialize`, application code switches to `php` with `ini_set()` before `session_start()`,
and upload progress remains enabled. Code that never switches handlers at runtime is outside that stated case. Do not
assume the 21 October releases also resolve this later notice.

Replace the effective setting in the serving SAPI's startup `php.ini` or a confirmed startup `.ini` file:

```ini
session.upload_progress.enabled = 0
```

Alternatively, enforce it in every affected FPM pool using pool syntax:

```ini
php_admin_flag[session.upload_progress.enabled] = off
```

Choose an authoritative location and remove conflicting overrides. Pool `php_admin_*` settings cannot be changed with
`ini_set()`; bare PHP directives do not belong directly in an FPM pool file. See
[FPM configuration](https://www.php.net/manual/en/install.fpm.configuration.php).

This directive is `INI_PERDIR`, not runtime-changeable. The
[stale-state advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) requires a setting
effective before request parsing and a restart of every PHP worker. Neither a Yii bootstrap `ini_set()` nor FPM
`.user.ini` is sufficient for this mitigation. Apply the restart and verification in step 7 before treating it as
effective.

Disabling this feature removes PHP's
[session-based upload-progress tracking](https://www.php.net/manual/en/session.upload-progress.php), not ordinary file
uploads. Test progress displays and cancellation flows that relied on it. Keep the existing session serializer; changing
serialization formats blindly can invalidate stored sessions. Review application and dependency code for runtime
serializer changes. Re-enable progress only after verifying the later fix and a real application requirement.

### If an update is temporarily unavailable

Treat this as an incident response decision, separate from the production baseline. The
[OOM advisory](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) describes administratively
enforced `memory_limit=-1` as an incomplete workaround for one vulnerable path, with independent request and
process-memory controls. It increases availability risk and is not a general tuning recommendation. An underlying
allocation failure can still be vulnerable.

The stale-state advisory's temporary measures, including `fatal_error_backtraces=0` on affected PHP 8.5, cover specific
paths rather than fixing the runtime. Hiding errors does not remediate these flaws. Use the complete vendor/advisory
procedure; if exposure cannot be controlled, take the affected service out of traffic until it can be updated.

## 3. Keep errors private and logs usable

In the serving startup INI, use this small
[error-handling baseline](https://www.php.net/manual/en/errorfunc.configuration.php):

```ini
display_errors = Off
display_startup_errors = Off
log_errors = On
error_reporting = E_ALL
zend.exception_ignore_args = On
```

Choose an `error_log` destination outside the public directory, or the appropriate system logging destination. Verify
write access, retention, rotation, and alert delivery.
[`zend.exception_ignore_args`](https://www.php.net/manual/en/ini.core.php#ini.zend.exception-ignore-args) reduces
argument disclosure in exception traces; it does not redact application logs. Exclude credentials, session identifiers,
and request bodies from routine logs.

In Yii's [entry script](../guide/structure-entry-scripts.md), ensure `YII_DEBUG` is `false` and `YII_ENV` is `prod`
before loading Yii. Review production bootstrap/modules so debug and Gii are not exposed. Check Yii's own log targets
and error views too; PHP's display setting alone does not configure the application's error response.

Verify a controlled failure in staging produces a generic response and a useful private log entry. Do not deploy an
intentional public error endpoint to test this.

## 4. Set session and cookie behavior for the application

For an HTTPS-only application, start with these
[session settings](https://www.php.net/manual/en/session.security.ini.php) in its serving INI:

```ini
session.use_cookies = 1
session.use_only_cookies = 1
session.use_strict_mode = 1
session.cookie_secure = 1
session.cookie_httponly = 1
```

Review Yii's `session` component, especially `cookieParams` and `useStrictMode`, because application configuration can
change these runtime values. Confirm the final `Set-Cookie` attributes after login. With custom session storage, verify
that the handler validates uninitialized session IDs; an enabled INI flag alone is not proof. See
[PHP's strict-mode caveat](https://www.php.net/manual/en/session.configuration.php#ini.session.use-strict-mode) and
[Yii sessions](../guide/runtime-sessions-cookies.md).

Choose `session.cookie_samesite` for the actual browser flows.
[`Lax`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value) is a
useful starting point for many applications, but cross-site POST callbacks can require a different policy. Test SSO and
payments before selecting `Lax` or `Strict`; flows requiring `None` must also use `Secure` and their protocol's
CSRF/state protections. Keep Yii's CSRF protection enabled. Scope cookie domain/path and session storage to the
application rather than sharing them by accident.

Test login, logout, session renewal, expiration, and concurrent requests. Behind Cloudflare, confirm Yii detects HTTPS
correctly using the [nginx/FPM setup](hardening-vps.md#4-nginx-tls-mtls-and-the-visitor-ip); broad proxy-header trust is
not a cookie fix.

## 5. Choose limits from legitimate traffic and measured capacity

Set limits in the startup INI or appropriate pool configuration after measuring normal requests and uploads. Use
[PHP's directive reference](https://www.php.net/manual/en/ini.core.php) to check each setting's scope.

| Setting or control                                           | How to choose and verify it                                                                                                                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upload_max_filesize`, `post_max_size`, `max_file_uploads`   | Allow required files and the complete multipart body, including overhead. Keep `post_max_size` above `upload_max_filesize`; test both valid and excessive uploads.                     |
| `max_input_vars`, `max_input_nesting_level`                  | Accommodate real forms while bounding unexpected input. Verify truncation cannot turn a rejected submission into a partial update.                                                     |
| `memory_limit`                                               | Use a finite budget on patched PHP, informed by request measurements. Include image processing/import peaks; do not treat the PHP setting as an exact operating-system memory ceiling. |
| Execution/input timeouts and FPM `request_terminate_timeout` | Coordinate PHP, upstream, and application deadlines. Put long-running jobs in a separate worker workflow; test cleanup after interruption.                                             |

An oversized POST can leave `$_POST` and `$_FILES` empty. Return a clear error rather than interpreting it as a valid
empty submission. Align web-server/proxy and application limits; a header-only `Content-Length` check is insufficient
for all requests. Keep upload temporary storage writable by the pool user, outside the public tree, and monitor free
space. Preserve legitimate uploads unless the application does not need them.

Size FPM `pm.max_children` from measured worker memory, expected concurrency, and the memory reserved for the OS and
other services. Load-test and observe saturation rather than copying a worker count. Review slow requests privately.
Keep FPM reachable only by its intended frontend; a separate pool does not provide complete isolation from other pools.

## 6. Make OPcache match the deployment procedure

Confirm OPcache is installed and enabled in the web SAPI. A CLI check or reset does not establish the state of the
serving FPM instance.

Keep `opcache.validate_timestamps=1` unless the deployment system explicitly invalidates the relevant cache or replaces
the serving processes on every deployment and rollback. With timestamp checking disabled, copying corrected files may
leave old code executing. Size OPcache memory and script capacity from observations; preserve comments if dependencies
use annotations. Avoid introducing JIT or preloading solely as a generic production switch. See
[OPcache configuration](https://www.php.net/manual/en/opcache.configuration.php).

## 7. Validate, restart all workers, and check real requests

For a confirmed Debian/Ubuntu service named `php8.4-fpm` using its default configuration, this example tests the
configuration and restarts the service only if the test passes:

```bash
sudo php-fpm8.4 -t && sudo systemctl restart php8.4-fpm
```

Replace the version and service with the ones identified in step 1. If the service uses custom configuration arguments
such as `-y`, `-c`, or `-d`, reproduce those in the validation command. A restart can interrupt requests: use the
maintenance or rolling-restart procedure prepared earlier.

1. Validate the edited configuration with the actual installed FPM binary and configuration path. Resolve unknown
   directives and startup warnings. Stop on validation failure; restore the saved configuration or correct it before
   proceeding.
2. Apply the change to every relevant service, pool, container, and replica. For the security update and upload-progress
   mitigation, restart all PHP workers and verify the old processes have exited. Restarting nginx alone does not replace
   PHP-FPM workers; a successful reload command alone does not prove they are gone.
3. Through a private request handled by each serving configuration, inspect only `PHP_VERSION`, `PHP_SAPI`,
   [`php_ini_loaded_file()`](https://www.php.net/manual/en/function.php-ini-loaded-file.php),
   [`php_ini_scanned_files()`](https://www.php.net/manual/en/function.php-ini-scanned-files.php), and an explicit
   allowlist of the changed directives using `ini_get()`. Use existing protected instrumentation, or record this small
   diagnostic in a private server log from an existing application route. Do not add an executable PHP file to the
   public directory, publish `phpinfo()`, dump the environment, or return secrets. Restrict access and remove temporary
   instrumentation afterward. Without access to a private check, ask the operator to run it; configuration-file
   inspection alone does not verify the serving runtime.
4. Confirm upload progress is disabled and trace that value to startup/pool configuration. A runtime readback cannot
   prove when a value took effect: `.user.ini` can make a late value look correct. For other runtime-changeable
   settings, also check after Yii has initialized. Match the serving package to the vendor's security-fix evidence; its
   version string alone may not identify a backport.
5. Exercise normal pages, HTTPS redirects, login/logout, SSO, file uploads, deliberate limit violations, and application
   error handling. Verify cookies, private logs, resource usage, and the deployed application version. Do not use an
   exploit payload as a configuration test.

If checks fail, keep the affected instance out of traffic and recover a known working, patched configuration. Preserve
required security mitigations during rollback; do not restore a vulnerable runtime merely to make a health check pass.

## References

- [PHP configuration modes](https://www.php.net/manual/en/configuration.changes.modes.php)
- [PHP session configuration](https://www.php.net/manual/en/session.configuration.php)
- [PHP-FPM configuration](https://www.php.net/manual/en/install.fpm.configuration.php)
- [Yii production performance guidance](../guide/tutorial-performance-tuning.md)
- [Yii security best practices](../guide/security-best-practices.md)

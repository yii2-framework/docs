---
title: "Hardening a PHP VPS with Tailscale + Cloudflare"
description: "Restrict a Yii application's origin to Cloudflare, use private SSH administration, and maintain verified firewall and nginx rules."
---

This recipe puts a Yii website behind Cloudflare and keeps server administration on Tailscale, a private network between
your devices. Your VPS (the remote Linux server) is the **origin**: Cloudflare receives visitors' requests and forwards
them to it. The aim is to stop visitors from bypassing that public entry point by connecting directly to the server.

You will configure three layers: Tailscale for SSH administration, firewall rules for network access, and nginx
certificates to authenticate Cloudflare. Mutual TLS (**mTLS**) means that the server checks a certificate from the
connecting client as well as presenting its own certificate.

This recipe uses a Yii application with a single public `web/index.php` entry script. Its request and proxy settings
apply to both Yii 2.0.x and Yii 22.0; the linked local guide and API reference describe Yii 22.0. It complements the
[security best practices](../guide/security-best-practices.md) and assumes an application already running on a supported
PHP release.

The framework branches have different dependency minimums:
[master (2.0.x) declares PHP >=7.4.0](https://github.com/yiisoft/yii2/blob/79b6d5fb096f51f47999abbe5dc82597751d5af2/framework/composer.json),
while
[22.0 declares PHP >=8.3](https://github.com/yiisoft/yii2/blob/f126a8bfdbb83540656229be834cfd0bb3cf4ac0/framework/composer.json).
A dependency minimum does not establish ongoing PHP security support. Choose a supported PHP release that also satisfies
the installed application's requirements; the nginx/FPM example does not need a separate configuration for each Yii
line.

This setup is provider-independent. Use your provider's firewall and recovery console where available. The commands
below target Debian/Ubuntu-style systems with UFW, systemd and PHP-FPM.

This guide reduces network exposure. Keep the OS, PHP, nginx and application dependencies patched; maintain tested
backups and monitor failures. A WAF cannot guarantee that every malicious web request is blocked.

For the PHP runtime settings and current upload-progress precaution, continue with
[Configuring PHP for production](php-production.md).

## Before you start

This is a deployment recipe for an already working application, not an initial Linux or Yii installation guide. You need
access to the VPS, its provider's recovery console, your Tailscale account, and your Cloudflare zone (the domain managed
in Cloudflare).

| Where                     | What you do there                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Your computer             | Use a browser for Tailscale/Cloudflare settings and open SSH sessions to test access.                 |
| VPS                       | Run the Bash commands and edit nginx configuration. Server commands require administrator privileges. |
| Provider recovery console | Restore access if a firewall or SSH change disconnects you. Test it before changing rules.            |

Replace `example.com` with your domain, `you@example.com` with your Tailscale identity, `deploy` with your chosen Linux
administrator, and `/var/www/app/web` with your application's public directory. Keep example addresses and paths out of
the final configuration.

- Use a maintained nginx package with SSL and Real IP support. The example enables HTTP/2 with `http2 on;`, which
  requires the HTTP/2 module and nginx 1.25.1 or newer. For a maintained package between 1.19.4 and 1.25.0, omit that
  directive and use HTTP/1.1 between Cloudflare and the origin; browser-to-Cloudflare HTTP/2 is separate. These are
  syntax minimums, not recommendations to install old releases.
- Have `curl`, `ca-certificates`, PHP CLI, and `ufw` available. Use a
  [supported PHP branch](https://www.php.net/supported-versions.php) compatible with your application's Composer
  requirements. The PHP 8.4 socket below is an example: check the FPM pool's actual `listen` path and socket
  permissions; do not expose FPM publicly.
- On the VPS, start an administrator Bash shell with `sudo bash`. The commands below assume that shell. `$cf_stage` will
  hold the path to temporary candidate files; keep the same shell while using it. If a command fails, stop and resolve
  the error before continuing.
- Back up the current firewall and nginx configuration. Confirm that the provider's recovery console works without
  Tailscale or public SSH, and that you can sign in locally with sufficient privileges. Keep an existing administration
  session open while testing a second one. Record how to restore the saved host and provider rules from that console; an
  open SSH session is not a recovery plan.
- This recipe installs both IPv4 and IPv6 UFW rules and requires host IPv6 support with `IPV6=yes` in
  `/etc/default/ufw`. Apply equivalent provider-firewall restrictions wherever IPv6 is exposed. Intentionally IPv4-only
  systems need an adapted firewall recipe; do not silently ignore IPv6 rule failures.
- This example assumes nginx and PHP-FPM run on the host. Published Docker ports need separate consideration; see the
  note below.

## 1. Administer the server through Tailscale

Install Tailscale using its [official installation instructions](https://tailscale.com/download/linux). Create a
dedicated local administrator account, such as `deploy`, and configure its required sudo permissions.

In the Tailscale admin console, open the access policy. A **tailnet** is your private Tailscale network; a **tag**
labels servers so a rule can target them. A network grant permits a connection, while an SSH rule decides who may sign
in. Define both before restricting public SSH. For a dedicated tailnet, this minimal policy permits your administrators
to reach tagged web servers on TCP 22 and authenticate as `deploy`:

```json
{
    "groups": {
        "group:vps-admins": ["you@example.com"]
    },
    "tagOwners": {
        "tag:web-server": ["group:vps-admins"]
    },
    "acls": [],
    "grants": [
        {
            "src": ["group:vps-admins"],
            "dst": ["tag:web-server"],
            "ip": ["tcp:22"]
        }
    ],
    "ssh": [
        {
            "action": "check",
            "src": ["group:vps-admins"],
            "dst": ["tag:web-server"],
            "users": ["deploy"]
        }
    ]
}
```

Replace the email and local username. In an existing tailnet, integrate this into the current policy and review all
overlapping grants/ACLs: adding a narrow grant does not override an existing allow-all rule. Preserve explicitly
required access for other devices. Review tag ownership and policy-editing permissions too: these administrators can
change the boundary. Add positive and negative
[policy tests](https://tailscale.com/docs/reference/syntax/policy-file#tests) for the administrator, a
non-administrator, TCP 22, and denied service ports.

On the VPS, join that tailnet, enable Tailscale SSH, and apply the server tag:

```bash
tailscale up --ssh --advertise-tags=tag:web-server
tailscale ip
```

Authenticate with an identity authorized to assign the tag. Your workstation must also run Tailscale, signed in as a
listed administrator on a user-owned, untagged device. Open a new SSH session from it to the VPS's Tailscale address as
`deploy`, and verify any required sudo access before proceeding. Tagged automation clients need their own deliberately
scoped policy.

**Checkpoint:** keep the original session open and confirm the new Tailscale session can run the administration commands
you need. If it fails, fix the policy, identity or local account before changing any firewall rule.

Tailscale SSH uses both the network grant and the `ssh` policy. If you prefer ordinary OpenSSH over Tailscale, omit
`--ssh`, keep the network restriction and configure OpenSSH keys separately.

> Warning: Do not use UFW as the only control inside the tailnet. Tailscale manages its own netfilter rules, which can
> accept traffic before UFW's rules. Grants/ACLs must define the permitted peers and ports. Protect the administrator
> identities with MFA and maintain a recovery path.

Review existing subnet routes, Serve/Funnel configurations, and other reverse tunnels. A service published through
[Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) has a separate public entry point; a private or
loopback bind does not prevent a proxy from exposing it. This recipe assumes no alternate publication path for the
application.

## 2. Stage and review Cloudflare's IP ranges

Use the working Tailscale SSH session from step 1. Run `sudo bash` there and keep that administrator shell for steps 2
through 6 so `$cf_stage` remains available; leave the original session open.

Cloudflare publishes the network ranges that may connect to your origin. A range written as an address followed by `/`
and a prefix length is called **CIDR**. On the VPS, download both IPv4 and IPv6 lists into a new temporary directory.
Nothing in this section changes the firewall or nginx.

The PHP check below verifies the format, address family, prefix length, and network boundary. It removes duplicates and
prepares the complete result before writing it. It does not load Yii or your application. If a download or check fails,
stop: discard the candidate and keep the current configuration. Parentheses group commands in a separate shell: an error
stops that group without closing your administration session.

```bash
cf_stage=$(mktemp -d /root/cloudflare-origin.XXXXXX)
(
set -euo pipefail
: "${cf_stage:?Candidate directory was not created}"
printf 'Candidate directory: %s\n' "$cf_stage"

curl -fsS --retry 2 --connect-timeout 10 --max-time 30 \
    https://www.cloudflare.com/ips-v4 -o "$cf_stage/ips-v4"
curl -fsS --retry 2 --connect-timeout 10 --max-time 30 \
    https://www.cloudflare.com/ips-v6 -o "$cf_stage/ips-v6"

php -- "$cf_stage" > "$cf_stage/ranges.txt" <<'PHP'
<?php
declare(strict_types=1);

set_error_handler(static function (int $level, string $message): void {
    throw new RuntimeException($message);
});

try {
    if (count($argv) !== 2 || !is_dir($argv[1])) {
        throw new RuntimeException('Pass the candidate directory.');
    }
    $ranges = [];
    foreach ([4, 6] as $version) {
        $lines = file($argv[1] . '/ips-v' . $version, FILE_IGNORE_NEW_LINES);
        if ($lines === false || $lines === []) {
            throw new RuntimeException("Empty or unreadable IPv{$version} response.");
        }
        foreach ($lines as $line) {
            if (!preg_match('/\A([0-9a-fA-F:.]+)\/([1-9][0-9]{0,2})\z/', $line, $parts)) {
                throw new RuntimeException("Invalid CIDR: {$line}");
            }
            $address = inet_pton($parts[1]);
            $length = $version === 4 ? 4 : 16;
            $prefix = (int) $parts[2];
            if ($address === false || strlen($address) !== $length || $prefix > $length * 8) {
                throw new RuntimeException("Invalid IPv{$version} network: {$line}");
            }
            $mask = str_repeat("\xff", intdiv($prefix, 8));
            if ($prefix % 8 !== 0) {
                $mask .= chr((0xff << (8 - $prefix % 8)) & 0xff);
            }
            $mask = str_pad($mask, $length, "\0");
            if (($address & $mask) !== $address) {
                throw new RuntimeException("Host bits must be zero: {$line}");
            }
            $ranges[inet_ntop($address) . '/' . $prefix] = true;
        }
    }
    // Syntax checks only: review every range against Cloudflare before use.
    $output = implode("\n", array_keys($ranges)) . "\n";
    if (file_put_contents('php://stdout', $output) !== strlen($output)) {
        throw new RuntimeException('Incomplete candidate output.');
    }
} catch (Throwable $error) {
    restore_error_handler();
    file_put_contents('php://stderr', $error->getMessage() . "\nDiscard this candidate; keep the live configuration.\n");
    exit(1);
}
PHP

cat "$cf_stage/ranges.txt"
)
```

**Manual checkpoint:** in your browser, open [Cloudflare's published ranges](https://www.cloudflare.com/ips/) and
compare both complete lists with the output above. For an update, also review every addition and removal against your
saved list. Do not continue with an unexplained difference or an incomplete list.

These are structural checks, **not an automatic test of public routability or Cloudflare ownership**. Private, reserved
or multicast networks can have valid CIDR syntax. Reject unexpected or unverifiable ranges; if you cannot establish that
a change is legitimate, keep the working configuration and ask for help. The manual review is required, not an optional
step for unattended updates.

Only after approving the ranges, generate the nginx include. This still writes only to the temporary directory:

```bash
(
set -euo pipefail
while IFS= read -r cidr; do
    printf 'set_real_ip_from %s;\n' "$cidr"
done < "$cf_stage/ranges.txt" > "$cf_stage/cloudflare-ips.conf"
)
```

Keep the candidate directory until installation and verification finish. A failed command can leave an incomplete
temporary file; never install it or continue after an error.

## 3. Firewall: public HTTPS from Cloudflare; administration over Tailscale

Run this section on the VPS through the working Tailscale SSH session, with the independent recovery console available.
UFW is the host firewall tool: it controls which network connections the server accepts.

First inspect existing rules. These commands display the configured rules, their current numbers, and the underlying
rules:

```bash
ufw show added
ufw status numbered
ufw show raw
```

Changing a default policy does not remove existing allow rules. Review unrestricted SSH, HTTP, HTTPS, database ports,
and application profiles before changing them. Inspect UFW's `before.rules`, `after.rules`, `before6.rules`, and
`after6.rules`, plus rules from other firewall managers: the summary does not show every effective rule. Earlier
matching rules can override later rules; resolve conflicting denies as well as broad allows. See the
[UFW framework manual](https://manpages.debian.org/trixie/ufw/ufw-framework.8.en.html).

Add the intended permissions before deleting the old administration rule. If UFW is already active, test a new Tailscale
session after adding them. Then remove only the reviewed conflicting public permissions with `ufw delete`; do not reset
the firewall. Re-list after each deletion because rule numbers change. Numbered deletion removes only that entry: review
the IPv6 counterpart separately.

If you cannot tell which existing rules are required, stop and get help reviewing them. Deleting a rule by guesswork can
disconnect you or expose another service.

Before the loop, inspect existing rules identical to the proposed TCP 443 rules. UFW can update their comments instead
of creating separate entries. Adopt an existing rule into this workflow only deliberately, and record which rules this
workflow owns.

The first command allows SSH on the Tailscale interface. The loop permits HTTPS (TCP port 443) from each approved
Cloudflare range:

```bash
(
set -euo pipefail
ufw allow in on tailscale0 to any port 22 proto tcp

while IFS= read -r cidr; do
    ufw allow proto tcp from "$cidr" to any port 443 \
        comment 'cloudflare-origin-https'
done < "$cf_stage/ranges.txt"
)
```

If a rule command fails, stop and inspect the additions already made before retrying. The group stops on error but does
not undo earlier changes.

Remove the reviewed conflicting rules as described above, then set the policies, enable UFW if needed, and inspect the
result:

```bash
(
set -euo pipefail
ufw default deny incoming
ufw default allow outgoing
ufw enable
ufw status verbose
)
```

Enabling UFW or changing its policies can interrupt existing connections. If access is lost, restore the known
configuration from the provider console before continuing. Keep the current session open and verify a new Tailscale SSH
connection. From outside the tailnet, public SSH must be unreachable.

If the provider offers a firewall, also restrict inbound TCP 443 to these Cloudflare ranges and remove public TCP 22
access there. Apply equivalent IPv6 restrictions. `tailscale0` is a host interface: it is not a rule you can copy into a
provider firewall.

Tailscale can normally connect using outbound traffic and relays when direct connections are unavailable. Test
connectivity after provider-firewall changes; evaluate any additional UDP allowance against
[Tailscale's firewall guidance](https://tailscale.com/docs/integrations/firewalls). Preserve required network-control
traffic, including necessary ICMP/ICMPv6.

> Warning: Docker published container ports can bypass UFW's normal filtering path. Bind internal services to
> loopback/private interfaces only when their reachability is understood, and configure filtering for the actual Docker
> firewall backend. A private address is not an access policy; review direct routing as well as published ports. Verify
> exposure externally; `ufw status` alone is insufficient. See
> [Docker's firewall documentation](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

## 4. nginx: TLS, mTLS and the visitor IP

In your browser, open the domain in Cloudflare and configure the website's DNS records as _Proxied_ (the orange cloud).
Install a valid origin certificate, select _Full (strict)_, and enable _Always Use HTTPS_. The HTTP-to-HTTPS redirect
happens at Cloudflare; this setup does not open origin port 80.

On the VPS, prepare these separate certificate files using the certificate instructions linked below. These paths are
examples used by the nginx configuration; verify the files exist before editing nginx:

| File                             | Purpose                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| `/etc/ssl/cf-origin.pem`         | Origin server certificate covering your hostname.                        |
| `/etc/ssl/cf-origin.key`         | Its private key, readable only by the required privileged service.       |
| `/etc/ssl/cf-origin-pull-ca.pem` | Public CA certificate trusted to verify Cloudflare's client certificate. |

The _Origin Certificate_ authenticates your server to Cloudflare. _Authenticated Origin Pulls (AOP)_ authenticates the
connecting client to your server. They are different mechanisms and certificates.

Choose your AOP configuration before proceeding. A **CA** is the certificate authority that issues certificates. nginx
will trust the chosen CA to identify the connecting client:

- _Global AOP:_ use Cloudflare's published
  [AOP CA certificate](https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem). This
  authenticates Cloudflare's network, including other customers; it does not identify your account.
- _Custom zone-level or per-hostname AOP:_ use a dedicated CA to issue a client certificate. Upload the client
  certificate and its private key to the relevant Cloudflare AOP configuration; install the CA's public certificate at
  the nginx path above. Keep the CA private key offline. Use this option when the origin must accept only the client
  certificates you control. Follow the
  [zone-level instructions](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/zone-level/)
  or
  [per-hostname instructions](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/per-hostname/).

The Cloudflare IP allowlist and global AOP identify Cloudflare infrastructure, not your zone. Prefer a dedicated client
certificate when traffic must pass through your zone's controls. Check the
[AOP availability and scope](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
before choosing a configuration.

On the VPS, the IP include is a small nginx file listing the networks allowed to supply the visitor IP. For a new setup,
install the approved candidate:

```bash
install -o root -g root -m 0644 \
    "$cf_stage/cloudflare-ips.conf" /etc/nginx/cloudflare-ips.conf
```

For an existing setup, use the [allowlist update procedure](#6-maintain-the-allowlists-safely) instead of overwriting
the live include directly.

Back up your current site configuration. Place the example below inside nginx's `http` context, normally through your
distribution's site configuration include (often a file in `/etc/nginx/sites-available/` linked from `sites-enabled/`).
Do not paste it inside an existing `server` block. Replace `example.com`, the document root and the PHP socket. Review
other enabled sites and remove conflicting default/public listeners. For the initial AOP setup, follow the staged
rollout immediately after the example before requiring client certificates.

```nginx
log_format origin_security
    '$remote_addr peer=$realip_remote_addr '
    'host=$host status=$status aop=$ssl_client_verify '
    'client_serial=$ssl_client_serial client_issuer="$ssl_client_i_dn"';

server {
    listen 443 ssl default_server;
    # If the origin serves IPv6, also enable:
    # listen [::]:443 ssl default_server;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_reject_handshake on;
    return 444;
}

server {
    listen 443 ssl;
    # If the origin serves IPv6, also enable:
    # listen [::]:443 ssl;

    http2 on;
    server_name example.com;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_certificate     /etc/ssl/cf-origin.pem;
    ssl_certificate_key /etc/ssl/cf-origin.key;

    ssl_client_certificate /etc/ssl/cf-origin-pull-ca.pem;
    ssl_verify_client on;

    include /etc/nginx/cloudflare-ips.conf;
    real_ip_header CF-Connecting-IP;

    access_log /var/log/nginx/origin-security.log origin_security;

    root /var/www/app/web;
    index index.php;

    location ~ /\. {
        return 404;
    }

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location = /index.php {
        try_files $uri =404;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root/index.php;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    }

    # Only the exact front controller above executes PHP.
    location ~* \.(php|phtml|phar)(/|$) {
        return 404;
    }
}
```

Keep application code, dependencies, secrets and backups outside `web/`; extension filters are not a substitute for a
clean public directory. Hidden paths are blocked here, including `.well-known`. Add a narrowly scoped exception only if
your application needs one.

Complete the AOP setup in this order:

1. In the example, temporarily change `ssl_verify_client on;` to `ssl_verify_client optional;`. This lets you check that
   Cloudflare presents a valid certificate before making it mandatory.
2. Run the validation/reload command below on the VPS. If validation or reload fails, stop, restore the saved
   configuration, and investigate the error.
3. In the Cloudflare dashboard or the chosen AOP setup procedure, enable the client certificate. Request a page that
   reaches your application rather than Cloudflare's cache. Check `/var/log/nginx/origin-security.log` on the VPS for
   that request and `aop=SUCCESS`.
4. Change the nginx directive back to `on`, validate/reload again, and repeat the request. If it fails, restore the last
   working configuration and correct the certificate setup before continuing. Do not leave `optional` as the final
   setting.

The `&&` below reloads nginx only if its configuration test succeeds:

```bash
nginx -t && systemctl reload nginx
```

### Certificate renewal and advanced AOP rotation

Certificates expire, so record their expiry dates and arrange reminders. When rotating AOP CAs, temporarily trust the
old and new CAs. Upload the replacement client certificate and key, wait for it to become active, switch the relevant
configuration, verify an uncached origin request uses the new serial and issuer in the origin log, and only then remove
the old certificate and CA. While both CAs are trusted, `aop=SUCCESS` alone cannot distinguish the old certificate from
the new one. Follow
[Cloudflare's certificate management procedure](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/manage-certificates/);
retain the old working configuration until the new one is verified.

Monitor the expiry of the origin server certificate, AOP client certificate, and trusted CA separately.
[Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/) certificates do not
receive expiration notifications and are not normally trusted by browsers. Replace the server certificate and key before
expiry, test/reload nginx, verify _Full (strict)_ traffic, and then retire the previous certificate. If using a public
CA, arrange renewal compatible with closed origin port 80 and mandatory client authentication, such as automated DNS
validation; do not assume a default HTTP challenge will work.

### Check addresses and Yii request data

If serving the origin over IPv6, enable both IPv6 listeners and enforce the same firewall restrictions. Otherwise, do
not configure an origin IPv6 address as an upstream destination in Cloudflare.

**SNI** is the hostname sent during the TLS handshake, before the HTTP request. The default server rejects absent or
unrecognized SNI. A client that knows your hostname can still send valid SNI while connecting to your IP; firewall
restrictions and mTLS provide the origin-access controls.

**FastCGI** is how nginx passes a request to PHP-FPM, the process that runs PHP. With the standard `fastcgi_params`,
nginx sends the restored visitor address as `REMOTE_ADDR` and its TLS state as `HTTPS`. Yii can use these with its
default request configuration, without adding Cloudflare networks to `trustedHosts` or changing `ipHeaders`. Verify that
your distribution's customized FastCGI include files contain `REMOTE_ADDR $remote_addr` and `HTTPS $https if_not_empty`;
keep the client-to-Cloudflare connection HTTPS-only as described above.

Review existing overrides of [[yii\web\Request::$trustedHosts]], [[yii\web\Request::$secureHeaders]],
[[yii\web\Request::$ipHeaders]], and [[yii\web\Request::$secureProtocolHeaders]]. In this direct nginx-to-FPM topology,
retain the default empty `trustedHosts` and default protected-header filtering; remove old trust-all or Cloudflare-proxy
overrides. After Real IP processing, `REMOTE_ADDR` is already the visitor, not the proxy. Do not add an unprotected
`CF-Connecting-IP` entry to Yii's `ipHeaders`. See [trusted proxies](../guide/runtime-requests.md#trusted-proxies).

For ordinary proxied requests, keep Cloudflare Pseudo IPv4 _Off_ or _Add Header_ to preserve IPv6 visitor addresses.
_Overwrite Headers_ replaces them with pseudo IPv4. Worker subrequests have different `CF-Connecting-IP` behavior,
including a fixed cross-zone Worker address; do not treat every restored address as a uniquely identified visitor.
Review [Cloudflare's header behavior](https://developers.cloudflare.com/fundamentals/reference/http-headers/) and any
Workers or transforms in your zone.

## 5. Cloudflare edge controls

Make these changes in the Cloudflare dashboard for your domain. The **WAF** (web application firewall) checks HTTP
requests before forwarding them. Enable and test one change at a time; if a legitimate request is blocked, inspect the
Cloudflare security event before adjusting that rule.

- _Managed WAF rules:_ use the rulesets available on your plan. Free includes the Free Managed Ruleset; the Cloudflare
  Managed Ruleset and OWASP Core Ruleset require Pro or higher. Test rule changes against legitimate application
  traffic.
- _Sensitive paths:_ add a custom rule with action _Block_ as an additional layer:

  ```text
  (http.request.uri.path contains "/.env") or
  (http.request.uri.path contains "/.git") or
  (http.request.uri.path contains "/vendor/")
  ```

- _Login rate limiting:_ choose fields and windows supported by your
  [rate limiting plan](https://developers.cloudflare.com/waf/rate-limiting-rules/#availability). Free permits a
  10-second counting period; Pro permits periods up to 60 seconds, but neither supports matching the request method in
  rate limiting rules. Use a path-based rule on those plans, accounting for page loads as well as submissions. Matching
  POST `/site/login` requires Business or an applicable Enterprise entitlement. A starting threshold such as 10
  requests/minute/IP therefore needs a compatible plan and tuning. Cover alternate routes, including query-string
  routing where supported; otherwise enforce them in the application. Shared IPs, distributed counters, and enforcement
  delay prevent this from being an exact account-level quota. Implement account-level throttling in the application too.
- _Bot protection:_ test APIs, webhooks and legitimate automated clients before enabling Bot Fight Mode. Ordinary WAF
  Skip rules cannot bypass it. Use the configurable bot protection available on your plan when exceptions are needed.

## 6. Maintain the allowlists safely

An **allowlist** is the set of networks permitted by these rules. The first installation is not the last step:
Cloudflare's ranges and your certificates can change. The procedure below is a manual maintenance checklist, not a
script to schedule automatically.

After the initial setup has passed the checks below, save the ranges as the baseline owned by this workflow:

```bash
(
set -euo pipefail
install -d -o root -g root -m 0700 /var/lib/cloudflare-origin
install -o root -g root -m 0600 \
    "$cf_stage/ranges.txt" /var/lib/cloudflare-origin/ranges.txt
)
```

Only record ranges whose UFW rules you created, or deliberately adopted, and verified. When adopting an older
installation, review and identify the managed rules first.

Review Cloudflare's ranges periodically, for example monthly, and respond to announced changes. Do not schedule the
original add-only loop as the whole update process. UFW, nginx and the provider firewall are separate systems; they
cannot be updated in one atomic transaction.

On the VPS and, where applicable, in the provider firewall dashboard, use this order with one administrator operating at
a time. If you are unsure how to identify the rules owned by this recipe, stop before deleting anything:

1. Repeat [range staging and review](#2-stage-and-review-cloudflares-ip-ranges) to create a new candidate. Complete the
   structural checks and the manual approval before proceeding. If either download, validation or review fails, stop
   without changing the live configuration. Compare it with `/var/lib/cloudflare-origin/ranges.txt` and review the
   difference.
2. Preserve the old manifest and nginx include as rollback copies. Add the newly introduced Cloudflare ranges to UFW
   using the same rule shape/comment, and to the provider firewall if used. Keep old ranges temporarily. Record each
   addition actually completed in both firewalls so a partial failure does not leave untracked permissions.
3. Install the candidate nginx include through a temporary file in `/etc/nginx`, then rename it over the live include.
   Run `nginx -t` before reloading. If validation fails, restore the previous include and stop. If reload fails, restore
   it, validate again and recover the previous configuration; investigate before continuing.
4. Verify a fresh uncached request reaches the application, `aop=SUCCESS` appears in the origin log, and the visitor IP
   is correct. If the check fails, restore the old include, validate/reload it, and verify recovery before removing only
   the additions from this attempt.
5. Remove retired ranges from the managed firewall rules. A rule is eligible only when it matches a range in the old
   manifest, the expected inbound TCP 443 rule and the `cloudflare-origin-https` comment. Inspect `ufw status numbered`
   and remove the reviewed rule; re-list after each deletion. Never remove unrelated rules. Remove the corresponding
   managed provider-firewall rules too.
6. Save the candidate as the new manifest only after all steps succeed. Preserve the old baseline until then, so failed
   cleanup can be retried. Check for old untagged or unrestricted HTTPS rules left from earlier installations
   separately.

If any firewall operation or check fails, stop without advancing the manifest. Preserve the old baseline, candidate, and
record of completed changes; reconcile the live rules before retrying, especially if the next candidate differs. If
cleanup was partial, either finish it against the same candidate or restore the retired rules needed by the old
configuration. Do not assume a failed command rolled back earlier commands.

Unattended updates are an advanced task outside this recipe. They need protection against simultaneous runs, a record of
partial changes, recovery, and failure alerts. Replacing one file can be atomic (all at once); updating the firewall and
nginx together is not.

## 7. Verify the result

Keep your recovery console available for these checks. Use your computer for normal website and SSH tests; use a
separate connection outside Tailscale for public-exposure tests. Test both IPv4 and IPv6 wherever enabled. If a check
fails, stop and fix that layer before treating the setup as complete.

For the direct-origin examples below, an ordinary request to the domain is not enough: its proxied DNS record points to
Cloudflare. [`--resolve`](https://everything.curl.dev/usingcurl/connections/name.html) selects the destination address
while keeping the hostname for SNI, HTTP Host and server-certificate checks. `--noproxy '*'` bypasses configured
proxies, and `-q` ignores saved curl options.

- A new administrator session works over Tailscale; unauthorized tailnet devices cannot reach the VPS services.
- Public SSH and other unintended services are unreachable from outside the tailnet, over both address families in use.
- `http://example.com` redirects to HTTPS at Cloudflare, and an uncached HTTPS request reaches the application.
- The origin log shows `aop=SUCCESS`, a Cloudflare peer address, and the expected visitor address for both IP families.
  Confirm Yii's `userIP`, `isSecureConnection`, and absolute URLs agree. Send deliberately false `X-Forwarded-For`,
  `X-Forwarded-Host`, and `X-Forwarded-Proto` values through the public site and confirm they do not override Yii's
  request data.
- From an external non-Cloudflare connection outside Tailscale, test the VPS's public IP with the correct hostname/SNI.
  Replace `example.com` and `192.0.2.10` with your domain and the origin's actual public IP from the hosting provider,
  not an address returned by proxied DNS:

  ```bash
  curl -q --noproxy '*' -v --connect-timeout 5 \
      --resolve 'example.com:443:192.0.2.10' https://example.com/
  ```

  The TCP connection must not be established. If TLS negotiation starts or an HTTP response arrives, port 443 is
  reachable: an mTLS rejection does not prove the firewall blocked access. Check the destination and firewall rules; a
  generic curl error alone is inconclusive. If the origin exposes IPv6, repeat with
  `--resolve 'example.com:443:[2001:db8::10]'`, replacing that example address with its actual public IPv6 address.

- Check SNI and HTTP Host separately: an absent or unknown SNI is rejected during TLS negotiation; correct SNI with an
  unrelated Host must not serve the application. Confirm the expected hostname works with the intended AOP client
  certificate.
- From the VPS itself, test mTLS independently of the public firewall by connecting to `127.0.0.1` (the VPS itself).
  Replace the domain and CA file path below. The CA must verify the origin **server** certificate; it is not the AOP
  client CA. For Cloudflare Origin CA certificates, use the matching
  [Origin CA root](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/#cloudflare-origin-ca-root-certificate).
  If the server uses a public CA already trusted by curl, omit `--cacert`:

  ```bash
  curl -q --noproxy '*' -v \
      --resolve 'example.com:443:127.0.0.1' \
      --cacert /path/to/origin-server-ca.pem https://example.com/
  ```

  The request must reach nginx, pass server-certificate verification, and be rejected because no client certificate was
  supplied. Confirm that reason in nginx's response or, if recorded, its error log; a generic TLS failure or curl exit
  status alone does not prove mTLS enforcement. Do not add `--cert`, `--key` or `-k`. With the IPv6 listener enabled,
  repeat using `--resolve 'example.com:443:[::1]'`. This local test does not verify the public firewall.

- Static files and normal routes work; `.env`, `.git/`, `/other.php`, and `/index.php/extra` do not expose files or
  execute another script.
- Recheck access after a planned reboot and after changes to networking, container port publishing or firewall software.

## References

- [Tailscale access policy syntax](https://tailscale.com/docs/reference/syntax/policy-file)
- [Tailscale netfilter modes](https://tailscale.com/docs/reference/netfilter-modes)
- [UFW manual](https://manpages.debian.org/trixie/ufw/ufw.8.en.html)
- [Cloudflare Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
- [Cloudflare Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)
- [Cloudflare managed WAF rules and plan availability](https://developers.cloudflare.com/waf/managed-rules/)
- [Cloudflare Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- [nginx HTTP/2 module](https://nginx.org/en/docs/http/ngx_http_v2_module.html)
- [nginx standard FastCGI parameters](https://github.com/nginx/nginx/blob/master/conf/fastcgi_params)
- [nginx SSL variables and client verification](https://nginx.org/en/docs/http/ngx_http_ssl_module.html#variables)
- [nginx Real IP module](https://nginx.org/en/docs/http/ngx_http_realip_module.html)
- [nginx virtual server selection](https://nginx.org/en/docs/http/server_names.html#virtual_server_selection)
- [Yii requests and trusted proxies](../guide/runtime-requests.md#trusted-proxies)
- [Yii entry scripts](../guide/structure-entry-scripts.md)

---
name: yii2-mail
description: Implement Yii 22.0 message composition, mail views, transport integration, and delivery-result handling. Use for application email code; not sending real messages without task authorization.
license: BSD-3-Clause
---

# Mail composition and transport

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Core supplies mail interfaces and base composition behavior; the concrete mailer
  and transport come from the application's installed extension. Resolve its
  revision independently and preserve existing transport configuration. Do not
  assume a particular mailer package from a template example.
- Distinguish composing a message, storing it with useFileTransport, transport
  acceptance, and final delivery. A true `send()` result in file-transport mode
  means a message file was saved, not that a recipient received mail.
- Preserve configured views/layouts, sender/reply-to, recipient roles, text/HTML
  parts, and attachment sources. Encode untrusted substitutions for HTML; plain
  text requires its own readable representation. Inspect automatic text fallback
  before relying on it for a multipart-content requirement.
- Handle a false send result and extension exceptions through the application's
  intended failure/retry path. `sendMultiple()` returns a success count, not a
  per-recipient delivery report. Account for partial success before retrying a batch
  so successful messages are not unintentionally resent.
- Before-send events can cancel transmission. Preserve event hooks and side-effect
  ordering; persisting a business action and sending mail are not automatically
  one atomic transaction. Do not introduce a queue or outbox for a small view edit
  unless the task needs that change.
- Do not switch file transport off, add real recipients, or contact an external
  SMTP/API service merely to verify a template. Live sending must be authorized
  by the user and scoped to the intended recipients/message.

## Observable acceptance

Compose with the actual configured mailer in an isolated test/file transport and
inspect recipients, subject, body parts, and attachment metadata. Verify the
application handles cancellation/failure where that behavior changed. State whether
only composition/file output or an authorized external transport was exercised;
never claim delivery from a file or successful composition alone.

## Evidence routes

Read `framework/mail/{MailerInterface,MessageInterface,BaseMailer,BaseMessage,MailEvent}.php`
and the installed extension's transport implementation. Tests:
`tests/framework/mail/BaseMailerTest.php` and
`tests/framework/mail/BaseMessageTest.php`. Guide: `tutorial-mailing`.

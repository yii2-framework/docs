---
name: yii2-rest-apis
description: Implement Yii 22.0 REST resource actions, authentication, serialization, filtering, and HTTP contracts. Use for APIs built on yii rest; not ordinary HTML controller routing.
license: BSD-3-Clause
---

# REST APIs

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- Preserve the API's routes, media types, response envelope, status codes, and
  authentication scheme. `rest\Controller` configures negotiation, verbs,
  CompositeAuth, and rate limiting, but an empty authentication-method list is
  not proof that endpoints require credentials. Rate limiting also depends on
  the configured identity supporting its contract.
- Merge inherited behaviors deliberately. When adding CORS, handle preflight in
  the intended filter order and preserve authentication on actual requests.
  CORS permission is not authorization. REST defaults disable CSRF; if the API
  uses ambient cookie/session credentials, explicitly evaluate that policy instead
  of treating the default as a security guarantee.
- ActiveController supplies index/view/create/update/delete/options actions;
  overriding an inline method does not automatically replace a mapped external
  action. Inspect `actions()` and alter only the intended entry. Its default
  `checkAccess()` is empty: implement the application's resource-level policy.
  Filter list queries for allowed resources; checking access to an index action
  does not by itself constrain every row returned.
- Distinguish request parser configuration from response negotiation. JSON body
  loading depends on the configured parser/content type. Keep create/update
  scenarios and safe input attributes separate from serialized output fields.
- Review `fields()`/`extraFields()` and requested expansions. Serialization is
  not authorization and may expose nested resources or trigger extra queries.
  Preserve pagination headers/envelopes and HEAD behavior while changing data.
- Use the existing error contract for validation, missing resources, unsupported
  verbs/media, and denied access. Do not convert every exception into HTTP 200
  with an error string or leak arbitrary model attributes for convenience.

## Observable acceptance

Request the affected endpoints through the real parser/filter/serializer path.
Check the expected body, headers, status and field set for permitted access,
validation failure, missing resource, denied access, and the changed media/verb
cases. Exercise collection visibility separately from single-resource checks.
For CORS changes verify preflight and actual authenticated requests. An action
unit test alone does not establish the HTTP contract.

## Evidence routes

Read `framework/rest/{Controller,ActiveController,Action,IndexAction,Serializer,UrlRule}.php`,
`framework/filters/{ContentNegotiator,Cors,RateLimiter}.php`, and the configured
`framework/filters/auth/` strategy. Tests: `tests/framework/rest/SerializerTest.php`,
`tests/framework/rest/IndexActionTest.php`, `tests/framework/rest/UrlRuleTest.php`,
`tests/framework/filters/ContentNegotiatorTest.php`, `CorsTest.php`, and
`tests/framework/filters/auth/CompositeAuthTest.php`.
Guides: `rest-controllers`, `rest-authentication`, `rest-resources`,
`rest-response-formatting`, `rest-routing`.

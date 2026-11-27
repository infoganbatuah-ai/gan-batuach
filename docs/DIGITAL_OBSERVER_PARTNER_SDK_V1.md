# Digital Observer Partner SDK v1

PUSH 43 adds a partner layer over the canonical PUSH 39–42 contracts. It does not create new Event, Incident, Evidence, investigation, notification, identity, billing, entitlement, API or webhook engines.

## Authentication boundaries

- Server integrations use a rotating PUSH 41 `dosvc_` credential and PUSH 42 HMAC request signature. Store it only in the partner's server-side secret store.
- A partner-control service account can provision customers but cannot read customer cameras.
- A customer-resource service account maps to exactly one active partner customer and its explicitly linked Sites.
- Browser/mobile components receive only a `doemb_` token with a maximum 60-minute lifetime, fixed audience, allowed Origin, customer, Site and scopes. Raw tokens are not stored.
- Revoking or suspending the partner customer revokes active embedded sessions.

At dashboard read time the server checks the exact browser Origin against the session and the partner's current allowlist. It also checks the audience, the active partner and customer relationship, the current customer–Site link, and the Site's current customer organization. Before returning dashboard data, the existing last-used update must match a session that has neither expired nor been revoked. A cross-origin preflight permits only the dashboard GET and its two request headers. Only a successful authorized read returns the CORS response header, and the browser SDK sends no cookies.

## Public surfaces

- `@digital-observer/sdk`: signed server client, camera inventory/health, Events, Incidents, Evidence references, investigation, Watch Rules, webhooks, customer provisioning and embedded-session issuance.
- `@digital-observer/sdk/browser`: short-lived embedded client.
- `@digital-observer/sdk/react`: brand-neutral Camera grid, activity feed and shell.

All list operations remain bounded and paginated. Mutations require idempotency keys. Webhook verification uses the versioned PUSH 42 contract. API errors are stable codes and never contain provider credentials.

## White-label and legal notices

Partner name, product label, logo, colors, support/privacy/terms links, notification label and sandbox domain are configurable. Legally required notices cannot be removed. Custom domains stay unverified until separately proven; Production activation is not part of PUSH 43.

## Compatibility truth

OEM integration uses the canonical source-capability registry. No partner or source row implies universal camera/VMS compatibility. Direct vendor Cloud/API connectivity remains preferred where available, but PUSH 46 owns real zero-install proof.

## Evidence status

Deterministic SDK, isolation and synthetic independent-app tests are internal proof only. A real OEM/white-label partner, external SSO, customer domain, vendor camera/VMS, billing settlement and Production webhook remain `NOT_PROVEN` in the activation register.

`node --test scripts/qa/check-embedded-dashboard-route.mjs` exercises the browser SDK, dashboard handler and authorization logic with a synthetic database boundary. It covers request and response CORS headers, current Site ownership, and revocation or expiry both before and during resource reads.

`node --test scripts/qa/check-embedded-dashboard-browser.mjs` runs the browser SDK with native fetch against the same handler on a separate loopback origin. The check requires Playwright with Chromium and can use an existing installation through `EMBEDDED_QA_PLAYWRIGHT_MODULE` and `EMBEDDED_QA_CHROME`. In local Chrome QA, the browser sent a preflight (204), read the authorized dashboard (200) without cookies, and received no dashboard data following revocation or Site transfer (403 for each). The HTTP test adapter invokes the Next.js route handler directly. Deployed middleware, the external proxy, PostgreSQL and partner activation still require separate verification.

`node --test scripts/qa/check-partner-next-loopback.mjs` separately runs a temporary Next.js app on loopback with the unchanged external v1 and embed route modules, repository `proxy.ts`, and the real application Supabase client. Its loopback REST fixture holds synthetic rows. It verifies actual HTTP middleware request IDs and audit, two bounded camera pages without a cross-Site row, embed preflight and authorized dashboard, then denial before camera lookup after revocation or Site transfer. The fixture uses an isolated Next configuration and a synthetic PostgREST-compatible subset. The original Development VM `gbi` was stopped and its Docker socket was absent at qualification. No original runtime or database was started. This test provides no deployed configuration, PostgreSQL behavior, RLS, live partner or production proof.

`node --test scripts/qa/check-partner-postgres-isolation.mjs` exercises the checked-in partner/RLS/ACL and delegated usage SQL with the installed PGlite PostgreSQL 18.3 engine. Prerequisite tables and application claims are synthetic. In this fixture Site transfer removes camera read access for the former organization and grants it to the current organization with an active membership. Revoking that membership removes access. The embedded session table is inaccessible to application roles, and the usage RPC is executable only by the server role.

The same run demonstrates a metering authorization gap: `record_digital_observer_external_api_usage` still increments a usage bucket for a transferred Site while the original delegated link remains, and it accepts a separately revoked service account. Removing the delegated link rejects the write. The RPC returns a usage receipt; this result does not give the caller a dashboard, camera data or media. A future correction must align the server-only meter with the current Site organization, active account and delegated customer and qualify the exact RPC via the authorized Development migration path.

This engine ran in a disposable directory on the development drive with no network listener or connection to the release database. A native cluster, full migration replay, deployed PostgreSQL/Supabase version and role wiring, real multi-session concurrency, and hosted Datastore/Data API configuration remain outside this evidence.

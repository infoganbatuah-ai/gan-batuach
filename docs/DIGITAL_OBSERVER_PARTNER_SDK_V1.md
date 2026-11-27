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

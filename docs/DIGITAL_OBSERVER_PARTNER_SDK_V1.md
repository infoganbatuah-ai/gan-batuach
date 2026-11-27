# Digital Observer Partner SDK v1

PUSH 43 adds a partner layer over the canonical PUSH 39–42 contracts. It does not create new Event, Incident, Evidence, investigation, notification, identity, billing, entitlement, API or webhook engines.

## Authentication boundaries

- Server integrations use a rotating PUSH 41 `dosvc_` credential and PUSH 42 HMAC request signature. Store it only in the partner's server-side secret store.
- A partner-control service account can provision customers but cannot read customer cameras.
- A customer-resource service account maps to exactly one active partner customer and its explicitly linked Sites.
- Browser/mobile components receive only a `doemb_` token with a maximum 60-minute lifetime, fixed audience, allowed Origin, customer, Site and scopes. Raw tokens are not stored.
- Once a customer is suspended or deprovisioned, new embedded reads are denied. An incomplete session revocation is reported to the caller. Reactivation from suspension first revokes remaining tokens and keeps the customer suspended if that cleanup fails.

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

`node --test scripts/qa/check-partner-next-loopback.mjs` runs a temporary loopback Next.js app with the external v1 and embed route modules, repository `proxy.ts`, and the application Supabase client. Its narrow REST fixture holds synthetic rows and forwards only the usage RPC to the migrated PGlite database using the server role. Two delegated SDK camera pages reach SQL and increment the usage counters. A transferred Site and a revoked account are then simulated in SQL while the earlier application-side reads remain intentionally stale. Both requests fail without incrementing the meter or returning camera data. The original embed preflight, dashboard and revocation/transfer checks still exercise Next middleware using synthetic REST rows. The fixture supplies neither the deployed Next configuration nor the full PostgREST/Data API.

`node --test scripts/qa/check-partner-postgres-isolation.mjs` exercises the checked-in partner/RLS/ACL and delegated usage SQL with the installed PGlite PostgreSQL 18.3 engine. Prerequisite tables and application claims are synthetic. In this fixture Site transfer removes camera read access for the former organization and grants it to the current organization with an active membership. Revoking that membership removes access. The embedded session table is inaccessible to application roles, and the usage RPC is executable only by the server role.

The original metering RPC accepted writes after Site transfer with a stale customer link and after service-account revocation. Migration `20261127162335_digital_observer_push43_current_usage_scope.sql` updates only the server-side meter. It rechecks the active, unexpired account, its current Site scope, the Site organization and the current delegated customer and holds the applicable rows through accounting. The test applies the migration after a synthetic historical usage write. The existing receipt and balanced counters survive, valid direct and delegated writes work, and stale links, transferred Sites, revoked or expired accounts, and suspended customers are denied. The signature, service-role ACL and usage receipt shape are preserved.

The separate [native PostgreSQL qualification](../development/database/push43-native-postgres-qualification.json) used official Supabase native binaries in a disposable, loopback-only stack on the development drive. It restored the verified 227-migration Development baseline and exact ACL, then applied 47 approved post-baseline migrations and the candidate migration in dependency order. The local Data API enforced partner row isolation and the server-only meter. PostgreSQL reported one backend blocking the other in all three transfer, revocation and metering cases. The temporary runtime and credentials were removed. The existing Development runtime and external partner gate are separate from this proof.

The follow-up `node --test scripts/qa/check-partner-next-native.mjs` ran the signed SDK and Chrome through the repository's Next routes and middleware to native Supabase/PostgREST on the same disposable stack. Two one-item pages contained only the approved Site's synthetic sources and accounted for two successful SQL usage writes. The authorized browser dashboard returned 200 without sending the host cookie. An OPTIONS probe through Next returned 204. Chrome received no data after token revocation or Site transfer, and the corresponding HTTP requests returned 403. The signed SDK also returned 403 after transfer and the usage count stayed at two. The test requires the disposable `push43-replay` native stack and verified replay state in `PARTNER_NATIVE_RUN_DIR`, its own `PARTNER_NATIVE_PSQL` from the verified cache, and the existing Playwright/Chromium runtime. This proof uses synthetic data and an isolated Next configuration.

## Remaining acceptance gates

| Gate | Evidence and minimum next check |
| --- | --- |
| Internal provisioning and SDK | The [historical Development receipt](../development/database/push43-local-product-receipt.json) covers the independent SDK sample, idempotent provisioning, cross-customer denial, branding, expiry and usage for its recorded commit. Current local qualifications exercise the signed SDK, separate-origin Chrome embedding, Next middleware and delegated SQL usage. The new lifecycle test forces revocation failure and verifies that reactivation stays closed until the old token is revoked. |
| Equivalent Development PostgreSQL | Passed in a disposable native PostgreSQL 17.11 stack. The receipt covers the canonical replay, Data API RLS/ACL, and independent-session metering races. The follow-up passed the signed SDK and browser through Next to native PostgREST. The shared Development migration state remains outside this qualification. |
| Source-specific grants and durable outbound delivery | Review and synthetic models only. A [source grant](../review-only/partner-source-authorization/README.md) still needs a trusted customer issuer and ownership fence. [Durable Webhook delivery](../review-only/external-webhook-durable-delivery/README.md) still needs committed claims, receipts, and authenticated recovery on the actual delivery path. Keep existing Site authorization unchanged. |
| External OEM/white-label partner | Open in the [external proof register](../DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json). The [independent partner conformance package](../examples/digital-observer-partner-app/CONFORMANCE.md) covers the bounded signed SDK, browser lifecycle and meter receipt. The next external step is an approved partner and data-processing agreement with a sandbox. Verify real provisioning/isolation, SSO and custom domains where applicable, signed delivery receipt, applicable vendor compatibility, attribution and settlement, and privacy/support ownership before any release decision. |

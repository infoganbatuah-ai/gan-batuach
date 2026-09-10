# DIGITAL OBSERVER — PUSH 25 SECURITY, RLS & PRIVACY HARDENING

Date: 2026-09-07

## FINAL STATUS

`PASS — DONE EARLY`

PUSH 25 establishes a deterministic security/privacy gate and hardens the canonical Product surfaces without a Production deployment and without materially changing the frozen Camera / Connector / Gateway runtime. The new database migration is intentionally unapplied under this PUSH's no-deploy rule and must precede any future application deployment.

One authenticated same-site role-overreach finding exists inside the frozen camera/evidence RLS contract. It does not expose raw media or credentials, is mitigated at the Product/API layer, is not CRITICAL or anonymously exploitable, and is explicitly registered as a mandatory post-PUSH16 prerequisite.

## ROADMAP STATE

- PUSH 1–15: `DONE`.
- PUSH 16: `OPEN / BLOCKED — independent real RTSP/ONVIF camera required`.
- PUSH 17 remains sequentially blocked until PUSH 16 passes.
- PUSH 24: `DONE EARLY`; its quality gates remain green.
- PUSH 25: `DONE EARLY`.
- PUSH 27 was not started.

## SECURITY BASELINE

Baseline was captured from clean `main` at HEAD/origin-main `f5c4725f13a4b0e6723ee1b748844d878c60a1b1`. The repository had no staged, unstaged or untracked changes. Current inventory: 121 QA files, 191 Supabase migrations, 16 direct runtime dependencies and 9 direct development dependencies.

Controls found in current code include Supabase Auth, RLS, site memberships, role-aware server access, dedicated field encryption, private media buckets, signed media access, immutable audit events, webhook verification foundations, retention cleanup, provenance isolation and release secret/artifact scans. PUSH 25 adds bounded request guards, atomic per-principal rate limiting, immutable-history grants, restrictive privacy ownership RLS, broader audit writes and a canonical security control suite.

## TENANT ISOLATION

The canonical isolation matrix covers sites, cameras, Events, Incidents, Evidence, Risk, Verification, Feedback, Watch Rules, Investigation and internal quality data. Existing write/update/delete paths remain scoped to an authorized site or privileged server path; direct client mutation of canonical evaluation history is revoked by the new migration.

Controlled live least-privilege QA completed with 9 role logins and 11 boundary assertions: all passed. Camera credentials were visible to zero tested roles. Returned rows across nine sensitive canonical tables were verified to belong only to sites owned by or explicitly assigned to the caller. The probe performed no report persistence and cleaned its synthetic sentinel.

## RLS

Deterministic inspection verifies RLS and scoped-read policy coverage for 13 critical tables:

- `observer_sites`
- `digital_observer_camera_sources`
- `observer_intelligence_signals`
- `observer_correlated_events`
- `digital_observer_event_clips`
- `digital_observer_risk_evaluations`
- `digital_observer_decision_intents`
- `digital_observer_incident_verifications`
- `digital_observer_feedback_revisions`
- `digital_observer_calibration_samples`
- `digital_observer_calibration_recommendations`
- `digital_observer_watch_rule_versions`
- `digital_observer_watch_rule_evaluations`

The new migration revokes anonymous access and browser INSERT/UPDATE/DELETE grants from immutable canonical Risk, Decision, Verification, Feedback, Ground Truth, Calibration and Watch Rule history. It also adds a restrictive child-ownership check to privacy-request INSERTs. These changes are implementation-complete but not yet Production-applied because this PUSH expressly forbids deployment.

## RBAC

Actual Observer roles are owner, admin, operator, viewer and billing, with platform admin handled separately. Owner/admin perform configuration; operator can operate within assigned sites; viewer is read-only; billing is restricted to subscription surfaces; platform admin requires server-side privilege.

PUSH 25 removed `billing` from the general Product view-role fallback. Billing remains permitted only when an endpoint explicitly requests billing access. A frozen database helper still treats every active site membership as view access; that narrower database repair is deferred in `DO-SEC-25-FROZEN-001`.

## SERVICE ROLE

Service-role usage was inventoried. The canonical admin-client module now imports `server-only`, no `NEXT_PUBLIC_*` service-role/encryption/private-key/password variable exists, and neither API responses nor logs return the key. Service-role use remains justified for background jobs, immutable evaluation persistence and bounded privileged operations; browser-role paths continue to rely on user context and RLS.

## FIELD ENCRYPTION

`FIELD_ENCRYPTION_KEY` remains the only field-encryption source. There is no fallback to `SUPABASE_SERVICE_ROLE_KEY`. Missing or malformed key state fails closed, sensitive values are not printed, and Production key rotation remains a planned versioned migration rather than an unsafe in-place action. No Production key was rotated.

## SENSITIVE DATA REGISTER

| Data | Storage / reference | Protection | Retention / logging rule |
|---|---|---|---|
| Camera/vendor credentials | encrypted server/device fields | dedicated field key; safe-column projections; never returned | retain while source active; never log plaintext |
| Device/enrollment tokens | frozen device store | scoped identity, rotation/revocation | frozen; values never logged |
| Supabase service role | server environment only | `server-only`; no public variable | never persisted to Product data/logs |
| Signed media tokens | ephemeral provider URL | authenticated issuance, 60-second TTL, no-store | do not persist or log full URL |
| Evidence/video | private storage bucket | server-authorized signed access | site policy, maximum bounded retention, scheduled deletion |
| User/known-person metadata | tenant-scoped tables | RLS/RBAC and consent/privacy guards | policy/legal review; no implicit biometric activation |
| Feedback notes | tenant-scoped feedback revisions | authorization, bounded payload, audit history | retained for calibration under stated policy |
| Investigation input/history | bounded query records where enabled | user/tenant scope, no raw SQL | configurable/privacy review; not required for answer grounding |
| Payment/provider references | subscription/integration records | privileged routes and webhook signatures | provider/legal schedule; no raw card data |

## MEDIA SECURITY

The `digital-observer-event-media` bucket is private, limited to 10 MB and approved media MIME types. Authorized Event media and identity previews require authentication, valid UUIDs, site access and per-principal rate limits. Issuance is audited, returned redirects are private/no-store with no-referrer policy, and provider URLs expire after 60 seconds. No permanent raw storage URL, bucket write credential or camera secret is exposed.

Wrong-tenant access is denied before signed URL issuance. Expired/deleted Evidence is represented as unavailable rather than a broken player. Current event-media QA confirms object deletion and truthful `retention_expired` state.

## INVESTIGATION / RULE SECURITY

Investigation and Watch Rule mutations now have same-origin enforcement for cookie sessions, bounded JSON bodies, hashed per-principal rate-limit identifiers and bounded error responses. Existing compilers remain independently schema/capability/tenant validated. Prompt text cannot authorize raw SQL, arbitrary URLs, physical actions, unsupported identity claims or another tenant's camera/zone.

## RATE LIMITING

Sensitive routes covered include login, Investigation, conversation, Watch Rules/requests, Feedback/review, privacy requests, Evidence/identity media issuance, identity/known-person mutations, settings/access and billing changes.

The previous read-then-update limiter was race-prone. PUSH 25 replaces it with a single atomic `INSERT ... ON CONFLICT DO UPDATE` RPC. The RPC is SECURITY DEFINER with a fixed search path, validates argument bounds, requires the service role, and denies PUBLIC/anon/authenticated execution. Stored identifiers are one-way SHA-256 hashes of bounded tenant/user/IP scope, preventing raw identity/IP tuples from becoming limiter records.

## INPUT VALIDATION

`parseBoundedJson` enforces declared body limits and valid JSON; route schemas bound UUIDs, enum values, strings, arrays, duration/time windows and search ranges. Safe error handling distinguishes CSRF, oversized body, malformed JSON, validation, authorization and rate-limit failures without leaking stack traces or raw database/provider errors.

## IDOR

Direct Event clip and identity preview IDs are UUID-validated, resolved to a canonical site, then checked against caller access before issuance. Privacy child IDs are checked both by caller-scoped RLS lookup and a restrictive database policy. Incident, Rule, Feedback and Investigation services retain site/tenant predicates; controlled role QA found no cross-site returned rows.

## AUDIT LOGS

Audit events now cover Evidence URL issuance, identity preview access, access-recipient/device changes, known-person readiness/removal, identity-candidate review, privacy setting changes and subscription change requests. Existing immutable audit rows have hash-chain metadata and triggers that reject UPDATE and DELETE.

Audit logging is sanitized: raw database errors and provider messages are not printed. Current application audit persistence is fail-open for availability, so an audit-store outage can omit a Product audit row. This is tracked as medium hardening debt; high-impact future mutations should use a transactional or durable outbox pattern. External WORM export is also future compliance work.

## SECURITY HEADERS / CSP

HSTS, `X-Content-Type-Options: nosniff`, restrictive referrer/permissions policy, `frame-ancestors 'none'` and `object-src 'none'` remain configured. PUSH 25 removes `unsafe-eval` and blocks inline script attributes via `script-src-attr 'none'`.

`unsafe-inline` remains in `script-src` because the current Next.js bootstrap has no nonce/hash propagation architecture. It is an explicit residual mitigation gap, not described as fully eliminated. Event handlers are blocked; framing/plugins/eval are denied; future nonce-based CSP work must be separately regression-tested.

The existing Digital Observer path-scoped `127.0.0.1:18082` media/connect exception is retained for the proven local Gateway playback contract. It is not added to the global Production scope and was not broadened in PUSH 25. Removing or replacing it is dependency-sensitive to the frozen playback/runtime architecture and must be revalidated after PUSH 16.

## CSRF / SESSION

Cookie-authenticated state-changing routes require a trusted same-origin request. Bearer-authenticated device/API traffic is exempt because browser cookie CSRF does not apply. Supabase session cookies supply the platform cookie flags; server authorization is re-evaluated on each request rather than trusting hidden UI state. Membership lookup or authorization uncertainty fails closed.

Operational verification of immediate session invalidation after every possible external role change remains a revalidation item; privileged endpoints do not rely on stale client claims alone.

## WEBHOOK SECURITY

Existing provider webhook foundations validate configured signatures, timestamps/replay/idempotency and bounded body input. No external provider was enabled or invoked. Webhook secrets remain server-side and failures do not downgrade to unsigned acceptance.

## MOCK / DEMO ISOLATION

Canonical Production guards continue to exclude MOCK, SIMULATION, SHADOW_AI, `mock`, `synthetic`, `local_shadow` and calibration fixtures from real Event, baseline, Risk, Verification, quality and normal Investigation results. The live role probe's sentinel was explicitly synthetic, used only for a boundary assertion and cleaned. No mock record was used as Production proof.

## PRIVACY DATA FLOW

`Camera/Event → Evidence → Incident → Investigation → Feedback → Calibration`

Media expiry does not automatically erase canonical factual Event/Incident metadata, Risk/Verification history, feedback revisions or immutable security audit. That surviving metadata is intentional for product audit/calibration but requires an approved legal retention map. Search exposes Evidence state truthfully as available, no-recording, expired or failed.

## RETENTION

Event-media policy supports bounded package retention of up to 24–48 hours in current product packages. The authenticated cron scans expired available/failed clips in batches of 100, deletes private storage objects first, then clears storage paths and marks metadata `expired` with `retention_expired`. A storage deletion failure is retryable and does not falsely mark the record purged.

Retention for Event metadata, Incidents, feedback/calibration, investigation history, logs and audit logs is not assigned an invented legal period. Existing controls are classified as required/configurable/legal-policy-needed in the control matrix. Final legal retention and hold rules remain for compliance closure.

## DELETE / EXPORT

Privacy-request and right-to-be-forgotten foundations exist, with safe dry-run behavior and explicit execution. PUSH 25 adds ownership enforcement so a requester cannot attach another family's child identifier. Full cross-domain subject deletion, legal-hold exception handling and portable subject export are not declared Production verified; they remain inputs to later legal/compliance closure. Immutable security/audit records may require retention rather than deletion and must be handled by approved policy.

## IDENTITY / BIOMETRIC BOUNDARY

Known-person readiness requires consent and explicitly persists `biometric_processing_active: false`. Child-handling sites retain restrictive privacy mode. Identity candidates are authorized and audited, and unsupported identity questions remain refused. PUSH 25 does not add face recognition or biometric matching.

## SECRET SCAN

- Tracked secret-shaped value scan: PASS, 0 findings.
- Public environment secret-name scan: PASS, 0 findings.
- No private key, password, service-role key, field-encryption key, authorization token or signed private media URL is reproduced in this report.

## PRIVATE ARTIFACT SCAN

Release scanning found no tracked credential file, DVR export, private media, secret screenshot, local session database, keychain export or debugging dump. One migration filename contains the word `credentials`; inspection confirmed it is SQL policy source, not a private artifact.

## DEPENDENCY SECURITY

Safe dependency patches moved `@simplewebauthn/server` to 13.3.3 and constrained `@xmldom/xmldom` to a patched release. Current audit result: **0 critical, 0 high, 6 moderate**. Remaining advisories are transitive `uuid` dependencies under Firebase/Google Storage; the offered automated remediation changes major compatibility and was not applied without a bounded upgrade program. CI continues to fail on high/critical findings.

## STORAGE SECURITY

Private camera snapshot and Event media bucket policies are enforced by deterministic storage QA. Evidence writes use server authorization and tenant/site/object metadata; clients cannot make buckets public or write arbitrary permanent evidence paths. Signed reads are issued only after record-level authorization.

## RPC / DB FUNCTION SECURITY

Repository inspection found 71 SECURITY DEFINER function definitions; 71/71 set an explicit search path. Historical routines commonly use `public`, so the new migration removes CREATE on `public` from PUBLIC/anon/authenticated to prevent browser roles from shadowing referenced objects. The new rate-limit RPC uses only `pg_catalog, pg_temp` and is service-role only.

## ADMIN BOUNDARY

Platform/internal quality views require server-side admin authorization; a hidden route is never sufficient. Cross-tenant admin operations are bounded and audited where implemented. Normal tenant users cannot retrieve platform calibration datasets or another tenant's feedback.

## FAILURE MODES

- Authentication, membership, RLS or media authorization uncertainty: deny.
- Missing/malformed field-encryption key: block the operation.
- Invalid origin/body/schema: bounded 4xx response.
- Rate-limit database unavailable: fail closed with bounded 503 rather than silently allow unlimited requests.
- Media deletion failure: retain retryable state; do not claim deletion.
- Audit-store failure: operation may continue and audit loss is logged only as a bounded code; tracked residual debt.

## SECURITY E2E

Controlled Production-like role verification used least-privilege accounts and normal Supabase paths, not a manual database bypass:

- role login: 9 PASS / 0 FAIL;
- canonical table/site boundary assertions: 11 PASS / 0 FAIL;
- camera credentials visible: 0 roles;
- synthetic boundary sentinel cleanup: PASS;
- test report persistence: disabled.

The new migration itself was not applied to Production and therefore its new grant/RPC/privacy-policy behavior is verified deterministically, not falsely labeled Production-applied.

## PERFORMANCE IMPACT

Local origin, UUID, body-size and hashing checks are in-process and bounded. Sensitive requests add one atomic database RPC rather than the previous multi-statement read/update sequence, reducing race risk and database round trips. Representative post-deployment latency for Incident fetch, Investigation and signed-media issuance was not measured because this PUSH prohibits deployment; capture p50/p95 after the migration/application pair is released during dependency-sensitive revalidation. No build or deterministic suite showed a performance failure.

## DEFERRED FROZEN FINDINGS

`DO-SEC-25-FROZEN-001` is documented in `DIGITAL_OBSERVER_SECURITY_DEFERRED_FINDINGS.md`: `can_access_observer_site` treats billing-only membership as general site access for some frozen camera/evidence RLS policies. Product/API access now blocks that role, but the durable DB split must occur immediately after PUSH 16 closes and before PUSH 17 proceeds.

No CRITICAL or anonymously/remotely exploitable frozen finding was identified. No frozen security change was silently deferred.

## FROZEN AREA DIFF

`FROZEN AREA DIFF = 0`

No material implementation change was made to `services/video-gateway/**`, Connector/Gateway core, camera adapters/resolver/source contracts, RTSP/ONVIF/DVR runtime, device identity/provisioning/heartbeat/rotation/revocation, stream relay, source ownership, camera connector migrations or active home configuration. Documentation and read-only tests may name these components.

## TEST MATRIX

| Gate / check | Result |
|---|---|
| Typecheck | PASS |
| Full lint measured baseline | 5,355 errors / 213 warnings; improved from PUSH 24 5,363 / 213 |
| Canonical lint scope | PASS — 0 errors / 0 warnings |
| Production build | PASS — 488 routes |
| Canonical domain QA | 18 PASS / 0 FAIL |
| Canonical security QA | 8 PASS / 0 FAIL |
| PUSH 25 security/privacy contract | 14 PASS / 0 FAIL; 13 RLS tables |
| Live least-privilege role boundary | 11 PASS / 0 FAIL; 9 logins |
| Migration health | PASS — 191 files, 0 duplicate timestamps, 0 new unreviewed destructive migrations |
| Secret/public-env scan | PASS — 0 findings |
| Private artifact scan | PASS — 0 real findings |
| Dependency high/critical gate | PASS — 0 critical / 0 high / 6 moderate |
| Release contract QA | PASS — clean accepted; dirty/secret/wrong-project rejected |
| Current release preflight | Correctly BLOCKED: worktree contains uncommitted PUSH 25 changes |
| Production deployment | NOT PERFORMED |
| Frozen runtime material diff | 0 |

The full legacy lint count remains tracked debt, dominated by inherited `no-explicit-any`; no new canonical lint debt was introduced. Focused touched-route lint exposed inherited legacy findings outside the zero-error canonical scope, while typecheck and all canonical gates passed.

## PUSH 25 REVALIDATION RULE

When sequential execution reaches PUSH 25:

1. Confirm PUSH 16 and its hardware evidence status.
2. Close `DO-SEC-25-FROZEN-001` by splitting billing/view DB helpers and rerun live role tests.
3. Apply/verify the PUSH 25 migration before application deployment.
4. Re-run dependency audit, migrations, typecheck, canonical lint/build/domain/security gates and clean release preflight.
5. Run post-deploy tenant/IDOR, Investigation/Rule injection, signed-media expiry and p50/p95 latency smoke checks.
6. Reassess legal retention, deletion/export and audit-durability dependencies changed after this report.
7. Convert `DONE EARLY` to `DONE` only when dependency-sensitive checks pass.

## PUSH 27 READINESS

PUSH 27 is eligible for early execution while PUSH 16 remains blocked, provided it preserves the same frozen boundary and does not depend on the deferred billing-role RLS repair. This report does not start PUSH 27.

PUSH 25 CANONICAL STATUS:

`DONE EARLY`

ARE WE READY TO EXECUTE PUSH 27 EARLY WHILE PUSH 16 REMAINS BLOCKED?

YES

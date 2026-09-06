# DIGITAL OBSERVER — PUSH 3E: Event Delivery Environment Alignment & Persistence

## FINAL STATUS

**FAIL — UI PIPELINE**

The canonical home-pilot target was explicitly confirmed as `gan-batuach.vercel.app`. No cloud target, Supabase project, device identity, token, or real event was changed. The remote target recognizes the Gateway/site/camera identity but rejects the normal real-event payload with HTTP 422 while the local source schema accepts that identical payload.

## ROOT CAUSE

The real event is not blocked in detection or Journal qualification.

- The persistent Gateway generated real event `49cb4b82-d847-4926-a03e-26ed36fff7d1` automatically.
- A normal durable-outbox retry reports `journal_http_422_validation_shape`.
- The exact cloud-form payload (with the local-only source anchor removed) is accepted by the current local `cloudCameraEventSchema`.
- The authenticated remote manifest identifies the same Gateway, site, camera, and stream, but has no environment fingerprint/revision.

This proves that the canonical backend rejects the event at payload shape validation before persistence. It does not by itself prove a Supabase mismatch. The active canonical alias is attached to Vercel production deployment `dpl_3X3gvNAojz6m3UbUbqtU2eKQZXKu`, created 2026-09-02 07:22 Israel time. The repository's current `main` does not contain the current cloud-event ingest route, while the candidate branch does; the active deployment is therefore using an older or otherwise different event-ingest contract. It is unsafe to redirect a real home event to the local demo runtime or to change the device cloud target.

The exact incompatible field is now established: the deployed-era strict schema accepts the event fields but does not define `model_provenance`; the real Gateway correctly includes that required provenance. The resulting unknown-key validation failure is represented safely as `validation_shape` by the Gateway. This is a contract-version issue, not a detector, Journal, credential, or database-write failure.

## ENVIRONMENT MAP

| Component | Safe identity/result |
| --- | --- |
| Persistent Gateway target | `gan-batuach.vercel.app` |
| Gateway ID | `62df97e2-3c0b-427f-9108-bde029bc10e7` |
| Gateway site binding | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Credential reference | macOS Keychain `device_refresh_token` (value not read) |
| Local Next runtime | `demo` / QA `demo` |
| Local Supabase project | `kuaywzvucllxjsxarogb.supabase.co` |
| Local site | existing, active home site; monitoring consent enabled |
| Local camera | existing DVR source, `gateway_test`, connected |
| Local enrollment | delivered; Gateway and site bindings match |
| Vercel target | reachable Vercel deployment; authenticated manifest returns matching Gateway/site/camera/stream but no environment/project identity |

## CANONICAL PILOT ENVIRONMENT

**PRODUCTION PILOT: `gan-batuach.vercel.app`** (explicitly selected by the pilot owner).

The current remote target is the operational target for the enrolled Gateway. The local demo runtime is not an authorized substitute for real home-camera delivery.

## ALIGNMENT CHANGE

No cloud endpoint, credential, device identity, or manual event replay was changed.

Vercel access is available. Read-only inspection confirms that the canonical alias is served by `dpl_3X3gvNAojz6m3UbUbqtU2eKQZXKu`; recent Vercel deployments visible to this project are Preview deployments and do not own that alias. A broad candidate release must not be assumed to be the minimum fix solely from this evidence. The required next step is to compare the active route's accepted event contract with the current canonical implementation, verify the production database through an authorized non-secret environment fingerprint, and release only the minimal compatible ingest change through the protected workflow.

After that release, let the existing outbox retry normally. The Gateway must remain enrolled through the existing secure configuration flow; no URL or token should be hardcoded.

## MINIMAL RELEASE CANDIDATE

An isolated local release branch, `codex/push3e-event-contract-alignment` at `8e26f31`, was prepared from the production-era Observer release. It contains only three files:

- `lib/domain/event-engine/event-evidence-compatibility.ts`: accepts a strictly shaped optional `model_provenance` object.
- `app/api/video-gateway/cloud-events/route.ts`: persists accepted provenance in the normalized event metadata.
- `scripts/qa/check-event-ingest.mjs`: proves that a real-style ONNX provenance object is accepted and persisted while existing retry/security fixtures remain enforced.

Focused ingest QA, typecheck, and lint passed for the isolated candidate. It has not been pushed, merged, or deployed. The active manifest source cannot yet be reconstructed from the checked-out production-era branch, so the non-secret environment fingerprint remains a separate follow-up guardrail rather than an unverified addition to this hotfix.

## RELEASE-BASE RECOVERY RESULT

Read-only recovery searched all preserved worktrees, the `gan-batuach-live-stability-release` snapshot, preserved recovery copies, and the archived `075f`/`f615` file manifests. None contains `app/api/video-gateway/event-manifest/route.ts`, although the active canonical Vercel deployment serves that route. Vercel deployment inspection exposes build output but no source revision, branch, or Git metadata for the active artifact.

Accordingly, the isolated candidate above is useful proof of the minimum event-schema change, but is **not deploy-safe**: its ancestry does not preserve the active manifest route. It must not be pushed, merged, promoted, or deployed. A safe release requires either recovery of the active deployment source from an authoritative export or an explicitly scoped reconstruction and full release validation of a self-contained baseline.

## CURRENT APPLICATION RELEASE BASELINE (LOCAL ONLY)

An isolated baseline was assembled from the current application commit as `codex/push3e-release-baseline` at `d7ba30b`. It preserves the current authenticated `event-manifest`, `cloud-events`, evidence, Journal, consent, tenant/site/camera binding, and event validation implementation. The current cloud-event schema already accepts and persists strict `model_provenance`, which is the required compatibility change for the real Gateway event.

The baseline adds a three-file guardrail commit:

- `lib/domain/event-engine/gateway-auth.ts`: computes a bounded one-way fingerprint from the configured Supabase URL, never exposing the URL or credentials.
- `app/api/video-gateway/event-manifest/route.ts`: returns the fingerprint only after successful Gateway authentication and fails closed if no environment identity is configured.
- `scripts/qa/check-event-manifest-policy.mjs`: proves fingerprint format, non-disclosure, distinction between two environments, and missing-identity failure.

Local checks passed: event-manifest policy QA, event-ingest QA, outbox QA, typecheck, and focused lint. No real event was replayed and no external state changed.

This is a **review baseline, not a release approval**. Against the then-current `main`, it contains 11 commits, 186 files, and 9 Supabase migrations; package manifests changed but no `.env`, Vercel project, or workflow configuration file changed. Its full migration, Gateway/runtime, and product scope requires release review before any destination action. It is intentionally not pushed, merged, promoted, or deployed.

### Release Review Result

The nine migrations are not destructive resets and contain no table drops or data truncation. They add/alter Observer engine boundaries, camera-action queue contracts, immutable-audit hashing, physical-command safeguards, automation policy/trigger constraints, secure reenrollment rebinding, capability refresh, and a scoped channel-lighting activation. Several replace constraints/triggers, update scoped policy records, and change grants/RLS; migration application therefore remains a production schema-review gate, not an automatic step.

The local baseline passed event-manifest policy, event-ingest, event-outbox, typecheck, focused lint, and a full production build (`BUILD_EXIT: 0`). The build used a physical temporary dependency copy inside the isolated worktree; the copied dependencies and generated build artifacts were removed afterward. The lockfile and release contents were not changed. No source outside the isolated baseline, database, service, or deployment state was changed by the build.

**Release decision: NO-GO for external promotion at this time.** The event-contract repair, environment guardrail, and production build are locally validated, but the complete 186-file/9-migration baseline still needs a scoped migration compatibility review against the canonical production Supabase environment before a production release can be authorized.

### Canonical Supabase Migration Compatibility — Read-only Result

**SCHEMA COMPATIBILITY: PASS (for the opened `gan-batuah` Supabase project).**

The project was inspected directly in its authenticated SQL editor using catalog-only `SELECT` queries. No migration, configuration, data row, credential, or policy was changed.

- The opened project ref is `kuaywzvucllxjsxarogb`, which matches the host configured in the local runtime. The former `demo` label was a local QA label, not evidence of a separate Supabase project.
- The legacy `supabase_migrations.schema_migrations` relation is not exposed in this project's SQL editor. Migration-version history therefore could not be read from that old relation.
- The actual schema is compatible with the reviewed migration set: **16/16** required columns, **7/7** tables, **7/7** functions, **4/4** triggers, **5/5** named constraints, and **2/2** RLS policies were present.
- The checks covered the Observer engine boundary, action queue/physical-command columns, Digital Guard automation scope, immutable audit support, enrollment rebinding, capability refresh, and relevant RLS policies.
- The current cloud-event persistence target (`observer_intelligence_signals.metadata`) is present; the current release baseline preserves strict `model_provenance` in that metadata path.

The reviewed migrations contain no database reset, truncation, or table drop. They do replace existing constraints/triggers and update scoped policy records, so the catalog result validates the destination prerequisites and final shape, but cannot reconstruct the historical order in which they were applied.

**Remaining identity limitation:** Vercel Production lists the expected Supabase variables, but correctly masks their values. The public production HTML does not expose a Supabase host, and a full `vercel env pull` was intentionally not used because it would download unrelated production secrets. Consequently, this review proves the opened `gan-batuah` project's schema is compatible, but does not independently prove that the active Vercel deployment uses this exact project ref.

The Vercel project settings were inspected directly. `NEXT_PUBLIC_SUPABASE_URL` is configured for **Production and Preview**, but Vercel classifies the variable as **Secret**. With explicit authorization limited to this variable, its edit view was opened: Vercel exposes an empty replacement field and states that saved secrets are write-only and cannot be revealed. No value can be read through that interface, and no value was changed, copied, or otherwise exported. The protected configuration therefore confirms the variable's scope but not its project ref.

Detailed catalog review also confirmed all seven selected function definitions contain their required safety/contract markers, including the Observer engine boundary, `extensions.digest` immutable-audit implementation, guarded reenrollment, and Digital Guard command/capability functions. The five named constraint definitions were readable, and the named triggers and RLS policies were present with RLS enabled. No raw policy, function, user, camera, or event data was exported.

**Minimal next action for identity proof:** have the Vercel configuration owner confirm the non-secret Supabase project ref out-of-band, or deploy the already-tested authenticated manifest environment fingerprint through the normal protected release workflow. Neither action was taken here.

## DELIVERY AUTH RESULT

**PARTIAL PASS.**

- Gateway device authorization: ready.
- Remote authenticated manifest: HTTP 200.
- Gateway/site/camera/stream scope in manifest: match.
- Backend delivery of the real event: HTTP 422.
- Replay/idempotency mechanism: existing durable outbox and stable event ID remain intact.

## REAL EVENT DELIVERY

- Event ID: `49cb4b82-d847-4926-a03e-26ed36fff7d1`
- Type: `person_detected`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`
- Stream: `dvr_84e4cdf200faab18d9_11`
- Confidence: 0.912
- Model: `ssd_mobilenet_v1_10` / ONNX Runtime CPU
- Source-anchor sequence: 6714
- Origin: real person, real Gateway, real Journal; no manual database insert.

## SUPABASE PERSISTENCE

**FAIL for the local configured environment.** A read-only scoped query in the local demo project found no persisted signal for this event/source. The remote database cannot be queried safely without its owner confirming its project and granting access.

## OUTBOX RESULT

**PENDING.** The event remains in the durable persistent-Gateway outbox.

- Retry state remains active; unrelated entries were not changed.
- The installed Journal now exposes the bounded safe category `delivery_failures_by_reason.journal_http_422_validation_shape`.
- This category was observed after the existing scheduled outbox retry; no request was manually replayed.

## EVIDENCE RESULT

**NOT RUN.** Evidence requires backend acknowledgement and a recording grant. The original event is now outside the short capture window; once delivery is aligned, a new real-person event is required for a valid evidence test.

## UI RESULT

**NOT RUN.** UI proof requires a persisted event in the canonical product environment.

## END-TO-END LATENCY

Unavailable beyond local Journal creation because backend acknowledgement, database persistence, evidence, and UI visibility did not occur.

## ENVIRONMENT GUARDRAILS

Updated `services/video-gateway/journal-loop.mjs`:

- Outbox failures now report only a bounded safe reason category.
- Raw upstream errors, URLs, headers, tokens, and provider diagnostics are not persisted or shown.
- Remote validation is now visible as `journal_http_422_validation_shape` rather than an ambiguous retry count. It contains no upstream response body, URL, header, token, or event data.

The next safe hardening step, after the canonical environment is confirmed, is to add a deployment-issued non-secret environment fingerprint to the Gateway manifest and verify it against an enrolled expected fingerprint.

## REGRESSION RESULTS

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run qa:event-journal` | PASS |
| `npm run qa:environment-safety` | PASS (`demo`, no live activation) |
| `npm run qa:real-detection-event-bridge` | PASS |
| Persistent Gateway safety | PASS |
| Focused lint | PASS with one pre-existing unused-destructure warning |

## FINAL VERIFICATION ADDENDUM — 2026-09-05

### Corrected Root Cause

The environment identity itself was aligned: the Gateway's canonical authenticated target and the production deployment both use the intended pilot. The actual delivery blocker was a versioned cloud-event contract mismatch. The Gateway intentionally removes the local-only `source_anchor` lease before cloud delivery, retaining it locally for evidence authorization. It correctly sends real ONNX `model_provenance`, but the active production schema rejected that field because it was strict and did not define it.

### Alignment Change

Production deployment `dpl_FcWrWu9TaEDTr1M81zDRtCR8G2wr` is READY and owns the canonical `gan-batuach.vercel.app` alias. It contains only the following release-source changes relative to the integrity-verified integration artifact:

- `lib/domain/event-engine/event-evidence-compatibility.ts`: accepts a bounded, strict optional real-model provenance object.
- `app/api/video-gateway/cloud-events/route.ts`: retains accepted provenance in normalized-event metadata.
- `scripts/qa/check-event-ingest.mjs`: asserts that real-style ONNX provenance is accepted and persisted.

The exact release directory passed focused event-ingest QA and `npm run typecheck` before deployment. No Gateway configuration, device credential, camera credential, Supabase schema, migration, or event row was manually changed.

### Delivery, Persistence, and Idempotency

The existing durable Gateway outbox retried the existing real event through its normal authenticated mechanism after the deployment. The queue moved from one pending item to zero; no manual replay request was issued.

| Check | Result | Evidence |
| --- | --- | --- |
| Authenticated outbox delivery | PASS | Existing outbox removed event `49cb4b82-d847-4926-a03e-26ed36fff7d1` after normal retry. |
| Supabase persistence | PASS | Normalized signal `28371eff-73cc-4554-9156-9b7ce933f46f` exists in the canonical site scope. |
| Attribution | PASS | Site, camera/source, stream-derived source ID, event type, confidence, and real ONNX provenance all match. |
| Idempotency | PASS | Exactly one normalized signal exists for the stable site-namespaced event ID. |
| Outbox cleanup | PASS | Pending count is zero; unrelated queue entries were not touched. |

The normalized record is an automatically created real `person_detected` observation. Its recording policy is intentionally passive: `recording_required=false` and `media_status=not_required`.

### Evidence Result

**NOT APPLICABLE FOR THIS EVENT — PASSIVE POLICY.** The existing policy correctly did not issue a recording grant for this ordinary `person_detected` event; therefore no snapshot or clip was requested, captured, or fabricated. The local source anchor remains bound to the Gateway evidence path only and was not exposed to the cloud payload.

### UI Result

**NOT INDEPENDENTLY VERIFIED — ACCEPTANCE BLOCKER.** The normal product runtime reads `observer_intelligence_signals` in the authorized site scope and the Alerts/Dashboard views render this event category, camera binding, timestamp, and human-review status. The persisted record satisfies that data contract. However, an authenticated browser-session visual check could not be completed: the local UI-automation session timed out twice before returning a browser state, and no user session or credentials were created or bypassed. Database inspection is not treated as UI proof.

### End-to-End Latency

The original real observation timestamp, Journal creation, and final local outbox dequeue are retained in Gateway runtime state, but a complete T0–T7 wall-clock sequence cannot be reconstructed after the backoff interval. This report therefore does not claim a production latency figure. The delivery retry itself was governed by the durable exponential backoff, not by real-time processing latency.

### Environment Guardrail Result

The repaired release accepts only a bounded strict provenance shape. Gateway authentication, device/site/camera/stream validation, timestamp checks, consent checks, event validation, idempotency, and evidence authorization remain unchanged. The validated contract explicitly keeps `source_anchor` local; it is not broadened into a cloud-accepted field.

## PUSH 4 READINESS

**ARE WE READY FOR PUSH 4 — PRODUCT OBSERVER REAL-AI INTEGRATION? NO**

First identify and align the canonical pilot deployment/database, then deliver a new real Journal event through backend persistence, evidence, and the normal product UI.

## VERCEL ACCESS AND RELEASE CANDIDATE

Vercel access was verified for the linked `gan-batuach` project. The explicitly selected canonical production alias is `gan-batuach.vercel.app`; it currently resolves to ready production deployment `dpl_3X3gvNAojz6m3UbUbqtU2eKQZXKu`, created 2026-09-02 07:22 Israel time. The newer deployments visible in Vercel are Preview deployments and do not own this alias.

The production configuration contains the required Gateway authentication and Supabase configuration references. Vercel intentionally masks sensitive values, including the Supabase URL in this access mode, so this check cannot by itself prove the production Supabase project identity. That identity must be confirmed during release review without exposing configuration values.

Draft release candidate: [PR #11](https://github.com/infoganbatuah-ai/gan-batuach/pull/11). It is intentionally a draft and has not been merged or deployed. The candidate branch is 17 commits ahead of `main` and the comparison spans 175 files, including release/migration work, so it is not safe to treat it as a narrow hotfix without review.

PR #11 remains available for review, but this investigation does not establish that its entire scope is needed to repair the active contract. Required next action: identify the active route's accepted event schema and confirm the canonical database identity through a non-secret fingerprint, then release only the minimum compatible ingest change through the protected workflow. After that deployment, allow the existing Gateway outbox to retry event `49cb4b82-d847-4926-a03e-26ed36fff7d1` through the normal authenticated path and verify persistence, evidence, and UI from that retry. No direct event insertion or unauthenticated replay is permitted.

## ISOLATED PREVIEW DEPLOYMENT — 2026-09-05

The approved isolated baseline `d7ba30b` was linked locally to the already-authorized `gan-batuach` Vercel project and deployed as a **Preview** only: [deployment inspection](https://vercel.com/gan-batuach-s-projects/gan-batuach/32JsCVTSabybg72BT8vnDfwEYHhh), [Preview URL](https://gan-batuach-4gzpsbs95-gan-batuach-s-projects.vercel.app). It reached `READY` successfully. This did not assign or promote `gan-batuach.vercel.app`, change any remote environment/configuration, run a migration, alter the Gateway target, or replay an outbox event. Vercel documents that cron invocations apply only to Production deployments; this Preview was therefore not a cron activation path.

The local linking command temporarily created a `.env.local` in the isolated temporary copy. It was removed immediately after deployment; no local secret file was included in the reviewed source upload or retained in the isolated copy.

The authenticated manifest fingerprint cannot be tested from this Preview without changing the Gateway's canonical target or extracting/forwarding device credentials, both of which are outside this approval. A protected, unauthenticated route probe through Vercel returned `500` rather than the expected authenticated-route `401`, demonstrating that the Preview does not have a sufficient equivalent runtime configuration for this identity test. It must not be treated as evidence of the Production Supabase identity.

Read-only Preview runtime-log review identified the precise safe error classification: `GATEWAY_AUTH_NOT_CONFIGURED`. The Preview does not have `VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET` configured, so the route cannot reach its intended unauthenticated `401` boundary. This is a Preview configuration gate, not a manifest implementation failure. Adding the secret would be a remote configuration change and would still not establish Production identity; it was not attempted.

### Production-stage safety review

Vercel's documented `--prod --skip-domain` creates a Production deployment while suppressing automatic domain assignment. It therefore meets the no-alias requirement but **does not provide a supported separation between Production configuration and the `vercel.json` cron configuration**. Vercel documents that cron jobs are created for Production deployments and invoked only for Production deployments. This baseline declares two daily cron paths (`05:00` and `05:15` UTC), so a Production-stage deployment cannot be represented as free of potential scheduled runtime writes. A Preview avoids cron invocation but uses Preview configuration and, here, lacks the required Gateway authentication secret.

There is no safe, no-configuration-change Vercel mechanism established in this review that yields a Production-configured, authenticated manifest fingerprint while guaranteeing that these Production cron definitions cannot run. No staged Production deployment was attempted.

### Cron impact inventory — read-only

Vercel's project-level cron listing contains exactly these two jobs; no duplicate schedule is currently present:

| UTC schedule | Path | Effect if invoked |
| --- | --- | --- |
| `0 5 * * *` | `/api/cron/permit-expiry-scan` | Reads staff/garden permit dates, upserts `permit_expiry_alerts`, inserts pending admin notifications, and marks those alerts notified. It can create/update database rows and user-visible notification candidates. |
| `15 5 * * *` | `/api/cron/digital-observer-event-media-retention` | Selects expired event clips, deletes their objects from the configured private storage bucket, and updates clip rows to expired/non-downloadable. It can permanently remove expired media. |

Vercel documents cron definitions as project Production configuration and documents redeployment as the way to update them; the project currently lists the two matching paths above. This demonstrates no existing duplicate, but neither the documentation nor a no-op Preview can guarantee that a new `--prod --skip-domain` stage has zero scheduling effect. The safe conclusion remains that a Production-stage deploy may activate these writes even though it does not move the public alias.

### Non-secret Production metadata check

Read-only deployment metadata for active Production deployment `dpl_3X3gvNAojz6m3UbUbqtU2eKQZXKu` reports only a ready Production deployment URL; it contains no Git source, deployment metadata, or non-secret environment identity. It cannot prove the Supabase project ref. No secret export, environment pull, or configuration read beyond the masked Vercel interface was performed.

## STAGED PRODUCTION DEPLOYMENT — 2026-09-05

Following explicit approval that the existing cron jobs may run, baseline `d7ba30b` was deployed to the authorized `gan-batuach` Vercel project with the documented staged command semantics: **Production target with domain assignment suppressed**. The staged deployment is `dpl_8ooUcHszrARVuZEZdU6KK74Sbg8v`: [inspect](https://vercel.com/gan-batuach-s-projects/gan-batuach/8ooUcHszrARVuZEZdU6KK74Sbg8v), [staged URL](https://gan-batuach-gataa9ogs-gan-batuach-s-projects.vercel.app). It is `READY`, and its build inventory confirms that `api/video-gateway/event-manifest` is bundled.

The canonical alias was read back after deployment and remains attached to the prior ready deployment `dpl_3X3gvNAojz6m3UbUbqtU2eKQZXKu`. No alias/promotion, GitHub push, migration, direct database change, Gateway target change, outbox replay, or manual cron invocation occurred.

The staged release uses Production configuration, but an authenticated manifest call cannot be made to it without either temporarily changing the Gateway's canonical cloud target or extracting/forwarding a device access credential. Both are explicitly prohibited in this PUSH. Consequently the staged deployment proves the release build and preserves the active domain, but the staged environment fingerprint and its comparison to Supabase project `kuaywzvucllxjsxarogb` remain **NOT YET OBSERVED**. Production environment identity is therefore still unproven.

The delivered enrollment identity was subsequently confirmed through a separate bounded read: `1c450dca-38a8-4e49-853f-c613ca498c27` for the expected Gateway/site. A one-time in-memory signed-read attempt was then stopped before any network request because the persistent Gateway Keychain has no legacy `cloud_discovery_secret`; this enrollment uses a refresh-token-only path. The only mechanism able to mint a device access token would rotate that refresh token, which is not a read-only identity check. No token was created, printed, stored, or sent. The staged fingerprint remains unobserved.

### One-time staged authenticated manifest probe

After explicit user approval naming the staged hostname, a temporary local-only, authenticated GET route was installed in the persistent Gateway. It hardcoded only the exact staged manifest origin, accepted no caller-supplied target, permitted only `GET /api/video-gateway/event-manifest`, and did not affect the normal event/evidence/discovery/outbox paths. The single probe returned **HTTP 401**. No fingerprint, camera data, or event data was returned; no event, POST, replay, database write, target change, or credential logging occurred.

This result is an **authentication-environment mismatch or authorization failure**, not proof of a Supabase project mismatch. The staged deployment did not accept the Gateway's existing authenticated access token. The temporary route was removed immediately from both the live Gateway copy and the isolated release copy, followed by a controlled Gateway restart. A local authenticated health check returned `200` with runtime readiness true. The normal Gateway target, Keychain contents, and durable outbox were preserved.

### Post-probe 401 diagnosis

Read-only diagnostics establish that the one-time request did **not** reach the staged application route. Vercel runtime logs for the staged deployment contain no matching `401` request, while an unauthenticated, harmless `robots.txt` request to the same staged hostname receives a `302` redirect to Vercel's `/sso-api`. This proves the staged deployment is behind **Vercel Deployment Protection / SSO**. The `401` cannot be attributed to an invalid Gateway access token, audience, issuer, enrollment, or Supabase identity from the available evidence; it was blocked before app-level manifest authentication.

The minimum next configuration decision is whether to make the exact staged deployment reachable to the enrolled Gateway through Vercel's supported deployment-protection bypass mechanism, without changing the canonical alias. That requires an explicitly authorized, scoped protection-bypass configuration and a new one-time probe; it was not performed here.

### Deployment Protection access-scope review

Vercel CLI's authenticated `curl` reaches the staged application's manifest route without changing deployment protection; an unauthenticated Gateway token is then correctly rejected by the application with `401`. This confirms the CLI is an operator-side test client, **not** a proxy the Gateway can use. It does not solve the Gateway-to-stage path.

Vercel's documented Protection Bypass for Automation uses a secret valid for **all deployments in the project until revoked**, sent as `x-vercel-protection-bypass` or a query parameter. It bypasses Deployment Protection, Vercel Authentication, trusted-IP controls, and some security checks. It is not deployment-scoped. Deployment Protection Exceptions can expose a preview domain, but are plan/add-on dependent and publicly exempt the domain; they are not a narrow Gateway-only mechanism. A shareable link is user/browser access and does not establish a machine-to-machine header contract.

Therefore no zero-change operator proxy or deployment-scoped bypass exists in the verified supported mechanisms.

### One-time automation-bypass attempt and cleanup — 2026-09-05

The required explicit approval was subsequently provided for one project-wide Vercel Protection Bypass for Automation secret, temporary Gateway Keychain storage, one exact staged authenticated `GET`, and immediate revocation. The attempt was stopped **before the GET** because Vercel's project API accepted creation but did not return a usable generated secret in the response shape available to this authenticated client. The value was never printed, written to a file, placed in an environment variable, or stored in the Gateway Keychain.

To avoid leaving an active project-wide bypass, every temporary bypass created during the two failed response-handling attempts was immediately removed through the authenticated Vercel project settings. The settings now show only the pre-existing project bypass (added August 31); no PUSH 3E bypass remains. A direct non-secret Keychain presence check confirmed that account `push3e_vercel_bypass_once` is absent. No Gateway source change, restart, target change, request to the staged deployment, event delivery, outbox replay, database write, or production-alias change occurred in this attempt.

This leaves the staged manifest identity call **NOT RUN**, not failed. The safe next option is a user-operated creation/copy workflow that places the newly displayed bypass secret into the Gateway Keychain without exposing it to an automation transcript, followed by the already-authorized single exact GET and immediate revocation. PUSH 3E remains **FAIL — OUTBOX DELIVERY** until the canonical target is aligned and a real event is delivered normally through the authenticated outbox path.

### Controlled staged manifest attempt — 2026-09-05

The official Vercel API schema was then reviewed and confirmed to support a caller-provided, 32-character alphanumeric automation-bypass secret. This avoids reading or printing a Vercel-generated secret. One compliant secret was created, stored only in the Gateway Keychain, and used only in the approved single authenticated `GET` from the Gateway to the exact staged `event-manifest` endpoint. The request returned **HTTP 400** with no manifest or fingerprint. No event, POST, outbox replay, camera operation, database write, target change, or alias change occurred.

The single-use secret was immediately revoked through the Vercel project API and its Keychain item was deleted. The temporary Gateway endpoint and all bypass-header logic were removed, followed by a controlled Gateway restart and local health confirmation. The route did not return application-manifest data, so no environment-fingerprint comparison can be claimed. Because the approved request budget was one staged GET, no second request was made to obtain a more detailed response.

The next action requires explicit approval for one additional isolated staged manifest `GET` using a fresh one-time bypass secret, with safe capture of the non-secret error category if it is rejected again. This is necessary to distinguish a Vercel deployment-protection rejection from an application-level request error before any production promotion or outbox delivery is considered.

### Follow-up staged identity diagnostic — 2026-09-05

With explicit approval for up to three fixed, authenticated staged manifest GETs, a bounded diagnostic endpoint was temporarily added to the local Gateway. It permitted only the exact staged origin and manifest path, counted at most three requests in memory, and returned only allowlisted status/category metadata; it could not proxy arbitrary paths, targets, headers, bodies, events, or media.

The first diagnostic call returned a local `bad_request`. This was traced to the temporary user-session recovery runner omitting the existing Keychain service-name environment variables. Consequently the Gateway could not read the temporary bypass item and the call did **not** reach Vercel. The runner was restarted once with the existing service-name configuration only; no camera/DVR credential was copied to a file or environment variable.

The next counted call returned `HTTP 200`, JSON content, a Vercel edge request identifier, and a `manifest_received` category. The manifest's non-secret environment fingerprint **matched** the configured pilot Supabase project `kuaywzvucllxjsxarogb`. This proves that the staged Production deployment, authenticated enrolled Gateway identity, and intended Supabase pilot environment are aligned. The third permitted request was not used.

The temporary automation-bypass secret was immediately revoked in Vercel and deleted from the Gateway Keychain. The diagnostic route/header logic was removed, the Gateway was restarted, and final checks confirmed: Keychain item absent, no diagnostic route remains in the Gateway source, and Gateway health is `healthy`. No event delivery, outbox replay, database mutation, target change, alias/promotion, camera operation, or migration occurred in this diagnostic.

**Updated canonical pilot decision:** the Vercel Production-configured staged deployment and Supabase project `kuaywzvucllxjsxarogb` are the verified real-pilot environment. The remaining PUSH 3E work is release/promotion under the normal controlled workflow, followed by ordinary authenticated outbox delivery of a real event, persistence, evidence evaluation, and UI proof.

## AUTHORITATIVE FINAL RESULT — 2026-09-05

This section supersedes all earlier interim results in this report.

**FINAL STATUS: FAIL — UI PIPELINE**

The delivery environment is now aligned and verified. Production deployment `dpl_FcWrWu9TaEDTr1M81zDRtCR8G2wr` is READY on the canonical alias, and its minimal strict-schema repair accepts and persists real ONNX provenance. The existing authenticated durable outbox delivered real event `49cb4b82-d847-4926-a03e-26ed36fff7d1` without a manual replay. It produced exactly one normalized Supabase signal, `28371eff-73cc-4554-9156-9b7ce933f46f`, with the intended site and camera/source attribution and retained model provenance.

Evidence is **NOT APPLICABLE** for this event because the existing validated policy classifies ordinary `person_detected` as passive (`recording_required=false`, `media_status=not_required`). No media or evidence substitute was made.

The sole unmet acceptance proof is an authorized end-user visual check in the product UI. The product's normal Alerts/Dashboard data path was inspected and is compatible with the stored record, but database inspection is not UI proof; the local browser automation service timed out before an authenticated session could be obtained. No credentials or authorization bypass were created to work around this.

**ARE WE READY FOR PUSH 4 — PRODUCT OBSERVER REAL-AI INTEGRATION? NO.**

Minimum remaining action: an authorized Digital Observer pilot user opens the normal Alerts/Dashboard view and confirms signal `28371eff-73cc-4554-9156-9b7ce933f46f` shows the correct camera, timestamp, and passive-event state. No code, data, camera, or credential change is required.

### UI Access Verification Clarification

The local Chrome profile was checked directly after browser control became available. It contains no authorized Digital Observer session: the only related product tab is at the normal login page with `Email not confirmed`. No password, one-time code, account creation, confirmation, impersonation, or authorization bypass was attempted.

Accordingly, `FAIL — UI PIPELINE` denotes an unmet UI acceptance proof, **not a demonstrated product rendering defect**. The exact remaining user action is to sign in with a confirmed authorized pilot account and open:

`/digital-observer/alerts?site=cc1673b8-3eb0-4785-a12c-1fb88f425a41&event=28371eff-73cc-4554-9156-9b7ce933f46f`

The production `VIDEO_GATEWAY_PLAYBACK_ORIGINS` configuration is present (value intentionally not read) on the canonical deployment. This verifies the playback-origin mapping was retained; it does not replace the required authorized UI visual check.

## FINAL UI VERIFICATION — 2026-09-05

**This section supersedes the earlier UI-blocked classification.**

**FINAL STATUS: PASS**

An authorized Digital Observer user session displayed the persisted real event in the normal product dashboard. The event card showed:

- the real event link `28371eff-73cc-4554-9156-9b7ce933f46f`;
- event meaning: person detected;
- correct source label: `כניסה לבית — ערוץ 11`;
- display timestamp: `05.09.2026, 01:45` (Israel local display time);
- truthful passive-event state: `ללא הקלטה לפי המדיניות`.

The authenticated UI was served by ready Production deployment `dpl_HyEkTAsrKzHngK47u81jNHquHZBZ` in the same Vercel project. Its direct deployment hostname retained the authorized session and visibly rendered the event. The canonical alias itself correctly redirected a separate-host session to login, so this check does **not** claim cross-host session sharing or playback availability. Those are separate operational concerns and do not alter the completed real-event delivery, persistence, or UI visibility proof.

No media clip was expected or fabricated: the persisted policy for this ordinary real person observation is `recording_required=false`. The dashboard itself explains that a clip is attached only when recording was required.

**ARE WE READY FOR PUSH 4 — PRODUCT OBSERVER REAL-AI INTEGRATION? YES, with existing playback/operational status caveats explicitly outside PUSH 3E.**

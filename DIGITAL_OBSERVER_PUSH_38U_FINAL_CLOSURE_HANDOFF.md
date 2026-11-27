# PUSH 38U final-closure attempt — qualification handoff

Status: **NOT READY FOR LIVE RUNTIME TRANSITION**. This handoff extends, and does not erase, `DIGITAL_OBSERVER_PUSH_38U_BLOCKER_REPORT.md` and `DIGITAL_OBSERVER_PUSH_38U_SCOPE_EXTENSION_HANDOFF.md`. Owner: PUSH 38 qualification. Branch: `codex/push-38t-qualification`. Integration of incomplete PUSH 38 remains pending. No Home runtime activation, trust installation, OTA staging, Production deployment, Production migration, main merge, canary, pre-soak, V8, or PUSH 39 was performed.

## Scoped source correction

The previously implemented exact-Edge HTTPS playback-origin contract was preserved. The separate legacy channel-only playback route could still produce a local gateway address; this attempt now makes that path development-loopback-only and returns an unavailable response to a remote Product client. Five pre-existing lint errors in that route were resolved with explicit selected-row types; no lint rule was disabled. The remote-playback QA guard now asserts the channel-only fail-closed boundary. This is **source-level**, not a released Product or phone playback proof.

## Actual qualification state

| Gate | Result | Evidence / blocker |
| --- | --- | --- |
| Dedicated QA migrations | **FAIL (full drift)** | Representative PUSH 38 schema and RLS checks passed, but the isolated database has no `supabase_migrations.schema_migrations` history and independent baseline provenance is unverified. Do not fabricate migration history. |
| Real Gateway / Connector Ed25519 identity | **FAIL / unproven** | Installed Connector has legacy refresh-token material but not the expected Ed25519 key files; the Gateway key was absent or inaccessible in the exact configured store. No real challenge response or owner-verified public-key binding exists. Synthetic bridge tests do not substitute for this. |
| Scoped HTTPS control/media ingress | **FAIL** | Existing Cloudflare Tunnel public hostname routes all paths to the local Gateway. Anonymous HTTPS `GET /health` returned 200, demonstrating broader exposure than permitted. No new ingress was activated. |
| Media-provider authorization and cost | **BLOCKED** | Cloudflare's documented Free/Pro/Business public-Tunnel video-delivery restriction requires an approved eligible paid media path or another reviewed route. Neither a cost-incurring activation nor an architectural replacement was authorized here. |
| Exact-device manifests / public trust / OTA staging | **NOT PERFORMED** | Real cryptographic device identity and safe ingress are prerequisites. No broad cohort was changed and no signed metadata was issued. Existing private R2 artifact round-trip proof is preserved. |
| Remote phone DVR/Tapo playback | **NOT PROVEN** | The Product fix remains unreleased, the approved HTTPS media endpoint is absent, and no authorized separate-device visual test was observed. Never infer phone playback from relay health. |
| Home Gateway | **10/10 progressing at latest read** | Local read-only health: `healthy`, 10 streams, 0 failed, 10 progressing, 0 stalled. This is a checkpoint, not reliability qualification. |
| Home Connector/Tapo | **0/1 progressing at latest read** | Local read-only health: top-level `healthy`, one connected/active source, but 0 progressing and 1 stalled. Root cause remains unresolved; top-level health is not sufficient. |
| Runtime baseline hashes / Product playback / AI | **NOT RECHECKED / NOT PROVEN** | Do not reuse older hashes or infer Product/AI success from local service health. |
| Restricted supplier-cost ledger | **UNCHANGED** | No new chargeable Cloudflare, AWS signing, or R2 resource/operation was intentionally activated. No authoritative new monetary cost was measured. |

## Verification

TypeScript, canonical lint (`lint:ci`), local production-compatible build, migration source check, release-contract check, domain suite (30/30), security suite (7/7), managed-identity/OTA/R2/legacy-bridge synthetic suites, isolated ingress and remote-playback boundary checks passed. The first build attempt was blocked by the execution sandbox's local port restriction; the approved local rerun completed successfully without a deployment. Dependency audit found **0 High/Critical and 6 Moderate** transitive findings; no package remediation was attempted. Source and synthetic checks do **not** close the missing live gates.

## Stop and next action

Keep the current runtime unchanged. Reconcile the isolated QA database baseline/history; implement and review the *same-device* legacy-to-Ed25519 possession bridge with Product-side trusted enrollment evidence; resolve the broad public Gateway exposure; choose a provider-permitted, cost-reviewed HTTPS media delivery route; attribute the current Tapo stall; then rerun live trust, auth, staged downloads, exact baseline hashes, Product/phone playback, AI, and complete candidate CI. Do not use a caller-supplied device ID or copy Production HMAC/private keys into QA. The present candidate is `PRESERVED_PENDING_INTEGRATION` until PUSH 38 is fully qualified.

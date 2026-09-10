# DIGITAL OBSERVER — PUSH 34 STORAGE PORTABILITY REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS`

Canonical PUSH 34 is DONE. Scoped PR #15 passed every required check, merged into `main`, and the implementation was verified in `origin/main` at merge SHA `471c52c5beedb9a6649c3214fa7bab5df871bd47`.

## AUDIT / REUSE

PUSH 34 reused the existing private Supabase Evidence bucket, Event-bound media capture, signed Product endpoint, PUSH 21 durable media work, PUSH 25 authorization, PUSH 27 telemetry, PUSH 33 usage provenance and PUSH 13 Investigation references. It did not alter Event/Incident semantics or create a second Evidence pipeline.

Prior direct-provider coupling existed in three runtime locations: cloud media upload, Product signed access and retention deletion. Those now call `observer-storage-v1` for new Evidence. A named compatibility branch preserves pre-contract objects until verified migration.

## STORAGE CONTRACT AND BACKENDS

- Backend A: private Supabase object storage through `createSupabaseStorageBackend`; current bucket privacy and 60-second Product access remain.
- Backend B: real local filesystem/NAS-style provider through `createLocalNasStorageBackend`; root confinement, atomic `.partial` rename, integrity, mediated access, deletion and health are implemented.
- Contract QA: 7 operations × 2 backends passed, including write/read/stat/integrity/authorized access/delete and wrong-tenant denial.
- NAS statement: implementation is READY for a scoped mounted path; real network NAS appliance deployment is future external operational proof.

## RETENTION / LEGAL HOLD

Backend-independent policy and executor passed not-yet-eligible, eligible, legal-hold, backend-delete failure, retry and final tombstone tests. Canonical state changes only after backend deletion. No real Evidence was deleted.

## INTEGRITY / MIGRATION

SHA-256 and byte metadata are persisted for new Evidence. Migration QA passed success, duplicate retry, interrupted copy, target mismatch, source unavailable and tenant mismatch. Every failure retained the old canonical reference; successful migration switched only after reread/hash verification.

## AUTHORIZATION / TENANT / PATH SECURITY

Supabase signed access remains behind authenticated Product Site access. Local NAS emits opaque expiring mediated grants and no raw path. Wrong tenant/Site access failed on both adapters. `../`, absolute IDs and parent symlink escape failed before read/write. No storage credential, private path or signed URL is logged.

## OFFLINE, COST AND HEALTH

PUSH 21 remains the pending media delivery owner; storage availability is set only after confirmed write. Storage emits directly-metered byte usage with no invented monetary rate. Backend health is distinct from camera health.

## REAL EVIDENCE

Established real proof remains Evidence `3c385ada-3ab4-45d8-b9b1-2ae88e4cdd78` from PUSH 13: an authorized Production Investigation result opened the private Evidence route and playback advanced to `00:01`. PUSH 34 preserved that route and its bounded compatibility path. A fresh read-only Production probe found no currently accessible `available` Evidence row for the QA account, so this PUSH does not claim a new live object read or real-media migration. Controlled non-sensitive bytes proved the second backend and migration without risking the only real copy.

## SOURCE RECORDING / INVESTIGATION

`observer-source-recording-reference-v1` binds tenant/Site/source/system/recording/time/retrieval authorization without raw credentials. It preserves future Investigation access to customer DVR/NVR/VMS/NAS archives without treating them as Event Evidence.

## REAL HOME REGRESSION

Read-only bounded verification after implementation: 10/10 physical DVR cameras progressing, six DVR slots empty/unassigned, Tapo 1/1 progressing, total 11/11 physical cameras, zero stuck streams and zero duplicate Site/device/source. Playback was preserved by the read-only runtime test but not reopened in Product UI during PUSH 34; no camera configuration changed.

## QA / SECURITY

- Storage portability suite: PASS.
- Canonical domain gate: 25/25 PASS.
- Security gate: 7/7 PASS.
- Migration health: PASS, 202 migrations, no new destructive migration.
- Typecheck: PASS.
- Existing event-media compatibility: PASS.
- Final lint/build/release and PR checks: recorded by the completion gate below.
- Deferred billing-role RLS finding remains open and unchanged.

## NORTH-STAR

Two evidence-led transitions: Customer-hosted recording access `NOT STARTED → FOUNDATION` because a safe source-recording reference now exists without a retrieval adapter; Retention `PARTIAL → IMPLEMENTED — NEEDS REAL PROOF` because provider-independent execution, legal hold and failure behavior pass, while legal approval and Production deletion proof remain. Counts become 24 DONE + REAL PROOF, 33 IMPLEMENTED — NEEDS REAL PROOF, 64 FOUNDATION, 17 PARTIAL, 51 NOT STARTED and 1 EXTERNAL; total 190, ownerless 0.

## GIT / PR COMPLETION

- Branch: `codex/push-34-storage-portability`
- Implementation commit: `a95f9f2ed8dcd8d973cc8f1efb6b0fe3ecc1f356`
- Pull Request: [#15](https://github.com/infoganbatuah-ai/gan-batuach/pull/15)
- Required checks: canonical quality, static quality, Production build, domain regression, migration safety, security/isolation, release preflight, Snyk and Vercel all passed.
- Merge/final `origin/main`: `471c52c5beedb9a6649c3214fa7bab5df871bd47`
- Verification: implementation commit is an ancestor of `origin/main`; the canonical storage contract and this report are present in that tree; the merged-main Vercel deployment completed successfully.

PUSH 35 remains not started and requires a separate instruction.

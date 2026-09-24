# PUSH 38T — isolated qualification handoff

Observed 2026-09-19 UTC. Result: **NOT READY FOR LIVE RUNTIME TRANSITION**. This is a development-only qualification candidate. No Home runtime, live trust, Production database, main branch, integration/development branch, Vercel Production deployment, canary, pre-soak or V8 was changed or started.

## Candidate and exact accounting

- Source: remotely preserved `codex/push-38q-r2-auth` at `2175a5e9273f0f348838b6686cad514d3764aa68`.
- Dedicated candidate: `codex/push-38t-qualification`; use its pushed HEAD as `QUALIFICATION_CANDIDATE_SHA`. Do not merge incomplete PUSH 38 into integration/development.
- The PUSH 38S machine inventory accounts for 124 changed files against integration/development: 92 pending functional/supporting files and 32 evidence-only files. Of the 124, 32 paths are application, library, service, release-script or migration source paths. The original set remains traceable in the remote source branch; evidence files are not runtime payload. New 38T work adds local QA enrollment/ingress code and replaces one unapplied R2/Supabase-storage draft migration in this candidate with an audit-only R2 migration at a non-colliding timestamp.
- `INTEGRATION_AFTER_QUALIFICATION=PENDING`. Moving Management work was not merged into this candidate.

## Dedicated database and ingress

- The isolated local Supabase project `gan-batuach-push38t` runs in a separate Colima/Docker context. Its published API and Postgres ports are bound to `127.0.0.1` only; Studio, SMTP, realtime, public signup and seeds are disabled. It contains no Home enrollment, release rollout or Production user data.
- A pinned, schema-only Development baseline (`development-c0cf2de7-20260919-v1`, source integration commit `c0cf2de7e11e6e9b368fdd1fc3a068ce544ca55d`) was verified against its provenance and applied to the empty QA database. The direct historical replay was unsuitable because a historical enum migration uses its new value within the same transaction. The partially initialized QA-only volumes were discarded and rebuilt; no other database was changed.
- Three PUSH 38 migrations were applied to this isolated database: terminal recovery, private-download authorization audit, and HOME_QA channel. Representative schema/RLS/grant checks pass. `npm run qa:migrations` passes with 209 files and no duplicate timestamps. A complete live-schema fingerprint/drift comparison and migration-history reconciliation remain **unproven**; the baseline derivation is not represented as a normal Supabase CLI replay.
- The actual Next.js qualification route has answered locally from the isolated Full Stack. It is fail-closed for enrollment administration and permits only an already enrolled device's Ed25519 `authenticate` action in qualification mode. Private delivery remains disabled until genuine device enrollment, signed metadata and secret-scoped startup are ready.
- A separate loopback-only OTA ingress proxy allows only enrollment authentication, update discovery and private-download authorization, with bounded payloads and no cookie forwarding. Local exposure tests deny dashboard, admin, unrelated API, Supabase and anonymous privileged requests. No public HTTPS tunnel was created; external ingress exposure QA is **not passed**.

## Device boundary and unresolved live gates

- A public-key-only reconciliation contract requires the exact Gateway and Connector enrollment/device/Site/tenant/profile/version records, distinct Ed25519 public keys, and an independently owner-verified read-only Product witness. Eight synthetic negative/positive cases pass. The restricted importer has dry-run default and refuses evidence inside the Git worktree. These checks do **not** authenticate the witness file by themselves.
- Owner-verified real-device public-key evidence has not been provided to the isolated QA environment. No real Home device was enrolled. No Production HMAC secret, private device key, Production service credential or signing private key was copied into QA.
- No new exact-device AWS-signed HOME_QA manifests, root-authorized trust registry, live protected trust installation, real-device authentication proof, replay/expiry proof or private R2 staging was performed. Historical broad rollout remains historical source; the isolated QA database has zero active rollouts, but no replacement active exact-device rollout exists. Earlier three-artifact R2 round-trip proof is preserved and not repeated or overstated here.
- Live Home baseline hashes, current DVR/Tapo progression, playback and AI readiness were **not rechecked** in this step. The earlier Tapo 0/1 observation remains unresolved until a current read-only diagnosis.

## Verification on this candidate

- TypeScript: PASS on the dedicated source candidate, 2,500 compiler files, approximately 2.2 GiB TypeScript memory. The former mixed 38S candidate exhausted 4 and 6 GiB; the exact inclusion responsible was not isolated. Therefore the historical OOM root cause is **not claimed resolved**, although this candidate typechecks.
- Local Production-compatible build: PASS; no Vercel deployment. Canonical lint baseline: PASS, zero regressions. Security gate: 7/7 PASS. Domain gate: 30/30 PASS. Release contract, migration-file health, enrollment unit cases and loopback ingress exposure cases: PASS. Targeted OTA, identity, R2 authorization and signing/trust suites passed earlier on the preserved source; no live AWS signing operation was repeated here.
- The 2 ms SQLite-dominated queue-overhead observation remains separate from worker-scaling acceptance. The prior 211→291 jobs/s (1.38×) limitation is retained. Two recent 2 ms ratios were 1.277× and 2.237×, illustrating host/queue variance rather than a stable compute-scaling contract. The 8 ms worker-scaling fixture retains the original 1.5× threshold: prior repeated ratios were 2.60×, 3.01× and 2.43×; two recent candidate ratios were 2.124× and 2.689×. A third candidate run also passed but its detailed ratio was not retained. These are synthetic/local measurements, not live camera throughput.
- Dependency audit reached npm: zero HIGH/CRITICAL and six MODERATE transitive advisories with fixes available; no dependency update was made.

## Safe next action

First obtain the two devices' **public-key-only** capture and independently authenticated Product/Site witness under restricted storage, reconcile exact identifiers and validate the QA DB enrollment transaction. Then configure an isolated, secret-scoped delivery startup; issue AWS-signed exact-device releases and public trust registry; run exact-candidate CI and complete migration drift; only then create short-lived route-limited HTTPS ingress and conduct live trust/device/expiry/staging checks. Do not activate either runtime until a later explicitly gated PUSH 38 step.

No new paid Cloudflare/AWS resource was created in this step; the dedicated database and proxy run locally. The single restricted supplier-cost ledger needs no new supplier charge entry. The previously authorized private R2 objects remain unchanged.

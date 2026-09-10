# DIGITAL OBSERVER — PUSH 35 PORTABLE DEPLOYMENT REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS ON VERIFIED PR MERGE`

Canonical PUSH 35 becomes DONE only when the scoped implementation PR passes required checks, merges into `main`, and `origin/main` is verified. The final handoff records the immutable PR and SHA evidence.

## IMPLEMENTATION

- Added `observer-portable-deployment-v1`, standard cross-platform Edge runtime paths and explicit configuration/dependency/artifact inventory.
- Removed the real Gateway installer's fixed `/private/tmp` fallback and the local DVR helper's personal checkout fallback.
- Corrected the root Gateway Docker build context and pinned the canonical runtime to Node 22.22.0; Web container runs non-root.
- Added `observer-portable-backup-v1`: deterministic records, secret-field rejection, SHA-256 object integrity, tenant-bound restore, stable IDs and idempotent upsert.
- Added atomic checksummed model acquisition and license/version inventory.
- Preserved PUSH 18 identity, PUSH 19 OTA, PUSH 21/31 queues, PUSH 22 Fleet, PUSH 27 telemetry and PUSH 34 storage contracts.

## DEPENDENCY / MACHINE AUDIT

Runtime scan reports zero known developer `/Volumes`, username, historical checkout or fixed QA-session path dependencies. Personal visual reference and historical staging helpers remain explicitly developer-only and are not included as runtime requirements. Required Product files are tracked; secrets remain external by design.

## DATABASE / BACKUP / RESTORE

- Migration inventory after rebasing onto the current `origin/main`: 203 ordered tracked SQL files, unique timestamps, chain SHA-256 `281794882cb3a53275fd8bcc7f4255734403907585027f7c9d2dbbd0988f51f4`.
- Isolated PostgreSQL-compatible restore: 11 representative canonical records across tenant, Site, Camera Source, managed device, Fleet relationship, configuration, Event, Incident, Evidence, storage reference and queue state.
- Restore retry remains 11 records, preserving IDs and tenant/Site ownership.
- One controlled Evidence object is restored through PUSH 34 storage and SHA-256 verified.
- Tampered records, secret-shaped payloads and tenant mismatch fail closed.
- Full provider-native Supabase Auth/PITR restore remains an operational/provider drill; no claim of a Production disaster-recovery exercise is made.

## CLEAN ENVIRONMENT

`npm run qa:digital-observer-clean-environment` passed twice after the harness defects it exposed were fixed; the final implementation-commit run completed in 126,329 ms. It used an isolated tracked Git archive under the operating-system temporary directory, fresh `npm ci`, pinned Node 22.22.0, portable Edge bootstrap, portability/restore QA, typecheck, build, verified model acquisition, built Web start and `/api/health`. No existing `node_modules`, `.env.local`, `.vercel` state or hidden runtime state was copied; manual technical steps were zero. The clean install reported six Moderate dependency advisories and no High/Critical advisory; remediation remains dependency-maintenance work and was not hidden or force-upgraded in this PUSH.

## REAL HOME

Read-only real-home verification passed in 5,650 ms without changing Site, Gateway, Connector, camera sources or storage policy: 10/10 populated DVR channels progressing, six channels `CHANNEL_EMPTY / UNASSIGNED`, Tapo 1/1 progressing, 11/11 expected physical cameras progressing, zero stuck streams and zero duplicate Site/device/source rows. Playback was preserved by the read-only test but was not reopened visually in Product UI during PUSH 35; the last canonical Product playback proof remains unchanged.

## EXTERNAL / CONTINUING EVIDENCE

- Full provider-native Supabase PITR/Auth restore drill.
- Real network NAS/customer archive deployment.
- Apple/Windows public package signing evidence retained as external distribution work.
- Horizontal scaling, HA and multi-region recovery remain PUSH 36–38.
- Deferred billing-role RLS finding remains open and unchanged.

## NORTH-STAR

`Distributed processing` moves `FOUNDATION → PARTIAL`: clean Web and worker deployment contracts now exist, but horizontal/multi-node Production proof remains PUSH 36. Other affected rows gain evidence without status inflation. Final counts: 24 DONE + REAL PROOF, 33 IMPLEMENTED — NEEDS REAL PROOF, 63 FOUNDATION, 18 PARTIAL, 51 NOT STARTED, 1 EXTERNAL; total 190, ownerless 0.

## PUSH 36 BOUNDARY

PUSH 36 remains not started. PUSH 35 does not implement horizontal scaling, HA or failover.

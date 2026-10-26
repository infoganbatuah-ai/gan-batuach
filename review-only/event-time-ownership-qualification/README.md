# Model A event-time ownership: isolated diagnostic, NOT APPLIED

Scope: review-only source qualification. No real database, clone, migration, RLS/ACL change, active route, provider, or Guard action. The source branch `codex/event-ingest-replay-identity-20261025@341ff2bf` has 61 unmerged commits relative to `integration/development@b305491c`; it is preserved separately. The copied guarded SQL is byte-identical to `review-only/event-risk-processing-ownership/HOME-REGISTRATION-RECEIPTS-NOT-APPLIED.sql` on that branch (SHA-256 `b0e313f5d76e7faf6c2d104da3873205df6974a0a3faf9d2980a280aa89cc2e5`). This package does **not** promote that SQL to a migration or replace the source branch.

## Source-grounded authority chain

Approved Model A chain: customer Tenant → Site → registered Source → accepted Signal/Event → Incident → Risk Decision. At event acceptance, a server-owned transaction must select a *qualified* immutable registration version and atomically persist canonical Signal identity, exact Tenant/Site/Source/owner/version, an acceptance reference, and mandatory audit. Later binding and replay must refer to that acceptance/version, never the current Site organization or a device timestamp. A mutable recipient/settings snapshot is a separate decision-time contract; a registration owner is not a recipient grant.

Existing schema/route does not yet implement that chain. `20260820010000_digital_observer_product_runtime.sql` has a nullable Site→organization reference with `ON DELETE SET NULL`, and a current Source→Site reference. `20260606003000_multi_camera_correlation_engine.sql` permits nullable Incident Site association. `app/api/video-gateway/cloud-events/route.ts` reads current Site/Source, not historical Tenant, inserts the Signal via a separate Data API operation, and may later update its metadata. Neither a current Site lookup nor Signal metadata proves historical ownership. `review-only/event-risk-processing-ownership/RPC-BODIES-NOT-APPLIED.sql` currently reads current Site organization for claims; its isolated claim-prefix PASS does not remove this event-time blocker.

| Case | Required authority | Current result |
| --- | --- | --- |
| New event | Qualified owner/version locked and accepted with canonical Signal in one transaction | Acceptance writer absent; BLOCKED |
| Same-source renewal | New qualified version; old accepted events retain original version | Synthetic binding retained v1 after pointer moved to v2; limited PASS |
| Source transfer between Sites/Tenants | Versioned predecessor/successor with serialized cutover and exact acceptance boundary | Current `registration_identities.source_id UNIQUE` and fixed composite identity prohibit this; BLOCKED |
| Old event replay | Immutable server receipt and Incident/Signal linkage | No historical receipt means fail closed, not backfill from current Site; synthetic denial PASS |
| Null Site, absent/conflicting owner | No claim, binding, or writer commit | Deployed relationship/history not proven; BLOCKED |
| Cross-Site/Tenant Signal | Receipt must be inseparable from Signal's exact Site/Source and Incident | **Failed in source draft:** synthetic cross-Site Signal accepted and bound under another Site |
| Organization changes | Historical acceptance/version unchanged; current organization not consulted on replay | No deployed immutable authority; BLOCKED |

## Reproducible isolated finding

Run `node review-only/event-time-ownership-qualification/run-isolated-postgres-qa.mjs` only on the verified local `colima-gbi` Docker context with the already-installed PostgreSQL 17.6 image. The runner uses `--network none`, no host mount or TCP listener, bounded resources, read-only image plus tmpfs, and always stops its throwaway container. Both SQL files abort when directly executed; the runner removes their guards in memory **only in the disposable database**. This is PostgreSQL behavioral evidence for the copied proposal, not deployed-schema, real Home, RLS-inheritance, or crash-durability proof.

On 2026-10-26, 12 focused checks passed as diagnostics: direct guards, fixed-version binding/idempotence, old-version replay, missing historical acceptance, role denial, append-only trigger, incompatible transfer rejection, and reproduction of the cross-Site false binding. A successful reproduction of that last case is a **security gate failure**, not a passing ownership implementation.

The concrete flaw: `event_acceptances.event_id` references only `observer_intelligence_signals(id)`. Its registration-version FK proves internal receipt consistency but not equality to the Signal's Site/Source. `bind_accepted_event_v1` checks receipt→version, not receipt→Signal/Incident. The fixture created a Signal at Site B/Source B, a receipt for Site A/Source A using that Signal ID, and the bind function returned a binding. A trusted acceptance writer must reject this atomically; a later mutable Signal metadata comparison cannot by itself supply immutable event-time truth. Until then, no claim or fenced writer may consume this binding as historical authority.

## Exact blockers before any Development migration or activation

1. Independently verified Home owner/registration authority and transfer semantics, including who may qualify or revoke, server acceptance cutover, immutable mandatory audit, and restricted writer role. Source: `PROSPECTIVE-HOME-REGISTRATION.md` and guarded SQL; no qualification/acceptance RPC exists. Required: reviewed authority contract and exact source-backed implementation.
2. Canonical Signal and receipt must be inserted in one transaction with a composite Site/Source/registration check, unique event identity and semantic duplicate comparison. Source: cloud-events route and guarded SQL; present route uses separate Data API writes. Required: reviewed atomic server adapter; no direct-DB or service-role shortcut in clients.
3. Incident linkage must be established from the same authoritative Signal/Event scope and enforced by the four proposed fenced writers. Source: nullable Incident Site/link contracts and existing four-writer review; no immutable deployed join established. Required: precise schema/function compatibility and isolated PostgreSQL tests.
4. Historical Home Signals without qualified receipts remain unowned/ambiguous, not silently attributed from current `observer_sites` or nullable organization fields. Source: `HOME-MAPPING.md` and `OWNERSHIP-SNAPSHOT-COMPLETION.md`. Required: owner-approved case-by-case adjudication if historical processing is desired; this package performs none.
5. Real catalog, role inheritance, Data API exposure, RLS, concurrent transfer/acceptance, crash recovery, and rollback have not been qualified against an authorized isolated target. Source: review-only proposal and synthetic fixture only. Required: separate authorized migration review and isolated database rehearsal before application. The existing source proposal itself is **NOT SAFE TO APPLY** as event-time authority.

No new migration, executed SQL on a real database, active ingestion change, or Guard dispatch is included. Historical records and all 61 source commits remain preserved. This is a reviewable diagnostic package, not Model A completion.

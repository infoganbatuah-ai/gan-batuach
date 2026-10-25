# Home registration / Event Risk retention decision — proposal only

Status: **UNRESOLVED; no retention duration, cleanup, deletion or storage activation approved.**
Data owner: Digital Observer Product/security, with privacy/legal review of the
actual category schedule and legal holds. This brief concerns proposed
registration/processing metadata, not source recordings or media.

## Source-grounded boundary

- `supabase/migrations/20261019050000_digital_observer_push45_privacy_compliance.sql`
  defines Digital Observer Event/Alert metadata, Evidence and source-recording
  reference policies with `retention_period_days = null`,
  `status = 'needs_legal_review'` and automatic execution disabled. These
  entries do **not** approve periods for the new registration or Risk records.
- `lib/domain/digital-observer/privacy-compliance.ts` returns `REVIEW` when
  a retention policy is not externally approved and preserves an active legal
  hold. `AGENTS.md` requires a defined owner, sensitivity, recovery coverage
  and retention before activating new data. Existing audit-log policy entries
  are not an automatic legal decision for a new immutable registration audit.
- The guarded SQL package has no active registration, acceptance, binding,
  claim or receipt store. The four downstream Risk writers remain blocked.

## Bounded Development read and operational-clock inventory

At **2026-10-25 21:14 UTC**, the owner-authorized, bounded **READ ONLY** check
used the verified original `colima-gbi` / `supabase_db_gan-batuach-integration`
container and an explicit read-only PostgreSQL transaction (10-second statement,
1-second lock timeout). It selected only aggregate policy flags and exact
proposed-table catalog presence: the five PUSH 45 Digital Observer policies
listed in the migration are present; **5/5 have a null retention period,
5/5 need legal review, 0/5 permit automatic execution, and 5/5 require a
legal-hold check**. The exact proposed Risk claim, plan and effect-receipt
tables are **0/3 present**. No individual record, Auth data, credential or
policy JSON was read. No SQL write, clone or runtime change occurred. This is
Development state, not Production or future-schema proof.

The following bounds are *engineering behavior*, not approved retention for
the five proposed categories above. "Source" means inspected code/migration;
"observed" means the bounded gbi aggregate above. Neither proves a live
Home Event replay window or a lawful deletion date.

| Dependency | Established bound and class | What remains unbounded or unproven |
| --- | --- | --- |
| Gateway offline Event queue | **Source:** `services/video-gateway/durable-offline-queue.mjs:36-42,57-59,91-96` defaults to 7 days from queueing, permits a configured 1-minute to 30-day range, removes pending/failed payloads after expiry, and caps each retry backoff (default 300 seconds). `services/video-gateway/journal-loop.mjs:46-50,225-258` supplies no retention override and retries Event delivery; its 60-second/5-attempt branch concerns media capture, not Event retention. | No hard attempt-count cap for Event delivery; the queue can expire an undelivered Event. Its configured/default duration neither guarantees all Event replay nor authorizes deletion of server acceptance/binding or audit. Installed Home runtime configuration was not inspected here. |
| Accepted Event replay | **Source:** `app/api/video-gateway/cloud-events/route.ts:27-37,63-105` accepts authenticated backfill, rejects timestamps over 60 seconds in the future and checks stable-ID semantic duplicates. | No maximum *past* Event age or bounded period for canonical Event/Incident/Risk reprocessing is defined here. A 60-second live/backfill classification is not a retention cutoff. |
| Proposed Risk claim recovery | **Disconnected source only:** `lib/domain/digital-observer/event-risk-recovery.ts:4-5,53-60,100-117` caps each lease at five minutes and permits renewed leases and higher-epoch takeover. `review-only/event-risk-processing-ownership/DRAFT-NOT-APPLIED.sql:138-140` defines no TTL or cleanup. **Observed:** the three exact proposed Risk tables are absent in gbi. | No cumulative retry/takeover lifetime, pending-effect resolution deadline, or deployed durable recovery clock. A per-lease limit cannot become a claim retention period. |
| Notification delivery | **Source:** `lib/domain/digital-observer/notification-orchestration.ts:130-151,178-195` gives each delivery a default 1-hour validity, clamped to 60 seconds–24 hours, and bounded retry backoff; `supabase/migrations/20260820010000_digital_observer_product_runtime.sql:265-275` defaults to three attempts (allowed 1–10). | Delivery expiry/dead-letter/unknown outcome does not define how long decision-time recipient/settings references, delivery evidence or complaints must remain. Provider callback, dispute and audit retention are not bounded by these TTLs. |
| Incident and appeal | **In-memory projection source:** `lib/domain/digital-observer/incident-correlation.ts:115-175` closes on a matching exit and correlates an open track within ten minutes. | Ten-minute correlation is not an Incident closure SLA, appeal window or permissible evidence disposal date; no category-specific dispute horizon was established. |
| Backup, restore and rollback | **Schema source:** `supabase/migrations/20260612013400_business_continuity_backup_disaster_recovery.sql:48-92` permits nullable RPO/RTO targets in restore runs/plans; a field is not an approved or met objective. **Review contract:** `review-only/event-risk-processing-ownership/FORWARD-AND-ROLLBACK.md:51-65` retains active claims/effects and declares compatibility-first rollback blocked pending rehearsal. | No verified coverage or retention for the **not-yet-created** registration/Risk stores, no numeric backup-copy deletion horizon, and no finite mixed-version rollback window. Existing Development backup/restore receipts cannot prove coverage of future tables. |

**Retention lower bound: NOT COMPUTABLE.** The 7-day default queue, 24-hour
maximum delivery TTL and 5-minute lease cap constrain different components;
they cannot be added or selected as a common record-retention period. A future
category schedule must cover the last permitted Event retry/replay, active or
recoverable claim/effect, Incident disposition and challenge, recipient/setting
reconstruction, backup/restore and compatible rollback dependency, subject to
legal hold. Several of those maxima are undefined. No automatic deletion,
redaction or backup expiry is authorized by this inventory.

## Exact category decisions required

All triggers below are **proposed decision points**, not approved expiry dates.
An active claim, pending mandatory effect, unresolved Event/Incident, legal
hold, or untested recovery dependency prohibits automatic disposal.

| Proposed category | Purpose / sensitivity / owner | Replay, recovery, appeal and hold dependency | Proposed retention clock trigger | Fact needed to choose an actual period |
| --- | --- | --- | --- | --- |
| Registration versions and current pointer | Bind one Tenant, Home Site, Source, owner and qualified version; owner/profile identifiers are restricted personal metadata; Digital Observer Product/security | Historical versions must remain addressable by accepted Events and owner-transfer/conflict review; current pointer must survive Source recovery | Version: supersession **plus** all bound Events/claims and appeals resolved; pointer: governed Source retirement/transfer | Maximum Event replay and recovery window, dispute/appeal window, ownership-transfer procedure, lawful purpose and hold scope |
| Server Event acceptance and immutable binding | Prove that a particular Event was accepted under an exact registration version; security/evidence metadata; Digital Observer Product/security | Event replay, incident reconstruction, wrong-Site challenge and isolated restore require the original receipt/binding | Final Event/Incident disposition **plus** last retry/restore/appeal dependency | Event/Incident lifecycle, backup retention/RPO, challenge window and legal basis; never infer from media retention |
| Authorization, conflict and transfer audit | Explain who approved or rejected scope changes without retaining credentials or raw sessions; restricted security/identity metadata; Product security and privacy owner | Security investigation, dispute, audit integrity, revocation and legal holds | Closure of the associated decision/investigation **and** hold release | Audit obligation by context/jurisdiction, required fields, redaction method, access roles and legal sign-off |
| Risk plan, claim and effect receipts | Recover one fenced processing outcome and mandatory effects without duplicate or lost work; restricted operational/evidence references; Risk Product/security | Active leases, incomplete effects, Incident generation, Outbox retries, rollback and Guard eligibility cannot be orphaned | Durable completion **including** all mandatory effects and known external-outcome handling | Maximum retry/recovery/rollback horizon, external acknowledgment semantics, incident linkage and backup/restore period |
| Recipient/settings reconstruction references | Reproduce the original decision without expanding recipients after settings change; potentially sensitive recipient metadata; notification Product/privacy owner | Delivery retry, complaint, consent/revocation interpretation and semantic-intent conflict checks | Last relevant delivery decision and retry/appeal resolution | Minimum fields/reference method, notification consent policy, complaint window, approved deletion/redaction semantics |

Source recordings, clips, media objects, biometric or other identity material,
and investigation case contents are **separate data classes**. A reference
to them is not permission to copy their bytes into these records or apply
their retention schedule. Their existing gates and storage owners remain
independent. Notification recipients are not expanded by registration.

## Policy directions for owner/privacy/legal decision

1. **Lifecycle-linked:** retain linked registration, acceptance and Risk
   metadata until the last Event/Incident/effect/replay dependency closes,
   then apply a reviewed category-specific post-closure period. This best
   protects replay but makes expiry dependent on accurate lifecycle links.
2. **Layered minimization:** keep full operational references only while
   processing/retry needs them, then retain a smaller integrity-preserving
   binding/audit reference under a separately approved schedule. This can
   reduce personal-data exposure but needs a demonstrated restore/replay and
   semantic-conflict test before any compaction or redaction.
3. **Context-specific schedules:** decide distinct Home and other Product
   context/jurisdiction periods with explicit legal-hold overrides. This
   avoids incorrectly importing another product's rule but increases policy
   and migration complexity. No context may silently inherit a period.

Minimum external input: Product/privacy/legal must select the applicable
direction and approve an actual period **per category and context**, lawful
purpose, trigger, hold/appeal exceptions, disposal or redaction method, and
who may authorize/review it. They must also establish the operational retry,
replay, backup and restore windows that the period must cover. Until then,
schema activation and cleanup remain blocked. This does not reopen the
already-approved Model A / owner-registration direction, and it grants no
Platform Admin or cross-owner transfer authority.

# Home registration / Event Risk retention — engineering baseline, not activation

Status: **ENGINEERING_BASELINE_READY; EXTERNAL_LEGAL_APPROVAL=false;
REAL_DATA_ACTIVATION_READY=false.** The earlier unresolved legal and operational
facts below remain historical evidence, not a prohibition on disconnected
source implementation or synthetic tests. No active retention duration,
cleanup, deletion or storage activation is approved **for these proposed
registration/Risk records**.
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

## Owner-delegated engineering policy v1 — 2026-10-25

This is an **internal design profile for Israel/Home**, not legal advice,
external approval, a deployed rule, or a conclusion that every customer or
supplier is in one jurisdiction. It is versioned as
`do-retention-engineering-v1`, with source `owner-delegated-policy-v1` and
status `ENGINEERING_BASELINE`. Customer, subject, processing and supplier
locations must be established separately before relevant real-data use.
`lib/domain/digital-observer/retention-engineering-baseline.ts` is a
disconnected, deterministic **dry-run** evaluator. It imports existing privacy
context/data-class types; it does not replace the active
`privacy-compliance.ts` gate, create another legal-approval registry, connect
to Supabase, or run a cleanup job. An `ELIGIBLE_FOR_REVIEW` result never
authorizes deletion or collection.

The engineering choice is lifecycle-linked retention plus layered
minimization. For operational metadata only, the **30-day post-closure
margin** begins after the *last* relevant lifecycle, retry, replay, dispute,
recovery or backup/restore dependency closes. It is an internal review margin,
not a legal appeal period or evidence that those dependencies are finite.
The evaluator refuses a shorter period when jurisdiction, classification,
policy version or replay/restore horizon is missing. It never invents a
closure to start a clock.

| Engineering category | Review clock; not automatic expiry | Separate authority and data boundary |
| --- | --- | --- |
| Registration version/current pointer | Keep the current pointer while Source remains active. For a superseded version, review no earlier than 30 days after supersession **and** the last bound Event/claim/effect/replay/restore dependency. A retired current Source requires an explicit retirement time. | Event-time Tenant→Site→Source version binding survives later owner changes; ambiguous history remains unqualified. No new `homeId`, ownership transfer or Platform Admin right is inferred. |
| Server Event acceptance/binding | Review no earlier than 30 days after authorized Event/Incident closure and the last claim/effect/complaint/replay/restore dependency. | Never orphan a recoverable Event or replace its original registration binding. |
| Risk claim/plan/receipt | Review no earlier than 30 days after durable completion and all claim, mandatory effect, external-outcome, replay, restore and rollback dependencies. | Lease expiry is not completion; unknown external outcome remains unresolved. Guard dispatch/acknowledgment remains a separate gate. |
| Recipient/settings reconstruction reference | Review no earlier than 30 days after delivery, complaint, replay and restore dependencies. | Keep only the smallest decision-time references; never expand a revoked recipient during replay or substitute new mutable settings. No address/content is required when a protected reference suffices. |
| Registration/business diagnostic audit | Review 30 days after investigation and restore dependencies, **only when explicitly classified as not a covered technical security log**. | No raw credentials, JWT, Cookies, Auth payload or media. Misclassification cannot shorten a covered log. |
| Technical security-compliance log | **Conditional Israel profile:** 24 *calendar* months from the technical log event, or later if hold/restore dependency requires it, only when the relevant security rules actually apply and the record is classified as a covered technical log. | Does not apply 24 months to every Event, recipient, business audit or recording. Actual database security level and log applicability require pre-use verification. |
| Temporary debug/telemetry | Seven UTC days in **synthetic QA only**, when explicitly classified non-sensitive, not a covered security log, and no hold/dependency exists. | No real-data default or route to shorten required audit. |
| Clips, source recordings, evidence bytes, biometrics, child-sensitive and investigation contents | **No new duration here; `WAIT_POLICY`.** | Metadata references are not permission to copy raw media or adopt another class's schedule. |

The evaluator accepts only a trusted-server designation and explicit
category, context, jurisdiction, purpose, policy version, security-log
applicability, timestamps, hold and dependency states. This type/marker does
not itself authenticate a caller; no runtime caller is wired. Its output is
limited to `KEEP_REQUIRED`, `WAIT_DEPENDENCIES`, `WAIT_POLICY`,
`ELIGIBLE_FOR_REVIEW` or `INVALID_INPUT`, with enumerated reason codes,
policy version and earliest review time when calculable. Dry-run aggregates
expose category, status, reason, count and next review date only—no IDs,
names, recipient lists, tokens or evidence payloads. A policy-version change
requires review, never retroactive purge.

Priority is invalid/contradictory input → active hold → policy/scope/security
classification → current registration or unresolved dependencies → review
clock. A released hold does not clear a replay/restore dependency. An unknown
provider outcome is not a delivery acknowledgment. Missing or unbounded
replay/restore horizon returns `WAIT_DEPENDENCIES`; it does **not** silently
become an infinite approved retention policy. Legal holds require authorized
purpose, narrow scope, dated review and authorized release in a future
governed implementation; the local dry-run consumes only a trusted status.
An exception-review target of 30 days and an annual excess-data review are
planning requirements, not timers or automatically released holds.

All timestamps in the evaluator are strict UTC ISO strings; the 30/7-day
engineering margins are 24-hour UTC days. The 24-month security-log clock
adds calendar months to the **original** event time. A nonexistent destination
day clamps to month-end (for example, 2024-02-29 + 24 months becomes
2026-02-28), without iterative month-by-month drift. Tests include exact
boundaries, leap years, replay, old Event references, lease/effect recovery,
unknown outcomes, holds, version changes and sanitized reports. These are
synthetic source tests, **not** PostgreSQL concurrency, RLS, restore or legal
applicability proof.

Backup retention and live deletion remain separate. A future controlled
disposal process must track backup rotation, access, holds and approved
deletion replay after restore; a small protected tombstone needs its own
purpose and period. No backup, active row, audit record or source recording
is deleted by this policy. Before any real deletion: bounded dry-run,
candidate review, authorization, race-safe execution, audit and tested
restore behavior are mandatory.

### Official-source boundary and pre-real-data checklist

- The [camera guidance 4/2012](https://www.gov.il/BlobFolder/service/registration_in_the_database/he/42013.pdf)
  treats recording need and retention as purpose- and context-dependent; it
  supplies no universal 30-day camera rule. Home applicability must be checked
  for the actual site, not inferred from the guidance title.
- The authority's [periodic-excess-information guidance](https://www.gov.il/BlobFolder/reports/id_collecting/he/collection%20of%20id.pdf)
  cites regulation 2(c)'s annual necessity review. This calls for a documented
  review, not indefinite retention while policy is pending.
- The [regulation 17 guide](https://www.gov.il/he/pages/data_security_guide?chapterIndex=19)
  describes 24-month secure storage for the specified technical security
  data; the [regulation 10 guide](https://www.gov.il/he/pages/data_security_guide?chapterIndex=12)
  addresses access logging for medium/high-security databases. Applicability
  and covered fields are a separate real-data classification decision.
- The authority's [Amendment 13 Q&A](https://www.gov.il/he/pages/tikun13_qa?chapterIndex=6)
  includes indirect identifiability and the purposes-based controller concept:
  an internal ID/hash is not automatically anonymous, and an `owner` variable
  is not a legal controller finding. Registration exemption does not erase
  other privacy duties. [External-provider guidance](https://www.gov.il/BlobFolder/reports/election-2023-accessible/he/elections_2023_portal_Information%20security%20guide%20for%20contracting%20with%20an%20external%20party.pdf)
  raises applicable provider-use, oversight and end-of-engagement handling.
  Official search extracts were available on 2026-10-25; several direct
  gov.il pages/PDF openings returned 403. This is not a review of every
  consolidated legal provision.

**Before the affected real-data capability is activated**, identify the
actual controller/processor, customer and subject jurisdictions, lawful
purpose and notice, database security level, covered technical-log fields,
relevant supplier contracts/transfers, category-specific retention and
rights/hold handling. Establish bounded retry, replay, complaint, rollback,
backup and restore windows and their tested recovery effects. Obtain any
genuinely required external opinion/attestation and set `EXTERNALLY_APPROVED`
only through the existing authorized privacy process. This checklist does
**not** block local compilation, guarded SQL-as-text or synthetic tests; it
does block collection, cleanup, migration/apply and real-data activation.
The existing four downstream Risk SQL writers, live owner-session proof,
Platform Admin/cross-owner transfer and Guard remain independently gated.

### Local-only qualification receipt — 2026-10-25

- `node --experimental-strip-types --test scripts/qa/check-event-risk-retention-engineering-local.mjs`:
  **13/13 PASS**, synthetic fixtures and fake UTC time only. It also checks
  that the existing active privacy disposition still requires external
  approval and that the new module is absent from active ingest imports.
- Focused strict TypeScript and focused ESLint for
  `retention-engineering-baseline.ts`: **PASS**. The existing Risk ownership
  snapshot regression: **8/8 PASS**. Review-package containment: **PASS**.
- Full-repository `npm run typecheck`: **NOT PASS** in this worktree because
  `observer-mobile-runtime.tsx` cannot resolve five existing `@capacitor/*`
  packages and consequently reports callback implicit-any errors. No
  Capacitor dependencies were changed for this task. The existing PUSH 45
  standalone regression is **BLOCKED** by the absent
  `DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md` in this worktree; it was
  not relabeled PASS. These are distinct from the passing focused tests.
- No SQL, Auth, provider, service or runtime access; no schema/ACL/RLS write,
  deletion, clone, cleanup, push, PR, remote CI or Production change. This
  work remains a local branch handoff pending a separately authorized remote
  preservation/integration step; neither the review package nor the new
  evaluator is ready for real-data activation.

## Earlier category decision brief — retained as dated history

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

The owner-delegated engineering choice above resolves the direction for
**offline implementation only**. External Product/privacy/legal facts in this
older brief move to the pre-real-data checklist, not to a pause on code or
synthetic tests. Actual period applicability, lawful purpose, hold/appeal
exceptions and authorized disposal still require verification before use.
Schema activation and cleanup remain blocked. This does not reopen the
already-approved Model A / owner-registration direction or grant Platform
Admin/cross-owner transfer authority.

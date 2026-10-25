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

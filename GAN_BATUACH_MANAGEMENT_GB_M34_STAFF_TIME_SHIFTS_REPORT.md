# GB-M34 Staff time, shifts and payroll-ready ledger — Development report

Date: 2026-09-20. Source base: `integration/development` at `00d61a39ab3abed80df73756157ad58dee046fae`. Branch: `codex/gb-m34-staff-time`. Production is unchanged. This report describes operational time and estimated labor-cost inputs, not payroll or legal compliance.

## Before State

`staff_shifts` already held planned start/end, actual timestamps, status, GPS observations and `total_minutes`; GB-M19 made active employment authoritative and prevented cross-Garden simultaneous clock-ins with a per-profile advisory lock. Staff had attendance and shifts pages; a Manager saw today's Staff. Direct Manager table writes, missing rate history, incomplete correction/approval evidence and a frontend hours sum across 60 rows remained. No canonical operational pay-rate table or private payroll-ready export existed. Existing `overtime_minutes` is legacy operational metadata, not a verified statutory overtime determination.

## Employment Boundary

`staff_kindergarten_employments` remains the relationship authority. Clocking requires an active dated employment, active Staff profile, approved Staff row and active Garden. A candidate, former employee or another Garden fails. Garden operational timezone supplies the work date. The selected UI Garden never grants authority.

## Canonical Time Model

The existing `staff_shifts` row remains the canonical planned/actual record. It gains Classroom, stable profile, approval and rate-version references. Existing historical rows are preserved. An index enforces one open session per profile, including a multi-Garden worker. The Garden/date index supports bounded monthly reports. The migration refuses to apply if historical duplicate open sessions require review rather than silently choosing one.

## Clock In / Out

The revised `staff_attendance_transition` preserves manual and observed-location actions. A per-profile transactional lock serializes cross-Garden clocking. Server/observed timestamps and Garden-local date are authoritative. Same-Garden duplicate start and recent duplicate end return the original record without changing its timestamps. Open overnight work is found across dates. Location observations remain evidence, not certified presence.

## Multi-Garden

Each shift retains employment and Garden. A worker with A+B may see separate history, while only one active session can exist across both. Manager reads and exports are Garden-specific. Planned time-overlap checks compare absolute instants in each Garden's operational timezone, including overnight shifts.

## Shifts

The existing scheduler is a compatibility wrapper around the new scoped scheduler. A Manager/Owner can schedule an active same-Garden employee, optionally for an active same-Garden Classroom. Planned times never overwrite actual times. A different Garden, revoked employment, duplicate date or overlapping schedule is denied. One schedule event creates a safe in-app GB-M30 notification with a deterministic dedupe key.

## Classroom

Optional `classroom_id` has a foreign key and a same-Garden active-Classroom trigger check. Legacy age-group text is not authority.

## Breaks

No canonical approved break intervals exist in the current workforce model. GB-M34 does not subtract guessed breaks. Net-hour/break policy is an explicit future product decision; exported minutes are elapsed actual clock time.

## Missing Clock-Out

An open shift on the Garden's current operational day is `in_progress`. A prior-day open shift or revoked-employment session is `missing_clock_out`; its worked minutes remain unknown. Revocation marks the session for Manager review without inventing an end time. A reasoned correction is required to establish duration.

## Corrections

Managers may correct actual start/end only with a reason. `staff_time_corrections` stores previous/new timestamps, minutes, actor and time; workforce audit records the transition. Staff cannot directly edit approved historical hours. Approved entries require an explicit audited reopen before correction.

## Approval / Lock

Manager approval records actor and timestamp. The export distinguishes scheduled, in progress, missing exit, pending review and approved. Approval is idempotent; reopening retains the prior approval event in the append-only correction history. A final payroll-period lock/export confirmation beyond row approval is not claimed; external payroll remains authority.

## Pay Rates

`staff_time_rates` stores immutable employment-specific, Garden-scoped rate versions with effective date, kind (`hourly` or `monthly`), amount and creator. Only active Garden Owner/Manager membership reads or creates them; Staff, Inspector, Parent and ordinary Platform Admin do not receive wage rows. New versions cannot retroactively rewrite a closed shift's rate snapshot.

## Rate History

The applicable rate version is captured on closing a time entry from the version effective on its work date. Historical shifts without a verifiable rate remain unpriced; no guessed backfill occurs. Future rate versions are append-only and effective no earlier than the current Garden-local date.

## Operational Labor Cost

The monthly export computes `approved worked minutes × snapshotted hourly rate ÷ 60` as an estimated operational cost. Unapproved/incomplete time and monthly salary yield no computed labor cost. No tax, benefit or net-pay math is performed.

## Payroll Boundary

The product does not certify statutory overtime, pension, tax withholding, National Insurance, vacation entitlement, sick-pay entitlement, net salary or a legally compliant payslip. Existing `overtime_minutes` must not be treated as a legal payroll result. An accountant/payroll provider must apply reviewed employment terms and law.

## Export

`management_staff_time_export` returns a bounded single Garden/month projection with planned and actual times, approval, hours and applicable operational rate/cost. If a Garden/month exceeds 5,000 rows, export fails explicitly for batched review rather than silently truncating payroll input. The authenticated Garden API offers JSON and CSV with private no-store headers and spreadsheet-formula escaping. No Inspector or ordinary Admin export grant exists.

## Staff UX

The Staff shifts page now uses server-calculated `total_minutes` for completed rows, shows missing clock-out explicitly and restricts the monthly summary to the current month. It never displays another Staff member's wage.

## Manager UX

The existing Staff page links to a monthly hours view. It shows scheduled/actual time, incomplete entries, approvals, reasoned corrections, future rate versions and CSV export. This is operational input, not a payroll statement.

## Inspector / Admin Privacy

The revised Staff shift read policy allows only the Staff profile's own rows or active same-Garden Owner/Manager membership. The private rates table is narrower still. Inspector has no rate/export access; ordinary Platform Admin has no blanket wage access.

## Staffing Ratio Integration

GB-M13 policy is unchanged. Planned shifts and actual Staff presence remain distinct inputs; this push does not infer ratio compliance from schedule alone.

## Notifications

New shift assignment creates a privacy-safe in-app notification. The GB-M30 insert trigger handles preference/delivery-intent evaluation; GB-M31 remains external provider authority. No direct SMS, Resend, FCM or WhatsApp send is introduced.

## RLS / Security

Authenticated direct writes to `staff_shifts`, rates and correction history are revoked. Security-definer RPCs validate the actor, active Garden management membership, Staff employment and resource scope before mutation. Anonymous RPC execution is revoked. Rate values are not returned to Staff; export is private. All new schema is forward-only and does not modify customer hours by guesswork.

## Concurrency

The profile advisory lock and open-session unique index serialize duplicate and cross-Garden starts. Shift rows are locked for correction/approval and clock-out. A separate-connection test in disposable `gb_m34_qa` passed: A/B clock-in yielded one winner, duplicate same-Garden clock-in and clock-out yielded one row/end timestamp, and concurrent Manager correction versus Staff clock-out yielded one closed row with a single reasoned correction. The revocation trigger relies on the employment row lock and deliberately does not acquire the advisory lock in reverse order. The disposable database was restored from the synthetic isolated Development snapshot; canonical Development was not mutated for this race.

## Scale

Garden/date, employment/date, open-profile and rate-version indexes support bounded month/Staff queries. Export caps at 5,000 rows per Garden/month and avoids per-Staff round-trips. This is suitable for routine Garden volumes; unusually large network exports should be paged or batched after measured demand.

## Cost

New fixed monthly commitment: **₪0**. Monthly cost delta: **₪0 fixed**, plus bounded Postgres rows, indexes, audit rows and occasional notification intents. No new vendor is activated. Actual all-in ≤₪15 per paying user remains unverified without the restricted supplier ledger and real active-paying-user denominator; a Production release requires that owner-controlled preflight.

## Tests

Rollback-only isolated Development SQL validates Manager/Staff/Garden/Inspector/Admin RLS, active employment, duplicate clocking, cross-Garden clock prevention, private rate access, reasoned correction, approval/reopen, rate history, monthly-salary exclusion, revocation without fabricated time and scoped export. The same matrix passed against the applied schema in the disposable database. `run-management-staff-time-races.mjs` passed the four separate-connection scenarios above. Source validation passed: typecheck; 29/29 domain; 7/7 security; 20/20 Parent/Manager contract; 8/8 GB-M19; 8/8 Staff hiring; 8/8 staffing policy; migration audit 237 files with no new destructive SQL; lint regression zero new errors; release-contract preflight; and a full Next production build. The first build was blocked only by sandbox denial of Turbopack's loopback worker socket; the identical build passed with local worker permission. Exact-head CI and cumulative integrated QA remain to be recorded after PR/integration.

## Live QA

Synthetic local role QA is used. `LIVE STAFF TIME QA: BLOCKED BY ENVIRONMENT` until controlled Production-like Staff/Manager identities exercise the browser journey. No customer time record is changed.

## Legal / Payroll Review Required

Product policy must decide approved break handling, period lock, retention, corrected hours after export, and how an external accountant/payroll system accepts amendments. No legal payroll rule is inferred by this implementation.

## Carried QA Debt

GB-M21–M33 role/provider/hardware/Production-like browser and retention/recovery debt remains tracked in their reports for GB-M35/40. GB-M33 controlled live attendance/pickup QA is not closed by GB-M34. Production migration and release remain deferred.

## Inputs For GB-M35

Use employment-scoped planned and actual time, approval state, missing-exit blockers, rate-version snapshot and immutable correction events. Do not treat operational cost as salary or Digital Observer observations as Staff clock truth. `DIGITAL OBSERVER CORE DIFF: 0`.

## Development Integration Handoff

PR #81 passed all nine exact-head required checks on `0acb70a8428d82c38dd7b61805d33cb9a298dfa7` and merged by ancestry into `integration/development` at `9fe30d6a82c8111542bf16002910aa77a14bb914`. The source branch and both feature commits remain remote. Approval PR #82 remains open and **blocked**: its required Digital Observer domain gate failed twice in `horizontal-ai-scale`, reporting 122 worker completions for 120 canonical jobs. This appears to expose a queue acknowledgement race on lease expiry; it is outside the GB-M34 Management scope and must be fixed in a separately reviewed Digital Observer change, without weakening the gate. The approval branch now marks the GB-M34 migration `BLOCKED_REQUIRED_CI`, so the guarded Development runner cannot apply it. Restricted synthetic pre-migration backup: `/private/tmp/gb-m34-development-pre-migration.dump` (SHA-256 `1987abbd62191d3b2f1dabf3478034cd14a13f6032fbdcade44927e90673fa3a`), successfully restored into disposable `gb_m34_qa`; the preflight found zero duplicate open shifts. Canonical Development migration and cumulative Product QA remain pending. Production and `main` are unchanged. `DIGITAL OBSERVER CORE DIFF: 0`.

## Required CI Blocker Resolution (supersedes the preceding blocker snapshot)

Digital Observer repair PR #83 fixed the queue terminal-state race in its own branch, without changing GB-M34 Management code or migration (`GB-M34 MANAGEMENT DIFF FROM FIX: 0`). It passed 10/10 repeated unchanged horizontal-scale runs, synthetic separate-connection tests for 120/500/1,000 jobs, and all required exact-head checks. PR #83 merged into `integration/development` at `63b45d0b7edcf5bf1a5cee3cd9ad23fdfcc944bf`. The repaired baseline merged into open PR #82 at `502c1346f24dedd044a2c9d54723077deb07d860`, whose required checks then passed. This approval revision restores `VALIDATED_FOR_ISOLATED_DEVELOPMENT` for the ordered GB-M34 migration; it does not authorize Production. Final approval-commit CI and remote PR merge must complete before the guarded Development runner applies it. The canonical Development migration and cumulative Product QA remain pending at this revision.

# GB-M35 — Full role E2E QA, controlled identities and journey closure

**Status (2026-09-20): PARTIAL.** This report records completed isolated Development evidence and explicit remaining journeys. It does not claim Production, live-provider or complete full-role E2E closure. The detailed [matrix](GAN_BATUACH_MANAGEMENT_GB_M35_E2E_QA_MATRIX.md) is authoritative for journey-level status.

## Environment

The application was exercised at `http://127.0.0.1:3000` from a clean isolated worktree initially based on `integration/development` commit `48f3803ec15529dface13ac4f03b5312fe711e99`. Local Supabase Auth, REST, Storage and PostgreSQL are loopback-only in the guarded `gan-batuach-integration` stack; `productionAllowed=false`. The canonical Development database has 237 of 237 migrations accounted for: 227 in the validated baseline and ten ordered post-baseline migrations through GB-M34. No historical migration was locally edited. The baseline is a validated derived schema, not proof that every original historical migration replays from empty Production. No Production connection or customer data was used.

The existing root and durable integration checkouts contained foreign or generated changes and were not staged, reset, stashed or modified by this task. The GB-M35 worktree is `worktrees/gb-m35-role-e2e-qa`. A separate clean fix worktree/branch handled the only P1 found so far. Browser tests used installed local Chrome at 390×844 mobile and 1440×900 desktop. Synthetic credentials are stored in a mode-0600 private local runtime file outside Git; neither passwords nor tokens are printed in reports.

## QA Identities

The base 13 synthetic identities were extended idempotently to 20. New GB-M35 roles are Parent Multi, Owner A, Owner A+B, Owner-as-Teacher, Delegated Teacher, Inspector Approved Unassigned and Inspector Suspended. Existing identities cover Parent A/B, Manager A/B, Staff A/B/A+B, Candidate Staff, revoked Staff, assigned Inspector A and Platform Admin; two Observer test identities remain separate. The seed refuses a non-Development backend or mismatched existing Auth identity. All 20 users passed local Auth login and own-profile REST checks; the existing rollback-only RLS probe passed. Repeated seed execution returned the same 20 identities without duplicate records.

## QA Data

Garden A and B are active; Garden C is preliminary/pending. A1 and A2 are separate same-age Classrooms in A; B1 is in B. Child A (Garden A), B (Garden B) and C (Garden A) have active synthetic enrollments. Parent Multi has authorized Child relationships across A/B. Staff A+B has two active employments; the Candidate has none. Owner and teaching assignments are explicit, with delegated teaching scope rather than inferred Owner/HR authority. The assigned, unassigned and suspended Inspector states are distinct. At the first GB-M35 inventory, QA Gardens had **zero** inspection, canonical Task, complaint, document, tuition-period and daily attendance rows; those domain journeys were therefore not silently called tested. The domain fixture expansion and transactional browser journeys remain in progress.

## Owner Journey

Owner A, Owner A+B and Owner-as-Teacher can authenticate and reach the Garden shell. Owner A+B selected A and B through the Management API; preliminary C was denied. Manager A/B cross-Garden selection was denied. The Owner registration, email confirmation, full onboarding save/resume, Owner-only/Teacher UI authority, Staff/Child/Parent invitation and activation journey remain untested. Existing QA policy did not invent a staffing ratio.

## Parent Journey

Parent A/B/Multi reached mobile dashboard first render without page exceptions. Authenticated Parent A could read Child A tuition projection and was denied Child B; Parent B was denied Child A. Parent Multi could read its authorized Child C in A and Child B in B. This is authorization proof, not a paid/settlement or child-switch UI journey. Registration, discovery, enrollment request and activation remain open.

## Staff Journey

Staff A, Staff A+B, Delegated Teacher and Candidate reached the appropriate Staff or candidate job-market shell. Candidate Manager-Garden authority was denied. Delegated Teacher payroll export was denied. Invitation, hiring, shift, time, Task, message, Child and multi-Garden UI journeys remain open.

## Inspector Journey

A P1 was found: an approved, active Inspector assigned to Garden A was redirected to the application page. Authenticated direct RLS checks showed `current_inspector_approved()=true` and `can_inspector_access_garden(A)=true`, but the operational guard's direct `inspectors` table read returned no row under RLS. Scoped fix PR [#85](https://github.com/infoganbatuah-ai/gan-batuach/pull/85) uses the existing security-definer approval RPC and keeps the separate Garden assignment check. The local Chrome retest reached the Inspector dashboard without page errors; unassigned/suspended identities did not show Garden A content. PR #85 passed nine exact-head checks and merged to integration as `1a0162f261c6141ffb06b3ebe2abf41181a81b70`. Full application, bootstrap, inspection, evidence and suspension-after-session flows remain open.

## Admin Journey

Synthetic Admin reached the desktop Admin shell without page exception. Plan, Inspector approval, subscription, complaint/escalation, provider readiness and legacy-screen reviews remain open.

## Enrollment

Active Child enrollment/Classroom fixtures are present. The Parent request→Garden decision→reservation→manual evidence→activation browser journey, pending/waitlist and last-seat race are not yet run.

## Payments

Parent Child tuition IDOR passed. No real payment or provider charge was attempted. Manual settlement, partial payment, reconciliation, platform subscription control and disabled electronic checkout truthfulness remain open.

## Messaging

GB-M29's prior isolated RLS/private attachment proof remains valid Development evidence. GB-M35 controlled Parent↔Garden, Staff↔Parent, Manager↔Staff, broadcast and read-state browser actions have not yet been rerun on the final integrated QA head.

## Notifications

Parent A and Staff A could read their own notification list. Fan-out, read state, preferences, quiet hours and private payload assertions need actual synthetic domain events. External providers were not activated.

## Documents

Manager A's authenticated Garden B document list returned no rows. GB-M32 previously proved private Storage retrieval against synthetic users; GB-M35 still needs its own Garden/Staff/Child/Inspector upload, expiry, replacement and retention journey on the final QA head.

## Attendance / Pickup

The A1/A2/B1 and active Child/Staff fixtures are ready. Arrival, Parent observation, pickup request, authorized release, revocation, temporary permission and camera/face non-authority browser tests remain open.

## Staff Time

Delegated Teacher and Inspector payroll export requests were denied. Staff clock, Manager shift/correction/export and separate-connection races remain open for GB-M35 role sessions; prior GB-M34 isolated transaction races remain separately documented and are not misrepresented as browser closure.

## Inspections / Corrective Actions

The prior GB-M22/23 isolated schema and concurrency evidence remains. No new synthetic inspection/finding/action row existed in the GB-M35 fixture at inventory, so the full Inspector→Garden→Parent-safe journey and evidence retrieval remain open.

## Complaints / Tasks

No GB-M35 synthetic complaint or canonical Task existed at inventory. Full role routing, SLA, response, completion and separate-connection races remain open. Complaint, Task and Message remain separate domain sources.

## Mobile

Parent A/B/Multi and Staff A/A+B first-rendered at 390×844 with no page-level JavaScript exception. Navigation, forms, dialogs, tables, touch targets and RTL details are not yet signed off.

## Desktop

Manager, Owner, Inspector and Admin shells were opened at 1440×900. Loaded shell is not proof of working actions or accurate populated dashboard metrics.

## RTL

Hebrew locale was used in browser contexts. Back arrows, mixed-number dates/currency, validation and table direction remain unchecked.

## Accessibility Baseline

No keyboard, focus, dialog or contrast certification is claimed. These checks remain pending on interactive journeys.

## IDOR / Security

The authenticated API matrix passed 18/18: Parent/Child tuition authorization, multi-Garden Parent context, Garden A/B/C selection denial, Manager cross-Garden document filtering, Candidate operational denial, payroll privacy for Delegated Teacher/Inspector, and own notification reads. The Inspector guard fix preserved RLS instead of opening the private table. Full cross-domain ID substitution, forged object paths and stale-session revocation remain pending.

## Truthfulness

No payment, receipt, document verification, provider delivery, camera identification or AI danger was claimed by the QA harness. Payment/Observer/UI truthfulness inspection remains pending. Provider sandbox/live proof is separate from local Development.

## Defects Found

One confirmed **P1**: approved assigned Inspector was blocked from operational dashboard by a direct RLS-hidden table read. No P0 was found in the limited tested matrix. Untested journeys cannot be counted as absence of defects.

## Defects Fixed

The Inspector guard fix is isolated in PR #85, two scoped commits `f4cbbb1fdf7fe47f496a586b7ee3feb722158dd3` and `6b22afa28a3911ddeb703e24f3b95fd5b61d0397`; merge `1a0162f261c6141ffb06b3ebe2abf41181a81b70`. It changed only the guard and its focused tests. Local Chrome retest passed. Cumulative GB-M35 validation after this merge remains to be run.

## Remaining P2/P3

No P2/P3 visual defects are classified yet because interactive UI/RTL/accessibility sweeps have not been performed. Do not treat this as a clean UX verdict.

## Carried Provider/Production Gates

GB-M21–M34 Production/browser/provider debt is closed only where the matrix records a new actual test. Production remains at the owner-controlled release baseline; no main merge, Production migration or deployment was performed. Live payment, Resend/FCM, SMS/WhatsApp and camera hardware are not validated by this local run. SMS/WhatsApp are optional product channels. `LIVE FULL ROLE QA: PARTIAL — SYNTHETIC DEVELOPMENT JOURNEYS IN PROGRESS`.

## Cost

`NEW FIXED MONTHLY COMMITMENT: ₪0`. `MONTHLY COST DELTA: ₪0 fixed` from GB-M35 work so far, with temporary local CPU/disk use for a guarded Supabase stack, Chrome and CI. No new paid provider was enabled. Actual all-in ≤₪15 per paying user cannot be verified without the restricted supplier ledger and paying-user denominator; this is not Production release authorization.

## Recommendation For GB-M36

Do not begin GB-M36 until GB-M35's pending transactional role journeys, private evidence, concurrency, IDOR, mobile/RTL/accessibility baseline, cumulative validation and integration ledger/PR closure are complete, or their exact blockers are recorded under the repository contract. The immediate next action is to run the canonical domain APIs and browser flows against only the marked synthetic QA fixtures, then update this matrix with real results and repair any P0/P1 through separate scoped PRs.

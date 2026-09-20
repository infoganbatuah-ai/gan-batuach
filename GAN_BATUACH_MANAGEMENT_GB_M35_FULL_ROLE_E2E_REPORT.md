# GB-M35 — Full role E2E QA, controlled identities and journey closure

**Status (2026-09-20): PARTIAL.** This report records completed isolated Development evidence and explicit remaining journeys. It does not claim Production, live-provider or complete full-role E2E closure. The detailed [matrix](GAN_BATUACH_MANAGEMENT_GB_M35_E2E_QA_MATRIX.md) is authoritative for journey-level status; the redacted machine-readable [summary](development/database/gb-m35-role-qa-summary.json) records counts without credentials or signed URLs.

## Environment

The application was exercised at `http://127.0.0.1:3000` from a clean isolated worktree initially based on `integration/development` commit `48f3803ec15529dface13ac4f03b5312fe711e99`, then advanced to include Inspector repair integration merge `1a0162f261c6141ffb06b3ebe2abf41181a81b70`; final QA worktree head was `40071188778f651e97c6cc7cd06e3bc9a29515d3`. Local Supabase Auth, REST, Storage and PostgreSQL are loopback-only in the guarded `gan-batuach-integration` stack; `productionAllowed=false`. The canonical Development database has 237 of 237 migrations accounted for: 227 in the validated baseline and ten ordered post-baseline migrations through GB-M34. No historical migration was locally edited. The baseline is a validated derived schema, not proof that every original historical migration replays from empty Production. No Production connection or customer data was used.

The existing root and durable integration checkouts contained foreign or generated changes and were not staged, reset, stashed or modified by this task. The GB-M35 worktree is `worktrees/gb-m35-role-e2e-qa`. A separate clean fix worktree/branch handled the only P1 found so far. Browser tests used installed local Chrome at 390×844 mobile and 1440×900 desktop. Synthetic credentials are stored in a mode-0600 private local runtime file outside Git; neither passwords nor tokens are printed in reports.

## QA Identities

The base 13 synthetic identities were extended idempotently to 20. New GB-M35 roles are Parent Multi, Owner A, Owner A+B, Owner-as-Teacher, Delegated Teacher, Inspector Approved Unassigned and Inspector Suspended. Existing identities cover Parent A/B, Manager A/B, Staff A/B/A+B, Candidate Staff, revoked Staff, assigned Inspector A and Platform Admin; two Observer test identities remain separate. The seed refuses a non-Development backend or mismatched existing Auth identity. All 20 users passed local Auth login and own-profile REST checks; the existing rollback-only RLS probe passed. Repeated seed execution returned the same 20 identities without duplicate records.

## QA Data

Garden A and B are active; Garden C is preliminary/pending. A1 and A2 are separate same-age Classrooms in A; B1 is in B. Child A (Garden A), B (Garden B) and C (Garden A) have active synthetic enrollments. Parent Multi has authorized Child relationships across A/B. Staff A+B has two active employments; the Candidate has none. Owner and teaching assignments are explicit, with delegated teaching scope rather than inferred Owner/HR authority. The assigned, unassigned and suspended Inspector states are distinct. At the first GB-M35 inventory, QA Gardens had **zero** inspection, canonical Task, complaint, document, tuition-period and daily attendance rows; those domain journeys were therefore not silently called tested. The domain fixture expansion and transactional browser journeys remain in progress.

The identity and relationship seed is idempotent and refuses any non-isolated backend. Transactional QA scripts use only marked synthetic Garden/Child IDs. Some daily lifecycle scripts are one-time against a given operational date; to repeat their exact first-run assertions, recreate a **disposable clone** from the validated local baseline, rerun the guarded seed, and then run the scripts sequentially. There is no destructive reset command for the shared cumulative Development database, and this report does not claim automated reset/cleanup closure. The private Child-document E2E does clean its temporary object/row after testing; the message attachment and historical Task/Complaint/attendance/time records remain marked synthetic QA history. A guarded reusable clone/reset wrapper is remaining GB-M35 work.

## Owner Journey

Owner A, Owner A+B and Owner-as-Teacher can authenticate and reach the Garden shell. Owner A+B selected A and B through the Management API; preliminary C was denied. Manager A/B cross-Garden selection was denied. The Owner registration, email confirmation, full onboarding save/resume, Owner-only/Teacher UI authority, Staff/Child/Parent invitation and activation journey remain untested. Existing QA policy did not invent a staffing ratio.

## Parent Journey

Parent A/B/Multi reached mobile dashboard first render without page exceptions in the final 16/16 browser run. Authenticated Parent A could read Child A tuition projection and was denied Child B; Parent B was denied Child A. Parent Multi could read its authorized Child C in A and Child B in B. This is authorization proof, not a paid/settlement or child-switch UI journey. Registration, discovery, enrollment request and activation remain open.

## Staff Journey

Staff A, Staff A+B, Delegated Teacher and Candidate reached the appropriate Staff or candidate job-market shell. Candidate Manager-Garden authority was denied. Delegated Teacher payroll export was denied. Invitation, hiring, shift, time, Task, message, Child and multi-Garden UI journeys remain open.

## Inspector Journey

A P1 was found: an approved, active Inspector assigned to Garden A was redirected to the application page. Authenticated direct RLS checks showed `current_inspector_approved()=true` and `can_inspector_access_garden(A)=true`, but the operational guard's direct `inspectors` table read returned no row under RLS. Scoped fix PR [#85](https://github.com/infoganbatuah-ai/gan-batuach/pull/85) uses the existing security-definer approval RPC and keeps the separate Garden assignment check. The local Chrome retest reached the Inspector dashboard without page errors; unassigned/suspended identities did not show Garden A content. PR #85 passed nine exact-head checks and merged to integration as `1a0162f261c6141ffb06b3ebe2abf41181a81b70`. Full application, bootstrap, inspection, evidence and suspension-after-session flows remain open.

## Admin Journey

Synthetic Admin reached the desktop Admin shell without page exception. Plan, Inspector approval, subscription, complaint/escalation, provider readiness and legacy-screen reviews remain open.

## Enrollment

Active Child enrollment/Classroom fixtures are present. The Parent request→Garden decision→reservation→manual evidence→activation browser journey, pending/waitlist and last-seat race are not yet run.

## Payments

Parent Child tuition IDOR passed. A new synthetic role/API run generated September billing periods separately for Child A/Garden A and Child B/Garden B and verified Parent/Manager cross-Garden denials. Manager A's first manual settlement returned HTTP 409 without changing either balance. PostgreSQL reported `42804`: the GB-M27 RPC cast `current_role()` to text before writing the enum-typed `audit_logs.actor_role`. Scoped fix [#88](https://github.com/infoganbatuah-ai/gan-batuach/pull/88) replaces three RPC bodies in a new forward-only migration; rollback-only synthetic Manager tests verified the audit writes and no persistent balance mutation. PR #88 passed its exact-head required checks and merged as `740e32d631576733ac8bdf5d43fb8127e845a66b`. Ordered isolated Development approval [#89](https://github.com/infoganbatuah-ai/gan-batuach/pull/89) also passed and merged as `0a857f4d007297447f82f8ac7ab9b91b1679b5e4`. The canonical guarded runner applied the new migration locally, 238/238 schema drift passed, and the synthetic Parent/Manager E2E passed 25/25 checks: 40/100 partial settlement, 60/100 final settlement, exact two ledger entries despite concurrent same-key HTTP replay, correct Parent projection, and cross-Garden/Child denial. This is concurrent HTTP evidence; independent DB-connection contention and interactive browser journey remain unverified. No real payment or provider charge was attempted. Platform subscription control and disabled electronic checkout truthfulness remain open.

## Messaging

On the final integrated QA head, Parent A created a synthetic private thread to Manager A with Child A/Garden A context. Replaying the exact idempotency key returned the same thread and initial message. Parent A and Manager A could read it; Parent B, Manager B, Staff B, assigned Inspector and ordinary Admin could not. A synthetic PDF attachment passed actual upload, authorized signed retrieval for Parent A/Manager A, denial for unrelated Parent/Manager/Staff, revoked Staff, Inspector, ordinary Admin and anonymous access, raw private Storage denial, altered ID/path denial and 60-second signed-link expiry. The deep download route returned a Next HTML 404 under local `next dev`, including after restart, despite the route file existing. The optimized production-mode build registered it, and the same E2E passed under local `next start` against the isolated Development backend. This is a developer-mode QA limitation, not evidence of a broken built route. Staff↔Parent, Manager↔Staff, broadcast, read-state and browser interactions remain open.

## Notifications

Parent A and Staff A could read their own notification list. A new synthetic Parent message produced a Manager A notification projection without the full private message body. Fan-out counts, read state, preferences and quiet hours still need domain-specific role journeys. External providers were not activated.

## Documents

Manager A's authenticated Garden B document list returned no rows. GB-M35 reran the real GB-M32 private Child-document flow on the final isolated app: Parent A uploaded a synthetic PDF; Parent A and Manager A retrieved it through authorized short-lived signed URLs; Parent B, Manager B, Staff A, revoked Staff, Inspector and ordinary Admin were denied. The bucket was private, anonymous/raw object access failed, the signed URL expired after 60 seconds, legal hold/unknown retention blocked purge, and eligible purge and retry removed the object exactly once. The test cleaned its disposable row/object. Garden/Staff/Inspector categories, document expiry and replacement still require GB-M35 role journeys.

## Attendance / Pickup

In the isolated production-mode build, 16 synthetic API checks passed for Child A in A1: Parent A added and revoked pickup contacts; Parent B could not add a contact for A; Garden B Staff could not mark A's arrival; assigned Staff A recorded arrival once despite retry; Parent A saw attendance and could not self-release; revoked pickup and Inspector release were denied; assigned Staff A confirmed release and retry did not create a second departure; Parent B did not see A's attendance. This is an actual role/API journey. Parent pickup request UI, temporary permission, separate-connection revoke/release race and camera/face non-authority browser assertions remain open.

A separate non-mutating Management boundary probe passed 4/4 checks: a camera event without Child ID could not create arrival, a camera event could not mark departure, a mock face-result ID could not release Child, and attendance/pickup row counts remained unchanged. This is an authenticated API negative test; it does not claim real camera or face-matching hardware proof.

## Staff Time

In 15 synthetic role/API checks on the local production-mode build, Manager A scheduled Staff A for A1, Staff A clocked in and out with retries retaining one shift, Garden B Staff and Candidate could not operate A's time, Staff B could not view A's shift, Manager A's payroll-ready projection included A while Manager B's did not, and Inspector export was denied. Delegated Teacher payroll export had separately been denied in the 18-check role matrix. Correction, rate history, multi-Garden Staff browser context and separate-connection races remain open for GB-M35; prior GB-M34 isolated transaction races remain separately documented and are not misrepresented as new browser closure.

## Inspections / Corrective Actions

The prior GB-M22/23 isolated schema and concurrency evidence remains. This continuation created only synthetic Garden A inspection fixtures and passed 25/25 authenticated API checks: assigned Inspector draft/save/resume, private PDF evidence, simultaneous HTTP submissions returning one report with two answers, server score/finding, one linked corrective action, Garden acknowledgement/progress/remediation, assigned Inspector acceptance, wrong-Garden/unassigned-Inspector denial, immutable original report score and Parent-safe projections without GPS or private evidence path. A second 21/21 check retrieved inspection/remediation evidence for explicitly permitted actors through short-lived private signed URLs, denied unrelated roles/altered IDs/anonymous/raw storage, confirmed private bucket policy and link expiry after 60 seconds. These are authenticated API/Storage journeys, not interactive browser evidence or independent DB-connection concurrency proof. Corrective rejection/resubmission and conflicting decisions remain open.

## Complaints / Tasks

After the initial inventory, Manager A created one synthetic Garden A Task assigned to Staff A. Staff A saw, started and submitted it for approval; unrelated Staff B could not view or submit it. Manager A completed it, and a rerun retained the single completed Task. This proves the tested Task role transaction, not Inspector Tasks, corrective source callbacks or separate-connection completion races. A separate 26-check formal Complaint journey passed: Parent A submitted a restricted synthetic safety-category case with idempotent replay; wrong Child/Garden contexts were denied; assigned Inspector A saw and handled it while Garden Managers, unassigned/suspended Inspectors and other Parent were denied; Inspector requested information, Parent replied, Inspector resolved, Parent saw only the public resolution, and the linked Task completed only after the complaint-domain resolution. Parent B's case in Garden B without an Inspector reached the Admin queue. SLA clock advancement, private complaint attachment, browser UI and concurrent review decisions remain open. Complaint, Task and Message remain separate domain sources.

## Mobile

Parent A/B/Multi and Staff A/A+B first-rendered at 390×844 with no page-level JavaScript exception. An additional local production-mode sweep loaded Parent payments/messages/documents/pickup/complaints and Staff shifts/tasks/messages at the same viewport with no page exception, same-origin 500, horizontal overflow or unnamed button. Form entry, dialogs, touch targets and child-context switching are not yet signed off.

## Desktop

Manager, Owner, Inspector and Admin shells were opened at 1440×900. The later sweep additionally loaded Garden operations/staff-time/tasks, Inspector inspections/tasks and Admin subscriptions/complaints without page exception or same-origin 500. Loaded screens are not proof of every action or accurate populated dashboard metric.

## RTL

Hebrew locale was used in browser contexts. All 15 deep-route sweep pages had `dir=rtl` at the document root with no horizontal overflow. Back arrows, mixed-number dates/currency, validation and detailed table direction remain unchecked.

## Accessibility Baseline

The 15 deep-route sweep pages had no button missing both visible text and an accessible label/title at first render. No keyboard, focus, dialog or contrast certification is claimed. These checks remain pending on interactive journeys.

## IDOR / Security

The authenticated API matrix passed 18/18 on a sequential final-head rerun: Parent/Child tuition authorization, multi-Garden Parent context, Garden A/B/C selection denial, Manager cross-Garden document filtering, Candidate operational denial, payroll privacy for Delegated Teacher/Inspector, and own notification reads. An earlier parallel run produced transient 401s because the browser runner signed out the same synthetic account while the API and document probes were using it; sequential reruns passed. Future harness runs must serialize journeys sharing an identity. The Inspector guard fix preserved RLS instead of opening the private table. Full cross-domain ID substitution, forged object paths and stale-session revocation remain pending.

## Truthfulness

No payment, receipt, document verification, provider delivery, camera identification or AI danger was claimed by the QA harness. Payment/Observer/UI truthfulness inspection remains pending. Provider sandbox/live proof is separate from local Development.

## Defects Found

Two confirmed **P1** defects: approved assigned Inspector was blocked from operational dashboard by a direct RLS-hidden table read; and a Manager's manual tuition settlement rolled back because GB-M27 audit code wrote text into the `app_role` enum column. No P0 was found in the limited tested matrix. Untested journeys cannot be counted as absence of defects.

## Defects Fixed

The Inspector guard fix is isolated in PR #85, two scoped commits `f4cbbb1fdf7fe47f496a586b7ee3feb722158dd3` and `6b22afa28a3911ddeb703e24f3b95fd5b61d0397`; merge `1a0162f261c6141ffb06b3ebe2abf41181a81b70`. It changed only the guard and its focused tests. Its nine exact-head checks passed. The final GB-M35 Chrome retest passed 16/16 role first-render probes. The tuition fix is isolated in PR #88, final head `208f544b618762800b15d54c9361f8ba8c5185f5`, merge `740e32d631576733ac8bdf5d43fb8127e845a66b`; exact-head CI and rollback-only synthetic role tests passed. Its ordered Development migration was applied after PR #89 merged; 238/238 drift and 25/25 synthetic role/API retest passed. The tested tuition P1 is closed. Cumulative GB-M35 validation after all fixes remains to be run.

## Remaining P2/P3

One **P2 developer-mode QA limitation** was observed: Next dev did not register the deeply nested private message attachment download route. The route is in the optimized build and passed isolated production-mode E2E. No P2/P3 visual defects are classified yet because interactive UI/RTL/accessibility sweeps have not been performed. Do not treat this as a clean UX verdict.

## Carried Provider/Production Gates

GB-M21–M34 Production/browser/provider debt is closed only where the matrix records a new actual test. Production remains at the owner-controlled release baseline; no main merge, Production migration or deployment was performed. Live payment, Resend/FCM, SMS/WhatsApp and camera hardware are not validated by this local run. SMS/WhatsApp are optional product channels. `LIVE FULL ROLE QA: PARTIAL — SYNTHETIC DEVELOPMENT JOURNEYS IN PROGRESS`.

### Closed with new GB-M35 evidence

- GB-M23/24/25/29/30: representative Task assignment and completion, formal Complaint routing/response/resolution, private Parent↔Garden Message idempotency, and body-safe notification projection passed against actual synthetic role sessions. The prior isolated M29 RLS and concurrency evidence remains separate.
- GB-M29/M32: private message attachment and Child document upload/retrieval passed authorized and unauthorized role matrices with private Storage and expiring signed links. The Child document lifecycle additionally passed retention hold and idempotent purge.
- GB-M33: synthetic arrival, Parent observation, pickup permission/revocation and Staff release passed role/API E2E with retry safety.
- GB-M34: synthetic shift scheduling, Staff clock in/out, own history and Garden-scoped export passed role/API E2E with retry safety.
- GB-M21/20 Inspector access: assigned approved Inspector entered the dashboard after a reviewed P1 fix; unassigned/suspended roles did not inherit Garden A access.

### Still blocked or untested in GB-M35

- GB-M21 preliminary Garden→Owner invitation/onboarding activation browser journey; GB-M22 full inspection/evidence/concurrent submit; GB-M23 corrective-action evidence/review/concurrent decision; GB-M24 separate-connection Task completion; GB-M25 complaint attachment/SLA time advancement/concurrent review.
- GB-M26 Admin platform-subscription activation, GB-M27 independent DB-connection settlement race and interactive browser journey, GB-M28 sandbox/live provider proof. The GB-M27 synthetic role/API manual and partial settlement now passes. No real charge is authorized for QA.
- GB-M29 Staff↔Parent/broadcast/read-state browser interactions; GB-M30 preferences/quiet hours and large fan-out; GB-M31 controlled Resend/FCM sandbox receipts (provider configuration unavailable). SMS/WhatsApp are optional and not blockers for normal accounts.
- GB-M32 Garden/Staff/Inspector document category replacement/expiry; GB-M33 temporary pickup and separate-connection revoke/release race; GB-M34 correction/rate/multi-Garden clock race. Their earlier isolated domain evidence is retained, but it is not a new full-browser result.
- Mobile form interaction, RTL details, accessibility and stale-session revocation require further controlled browser runs. Production role QA remains deferred by owner release policy, not silently passed.

## Validation

On the GB-M35 worktree after the Inspector integration merge: 20/20 Manager/Parent contract checks, 234/234 Management source tests, 30/30 domain CI suites, 7/7 security CI suites, 237-migration health and isolated Development baseline drift (`missing=[]`, `errors=[]`) passed. The optimized local build and its TypeScript stage passed; lint regression reported zero new errors/warnings against the repository's existing baseline; the release-contract test passed without Production mutation. Final feature-branch PR checks and integration are still pending. Tests added for GB-M35 role transactions passed as described in the matrix. These checks do not replace the outstanding interactive E2E journeys.

## Cost

`NEW FIXED MONTHLY COMMITMENT: ₪0`. `MONTHLY COST DELTA: ₪0 fixed` from GB-M35 work so far, with temporary local CPU/disk use for a guarded Supabase stack, Chrome and CI. No new paid provider was enabled. Actual all-in ≤₪15 per paying user cannot be verified without the restricted supplier ledger and paying-user denominator; this is not Production release authorization.

## Recommendation For GB-M36

Do not begin GB-M36 until GB-M35's pending transactional role journeys, private evidence, concurrency, IDOR, mobile/RTL/accessibility baseline, cumulative validation and integration ledger/PR closure are complete, or their exact blockers are recorded under the repository contract. The immediate next action is to run the canonical domain APIs and browser flows against only the marked synthetic QA fixtures, then update this matrix with real results and repair any P0/P1 through separate scoped PRs.

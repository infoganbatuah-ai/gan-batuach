# GAN BATUACH MANAGEMENT — GB-M37 DASHBOARDS REPORT

## Before State

Role-specific shells existed, but dashboard truth was fragmented. The Garden home counted legacy Child payment flags and obsolete Staff clock fields; Parent cards could mix Children and Gardens; Staff home queried all Garden Children plus medical fields and message bodies; Admin home treated unverified AI rows as operational alerts. Several top-level navigation items duplicated the same destination while a disconnected generic command-center read model still used legacy semantics.

## Dashboard Inventory

The full classification is recorded in `GAN_BATUACH_MANAGEMENT_DASHBOARD_NAVIGATION_INVENTORY.md`. Canonical entry points are Garden `/operations`, Parent `/parent`, Staff `/staff`, Inspector `/inspector` and Admin `/admin`. Historical routes remain available for GB-M38 retirement review.

## Canonical Role Dashboards

Dashboard cards remain read models. They read canonical domain rows and never create editable parallel truth. Shared pure projections compute attendance, tuition and capability state. Failed sources are reported as unavailable instead of silently becoming zero.

## Owner

The Owner/Manager home now separates expected/present/absent/departed attendance, actual Staff presence, Parent tuition receivables, Garden platform subscription, Tasks, complaints, documents, inspections and corrective actions. Staff presence uses GB-M34 `actual_start`/`actual_end`. Active Children come from canonical enrollments.

All quick actions route to existing authorized flows. The Observer shortcut is labelled as readiness rather than an included/live monitoring claim.

## Owner-as-Teacher

Owner-as-Teacher uses the same active Garden context and Owner command center. Teaching routes remain available through authorized domain actions; no second dashboard or permission union was introduced.

## Teacher

Delegated Teachers continue through the Staff operational surface. Their Classroom-scoped Children, attendance, Tasks, shifts and messages are available without subscription, Owner finance, wage or membership administration cards.

## Parent

The Parent home is Child-centric. A server-validated Child selector accepts only Guardian-linked Children. Attendance, tuition, documents, Garden schedule and enrollment requests all use the selected Child/Garden context. A Child without active enrollment receives discovery and pending-request actions rather than broken or fabricated operational cards.

## Staff

The active Staff home consumes the selected active employment, GB-M34 shift state, own Tasks, notifications and messages. Child access is derived from active Staff/Classroom plus current Child/Classroom assignments. Dashboard projections exclude Child medical fields and private message bodies. Candidate experience remains separate. A Staff member with multiple active employments and no saved context now receives an explicit Garden chooser instead of being misclassified as a candidate; the chosen Garden is still re-authorized by the existing server endpoint.

## Inspector

The Inspector dashboard scopes its portfolio to assigned Gardens. Approved unassigned Inspectors now remain on the private Inspector command center with the explicit `טרם הוקצו לך גנים` empty state and no Garden data. Suspended/inactive Inspectors still fail the approval guard and return to the application/status surface. Complaint display remains status-oriented.

## Admin

The Admin command center remains aggregate-only for Gardens, users, inspectors, subscriptions, complaints, provider readiness and system state. It does not preload private Child or message content. Unverified AI rows were removed from operational incident counts and recent-event panels. The large historical Admin route set is documented for GB-M38 rather than deleted.

## Navigation

`RoleAppShell` now exposes five task-oriented top-level destinations per role. Mobile retains a bounded BottomNav and desktop uses the same clear active destinations. Secondary and legacy modules remain reachable through the role's More/settings/command center during GB-M38 transition.

## Context Switching

Owner/Manager Garden context uses the canonical active-Garden cookie resolved against current memberships. Staff Garden context uses current employments. Parent Child context is a validated query parameter resolved only from the Guardian's family collection. A context value never grants authorization.

## Badges

Unread notification/message counts are server-derived. No localStorage counter is used by a canonical role home. Completion/read mutations continue through the domain APIs. The notification list and mark-read endpoints now return an explicit 401 for an unauthenticated request instead of converting a Next.js redirect exception into a 500.

## Quick Actions

Owner actions link to Children, attendance, incidents, messages, daily updates, Staff, finance, enrollment and reports. Parent and Staff actions link to their existing canonical flows. Hidden links do not replace server authorization.

## Loading / Error / Empty

Server-rendered dashboards finish as data, empty or unavailable. The Garden command center isolates source failures and continues rendering unaffected sections while showing an error banner. Empty Parent/Staff/Inspector states provide real next actions.

## Safety Boundary

Camera rows alone produce setup/readiness. Only an explicitly verified operational camera state can be described as operational. Mock/shadow AI rows are not counted as incidents. No Child identity, attendance or release is inferred from camera data.

## Privacy

Dashboard queries request bounded explicit fields. Staff home does not preload Child medical data or message bodies. Parent data is Child-scoped. Admin does not receive routine private content. Tuition and platform subscription remain separate.

## Performance

Queries are bounded and independent sources load concurrently. Large collections are capped. Classroom assignment resolution prevents all-Garden Child fan-out for Staff. The implementation introduces no polling, realtime subscription, materialized shadow truth or new cache.

The isolated Development browser run covered eight populated role/context dashboards with synthetic data. Measured browser `networkidle` load was p50 1,116 ms and p95/max 2,747 ms. This is a Development baseline, not a Production SLA. The first environment attempt exposed two Supabase stacks auto-starting in the same 4 GiB VM; the inactive GB-M35 Auth stack was stopped without deleting its volumes, after which repeated Auth health returned 200 in 2–16 ms and the role suite completed without resets.

## Responsive

Existing `AppShell`, `SidebarNav`, `BottomNav`, `DashboardGrid`, `MetricCard`, `ActionCard` and role app frames are reused. No new design system was introduced.

## RTL

Existing Hebrew direction, date, time and currency formatting remains. Child/context controls have explicit labels and native RTL behavior.

## Accessibility

The Child selector has an explicit accessible label. Dashboard sections retain semantic headings and labelled regions. Broader P2/P3 accessibility debt remains assigned to final UX closure.

## Legacy Candidates

The inventory lists redirect, internal-only, Production-block and retirement candidates. No route was blindly deleted. The disconnected generic `DashboardCommandCenter` and `interaction-summary` endpoint are removal candidates because their legacy calculations are not used by the canonical role homes.

## Tests

- Pure attendance, tuition, Child-selection, safe-message and camera-capability projections.
- Static source contract for canonical financial separation, GB-M34 timestamps, Parent Child scoping, Staff Classroom scoping, privacy minimization, Admin shadow exclusion, multi-Garden Staff context and approved-unassigned Inspector handling.
- Synthetic browser smoke: 16/16 role/viewport dashboards, including Owner-as-Teacher, delegated Teacher, Parent-Multi, Staff A+B, assigned/unassigned/suspended Inspector and Admin.
- Interactive role/context/performance suite: 8/8; Parent Child switch, two authorized Staff Garden switches, unassigned Inspector privacy and page-error checks.
- Development schema drift recovery: 243/243 sources accounted for; a disposable canonical rebuild left no unmatched Product statements, 150 CHECK expressions were planner-equivalent, volatile Supabase Realtime daily partitions were excluded from Product fingerprinting, and the normalized drift gate passed.
- GB-M37 focused suite: 9/9 PASS.
- Full Management regression: 264/264 PASS.
- Parent/Manager contract: 22/22 PASS.
- Domain gate: 30/30 PASS; security/isolation gate: 7/7 PASS.
- GB-M36 reporting regression: 7/7 PASS.
- Migration health and canonical Development drift: 243/243 PASS.
- Typecheck, Production build (529 routes), lint baseline with zero regressions and release-contract preflight: PASS.
- Built-server smoke: `/api/health` HTTP 200 with Supabase `ok`; notification list/mark-read, Tasks, tuition, Staff time and reports reject unauthenticated access with HTTP 401.

## Cost

`MONTHLY COST DELTA: ₪0 fixed commitment.` No vendor, queue, analytics service or persistent report store was added. Bounded canonical reads add ordinary Development/Production database work within existing Supabase/Vercel capacity. Actual usage remains subject to the repository's all-in ₪15 per active paying user control.

## Remaining P2/P3

- Final visual hierarchy, spacing and animation remain outside GB-M37.
- Historical Admin route retirement and redirects remain GB-M38.
- Broader untouched-screen accessibility labels remain in the UX closure backlog.
- Production/live role performance remains unverified until an owner-authorized release.

## Inputs For GB-M38

Use the inventory to retire or redirect duplicates only after reference/link analytics and route-contract review. Preserve canonical role entry points, keep server authorization independent of navigation and remove the unused legacy command-center read model only after confirming no external client depends on it.

## Development Integration Closure

PR #119 passed all 9 required checks at exact head `5de0869fc598b1e0848fa4f4fb10cc43af5ecdce` and merged by ancestry to `integration/development` as `e96b1e722a2a39ee18aeedc48d46f94f101f7294`. Cumulative validation on that exact merge passed Management 264/264, Parent/Manager 22/22, domain 30/30, security 7/7, reporting 7/7, migration health and Development drift 243/243, role/context E2E 8/8, typecheck, lint, build and release preflight. The final warm E2E run measured p50 1,247 ms and p95 2,002 ms in isolated Development. Built-server health returned HTTP 200 with Supabase `ok`, and protected dashboard APIs rejected unauthenticated requests with HTTP 401.

GB-M37 adds no migration, so Development application is `NOT REQUIRED`; the canonical Development ledger remains 243/243 with no drift. Production and `main` remain unchanged.

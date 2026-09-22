# Gan Batuach Management GB-M38 Legacy Consolidation Report

Date: 2026-09-23
Baseline: `integration/development` at `f35b53577d9263300899602074dfe399f5267c3b`
Branch: `codex/gb-m38-legacy-consolidation`
Production: unchanged

# Before State

The repository had 251 role-dashboard pages: 141 Admin, 50 Garden, 22 Parent, 18 Staff and 20 Inspector. Canonical navigation from GB-M37 was already substantially smaller, but compatibility, readiness, QA and historical surfaces remained physically present. There were 235 non-Digital-Observer/non-video-gateway API route files. The disconnected `DashboardCommandCenter` still fetched a legacy summary endpoint even though no page imported the component.

# Evidence Sources

The audit consumed the GB-M01 feature/UX inventories, GB-M32 document inventory, GB-M35 E2E report and mock audit, GB-M36 reporting inventory, GB-M37 dashboard/navigation inventory, current source references, route manifests, tests and Git history. Static zero-reference evidence was used only together with runtime contract/test evidence.

# Route Inventory

The 251 role-dashboard pages classify as 166 canonical or currently required, 3 fixed compatibility redirects added here, 57 internal/QA/readiness surfaces, and 25 retained/deferred legacy or compatibility surfaces. No ambiguous item was deleted. Across all non-Digital-Observer pages, 296 page routes remain after consolidation.

# API Inventory

There are 235 Management/non-Observer API routes under the documented counting rule: 211 canonical, 8 deprecated/compatibility and 16 internal/QA. `/api/dashboard/interaction-summary` has no user-facing caller but remains guarded and `INTERNAL_ONLY` because required Digital Observer portable-deployment CI reads the tracked runtime set and the Management operational-role regression inventories it. This dependency was discovered by the full gate and prevented an unsafe deletion.

# Admin Consolidation

Admin has 141 physical page surfaces. Canonical navigation has 12 primary destinations; 50 launch/pilot/ISO/mobile/scale/QA/readiness surfaces are internal or QA, and 79 specialized/legacy surfaces remain outside canonical navigation pending deterministic action migration. This is a navigation consolidation rather than a risky mass deletion.

# Owner

The Owner/Manager canonical home remains `/dashboard/garden/operations`. `/dashboard/garden/inspection-status` now safely redirects to the canonical inspections workspace. The communication operations page remains because it manages provider logs/settings distinct from private threads.

# Parent

`/dashboard/parent/trust` now redirects to `/dashboard/parent/trust-center`. `/family-home` remains because it is the active family-day/timeline surface and is used by auth/navigation. Parent routes continue to use Guardian/Child scope rather than a profile Garden default as authority.

# Staff

`/operations` and `/daily-journal` remain. The former is the active-employment command center; the latter is an operational checklist and is not the same as the Child journal. Employment context remains the authorization boundary.

# Inspector

Command-center/control-center and ratings remain because they provide distinct field-work and assigned-Garden priority workflows. Approval plus current assignment remains mandatory.

# Admin

`/kindergartens` is the canonical list and `/gardens/[id]` remains the detail contract. The `/gardens` list alias is retained as documented compatibility until all unique actions and links are migrated.

# Identity Legacy

`profiles.garden_id` remains a context/default compatibility field, never sole authority. Parent/Staff/Inspector access uses Guardian relationships, active employments and current approved assignments. `generated_credentials` is historical-only: active provisioning uses signed Email invitation, makes no plaintext credential write and returns only Email/username metadata.

# Classroom / Capacity / Ratio

Canonical Classroom identity and GB-M12 capacity remain operational authority. Age/group and Garden capacity fields remain historical/display compatibility. GB-M13 versioned staffing policy remains authority; absent policy is reported as not configured.

# Enrollment

GB-M15/16 remains authoritative. Direct legacy status mutations were not removed without caller-level evidence and remain documented for later deprecation. Enrollment activation, payment and audit-role regression suites remain required.

# Payments

Tuition, platform subscription and provider verification remain separate. Compatibility payment/invoice webhooks use one signed, provider-bound, replay-safe handler that explicitly applies no financial side effect. Historical price snapshots are preserved.

# Messaging / Notifications

GB-M29 threads and GB-M30/31 notification intents/adapters remain canonical. Old message endpoints remain compatibility until all callers are migrated. Complaint and Task records were not collapsed into messages.

# Documents

GB-M32 remains canonical for persistent documents; Attachment and Evidence keep separate lifecycle semantics. No table, bucket or object was dropped. Private signed access remains required.

# Attendance / Pickup

`/pickup-face` now redirects to canonical pickup. Face matching, camera detection and Track IDs cannot establish attendance, identity or release authority. GB-M33 pickup authorization plus Staff confirmation remains authoritative.

# Staff Time

GB-M34 remains canonical. Historical time fields/tables remain for history. Active employment and transactional clock rules remain required.

# Reports

GB-M36 report catalog remains canonical. Specialized Admin analytics/readiness pages remain internal or deferred where they have unique actions; no report truth was deleted.

# Dashboards

GB-M37 role dashboards remain canonical. The unused `DashboardCommandCenter` component was removed after zero-caller proof; its guarded endpoint remains internal for required CI compatibility. Three bookmarkable routes became fixed server redirects.

# Components / Shells

One dead component was removed. No shared shell was rewritten, and no Digital Observer component or dependency changed. Broader shell consolidation remains deferred because several apparently duplicate pages have distinct operational semantics.

# Redirects

The new redirects use Next.js `permanentRedirect` from Server Components. Each has a fixed destination and forwards no Garden, Child, Staff, face-result or resource ID. Authorization is repeated at the destination. Existing `/dashboard/garden` compatibility behavior remains.

# Legacy Tables

No table is dropped and no historical migration is edited. Legacy tables are retained as historical or compatibility data where deterministic backfill, retention or caller proof is missing. New operational authority remains with canonical domain models.

# Security

Focused tests cover redirect parameter non-forwarding, canonical navigation, relationship authority, pickup/attendance authorization, credential retirement and payment webhook safety. The full security, tenant, role, IDOR and cumulative suites remain required before integration closure.

# Hard-Coded Policy Sweep

The active policy review covers Classroom capacity, staffing ratios, tuition/subscription separation, Email-first verification, Garden approval and provider availability. No product/legal truth was replaced with a new hard-coded value. Compatibility occurrences are classified rather than blindly removed.

# Mock / Truthfulness Sweep

Pickup face review was removed from the user product route and replaced by canonical pickup navigation. Internal demo/readiness routes stay outside canonical navigation. Payment/manual/provider, upload/verification, readiness/Production, detection/incident, scheduled/present and enrollment/attendance distinctions remain mandatory regression gates.

# Performance

The change removes one client fetch layer and one summary endpoint. It introduces no new query, polling, cache or read model. Dashboard performance must be compared after integration against the GB-M37 warm Development reference (p50 about 1,247 ms, p95 about 2,002 ms); environment differences will be recorded. No Production SLA claim is made.

# Counts Before / After

## Management role pages

- Before physical role pages: 251
- Canonical/current: 166
- Redirects: 3
- Internal/QA/readiness: 57
- Legacy/compatibility retained: 25
- Physical page routes removed: 0 (bookmark compatibility retained)

## Management APIs

- Before: 235
- Canonical: 211
- Deprecated/compatibility: 8
- Internal: 16
- Removed: 0
- After: 235

## Admin

- Physical surfaces before/after: 141 / 141
- Canonical navigation destinations: 12
- Internal/QA/readiness: 50
- Specialized/legacy outside canonical navigation: 79

# Cost

No paid infrastructure or vendor is added. `MONTHLY COST DELTA: ₪0 fixed commitment`. Removing an unused request may reduce work marginally, but no monetary saving is claimed without billing evidence.

# Remaining Legacy

Deferred items require caller migration, deterministic data mapping, provider/release evidence migration or retention confirmation. They are explicitly classified in the retirement matrix. Remaining visual/copy and broad accessibility polish are P2/P3 inputs for the later UX phase.

# Inputs For GB-M39

The canonical route map and canonical UX surface map define the surviving screens and required states. GB-M39 should design only those surfaces, exclude redirects/internal QA/legacy compatibility, standardize Hebrew terminology and preserve all truth/privacy distinctions.

# Validation

Focused static contract: 8/8 PASS. Full branch CI and cumulative Development verification will be recorded after the exact branch head and integration merge are validated.

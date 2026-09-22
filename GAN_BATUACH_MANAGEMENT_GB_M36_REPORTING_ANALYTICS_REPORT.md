# Gan Batuach Management — GB-M36 Reporting & Analytics Report

## Before State

Management had real domain screens and several historical analytics/readiness pages, but no common role-aware report contract. Date semantics, export boundaries, privacy projection, and spreadsheet safety varied. Parent and Staff had no canonical report center. Some Admin links described readiness or legacy analytics rather than trustworthy operational totals.

## Reporting Inventory

The detailed route, role, source, privacy, and reuse classification is in `GAN_BATUACH_MANAGEMENT_REPORTING_INVENTORY.md`. Working inspection, Staff-time, tuition, subscription, staffing-readiness, document, and operational pages remain their domain drill-downs. Legacy Admin analytics remain compatible and are explicitly non-canonical pending GB-M38.

## Canonical Reporting Model

`/api/reports` is a read-only, server-authorized reporting contract. It queries canonical GB-M01–GB-M35 source records and does not create editable shadow truth. Each response declares authorized scope, canonical date range/timezone, bounded pagination, generation timestamp, and `live: false` query-time freshness. Source corrections appear on the next request; the route forces dynamic, no-store reads.

Standard ranges are today, trailing seven-day week, current month, and custom. A range is capped at 366 days. Garden reports use the Garden operational timezone; platform aggregation uses the explicit platform timezone. Browser timezone is never authoritative.

## Garden / Network Reporting

Owner/Manager reports cover current dashboard state, Child attendance, pickup releases, Staff hours, tuition, platform subscription, inspections, corrective actions, complaints, Tasks, documents, enrollment funnel, and operational Classroom capacity. A user managing multiple Gardens may request an authorized network summary; the Garden set is resolved server-side. A client-provided Garden outside that set is rejected.

Children and Staff rosters remain on their existing canonical pages. Staffing policy remains on the existing staffing-readiness endpoint so `policy_not_configured`, version, and source semantics are preserved instead of being reimplemented.

## Attendance / Pickup

Attendance derives from GB-M33 daily records, including canonical Garden date, arrival/check-in, departure/check-out, status, Classroom, and recording actor references. Parent scope is limited to authorized Children. Pickup export includes the authorization reference/type, release time, state, and confirming actor, without broad contact details.

## Staff Hours / Labor Cost

Manager Staff-hours reporting reuses `management_staff_time_export`; Staff reads use own time records. Schedule and actual time remain separate. Corrections, approval state, missing clock-out, rate kind, currency, and authorized estimated operational labor cost retain GB-M34 semantics. Monthly salary is not converted to fake hourly cost. No payroll, tax, overtime, pension, National Insurance, leave-entitlement, net-salary, or payslip claim is made.

## Tuition / Subscription / Payment Truth

GB-M27 tuition remains Child/enrollment/Garden scoped. Amount due and outstanding are calculated in integer minor units from base, adjustment, and settled snapshots to avoid floating-point accumulation. Partial settlement, reconciliation, and unapplied credit remain visible. GB-M26 platform subscription is a separate report. Manual activation/settlement, ledger settlement, provider state, and unavailable providers are not relabeled as verified card payment.

## Inspections / Corrective Actions / Complaints / Tasks

Inspection history uses GB-M22 submitted state and historical score. Corrective actions use GB-M23 and never rewrite inspection scores. Complaints expose state, category, severity, age/SLA projection, and resolution timing without internal notes, descriptions, private evidence, or attachments. Tasks preserve source-domain references and remain GB-M24 records.

## Documents / Enrollment / Capacity

Document reporting exposes only action/status/expiry metadata allowed by GB-M32; raw bucket paths are excluded. Enrollment reporting derives from GB-M15/16 states and does not treat report output as enrollment authority. Capacity reconciles configured operational capacity, current assignment occupancy, active reservation count, availability, and explicit over-capacity state. It is labeled operational capacity rather than legal compliance.

## Parent / Staff / Inspector / Admin

- Parent reports contain authorized Children only: attendance, tuition, permitted document action state, and a safe family summary.
- Staff reports contain own employment context, own hours, own shifts/tasks, and no peer wage data.
- Inspector reports contain assigned Gardens only. Suspended/unassigned operational access is denied by the existing role context and RLS.
- Admin reporting is aggregate-only for Gardens, roles, subscription state, and provider readiness. It does not enumerate private messages, Child content, ordinary documents, pickup data, or Staff wages.

## Authorization / RLS / Service Role

Every request authenticates and re-evaluates verified-account and current role context. Garden, Child, employment, and Inspector assignment scope is derived server-side. The endpoint uses the authenticated Supabase session and existing RLS; it does not import an Admin client or expose Service Role to the browser. A direct authenticated rollback-only RLS matrix separately proved cross-Garden, cross-Child, peer-wage, Inspector, and Admin document denials.

## Export Security

Eligible reports support bounded CSV with a 2,000-row cap; interactive pages cap at 200 rows. CSV is UTF-8 with BOM for Hebrew. Values beginning with `=`, `+`, `-`, or `@` (including leading whitespace) receive an apostrophe prefix to prevent spreadsheet formula execution. Filenames contain only report type and date range. Export audit stores metadata, never contents. Audit failure stops the download. No generated file is persisted or made public.

## Privacy / Caching / Freshness

All responses use `Cache-Control: private, no-store`. The report route uses forced dynamic/no-store data fetching, avoiding stale shared results and tenant cache leakage. Queries select explicit required fields rather than `select *`. Error states return a safe failure; empty results remain explicit empty data, not evidence that a domain is configured or verified.

## Performance / Scale

Queries are server-filtered, tenant-scoped, date-bounded, ordered, and paginated. The synthetic scale test inserts 500 clearly tagged Tasks, verifies the 200-row page cap and third-page retrieval through authenticated HTTP, then deletes every fixture in `finally`. The report endpoint avoids a per-recipient/per-row query loop. Existing domain indexes are reused; no speculative index or materialized shadow table was added.

Representative local Production-style authenticated QA covered 27 role/API cases. The initial small-fixture sample recorded p50 563 ms, p95 1,717 ms, maximum 2,429 ms across 27 calls on local Development hardware; this is a Development baseline, not a Production SLA. The 500-row scale receipt records exact page latencies after the final no-cache build.

For 100–100,000 users, pagination, bounded exports, explicit tenant filters, and canonical indexes remain the primary controls. Platform-wide unbounded export is intentionally absent. At higher measured load, asynchronous private exports or justified summaries may be introduced, but no new infrastructure is required now.

## Reconciliation Tests

Focused tests cover canonical timezone/range resolution, pagination/export bounds, minor-unit money aggregation, role catalogs, Hebrew CSV, formula injection, and no-store freshness. Authenticated role E2E covers manager A/B denial, Owner A+B network scope, Parent own/cross-Child, Staff own/payroll denial, assigned/cross-Garden Inspector, aggregate-only Admin, every manager report source, and CSV headers/BOM. Source-domain totals are returned directly from canonical attendance, tuition, Staff-time, capacity, inspection, corrective-action, document, enrollment, task, complaint, and subscription records.

## Digital Observer Safety Boundary

No Digital Observer core file is changed. Management reporting does not convert mock/shadow events into incidents, identify a Child from a camera track, or fabricate monitoring uptime. Existing readiness status remains the only Management-facing Safety capability when Production verification is absent.

`DIGITAL OBSERVER CORE DIFF: 0`

## Cost

No paid analytics, queue, storage, or rendering provider was added. CSV is streamed in the application response and is not retained.

`NEW FIXED MONTHLY COMMITMENT: ₪0`

`MONTHLY COST DELTA: ₪0 fixed; bounded variable Supabase query/egress and Vercel compute only within existing plans.`

The all-in `<= ₪15 / active paying user / month` target is not claimed as proven without the current restricted supplier ledger and invoice evidence. GB-M36 adds no new fixed supplier cost.

## Tests

- Focused reporting contract and security tests.
- Authenticated role/report E2E: 27/27.
- Direct RLS matrix on isolated synthetic Development.
- 500-row bounded pagination/cleanup scale test.
- Typecheck, changed-file lint, Production build.
- Cumulative Management, Parent/Manager, Staff, Inspector, domain, security, tenant, migration, lint/static, dependency/secret, and release-preflight gates before integration closure.

## Live QA

QA uses the isolated GB-M35 synthetic Auth/DB/Storage environment and a Production-style local build. No customer data and no live provider were used. Production role QA remains intentionally deferred with the consolidated owner-authorized release.

## P2/P3 From GB-M35

No broad visual redesign was attempted. Report surfaces retain the existing cards and responsive shell; the canonical workbench supplies truthful links and accessible headings. Broader visual/accessibility polish remains for final UX closure.

## Migration

GB-M36 requires no database migration. It reuses canonical tables, RLS, RPCs, and indexes. Development migration count remains unchanged; Production remains unchanged.

## Carried QA Debt

- Production deployment, Production database verification, and Production role smoke remain deferred to an explicit owner release.
- Live payment, SMS, WhatsApp, and unverified external provider capability remain outside reporting and are shown only through truthful readiness state.
- Broader legacy Admin analytics retirement remains GB-M38.

## Remaining Debt

Measure report query plans and real usage after an authorized release before adding indexes or summary tables. If Garden datasets approach the current export cap, define an asynchronous private-export policy with bounded retention. Final responsive/table visual polish remains outside GB-M36.

## Inputs For GB-M37

Use `/api/reports` as the canonical role-aware read contract; preserve its source-domain, no-store, tenant-scope, pagination, CSV-safety, and audit boundaries. Do not replace it with client-side full-table aggregation or a global Admin cache.

## Integration Closure

PR #117 targeted `integration/development`, preserved source commit `a9145914ee39f950bda1591fcad6c421e3c02917`, and completed all 9 required checks successfully at exact head `aafff972df64c1617cc75aab4907b7ba7b4d46d3`. It merged through the canonical ancestry-preserving workflow at `48d2bbc489d53eb096b03bfe3f6b91ad904ae050`.

The merge commit tree is `bd9a3bf20807073574d4dc687e8795f17321a7e0`, byte-identical to the validated PR-head tree. The source and preservation commits are ancestors of the remote integration head. No conflicting integration change entered the merged tree.

## Cumulative Development Validation

The exact merged Product tree passed:

- Management `255/255`.
- Parent/Manager contract `22/22`.
- Domain regression `30/30`.
- Security/isolation `7/7`.
- Migration health `243/243` with no GB-M36 schema migration.
- Focused reporting `7/7`.
- Authenticated role/report E2E `27/27`.
- Direct rollback-only RLS matrix.
- 500-row bounded pagination and cleanup scale test.
- Typecheck, changed-file lint, full lint regression, Production build, tracked-source secret checks, dependency/security checks, and release-contract preflight.

No Production database, deployment, customer record, provider, or `main` branch was changed. Production verification remains deferred to a separate explicit owner-authorized consolidated release.

## Final Development Status

`GB-M36 DEVELOPMENT INTEGRATION: PASS`

`PRODUCTION STATUS: DEFERRED / UNCHANGED`

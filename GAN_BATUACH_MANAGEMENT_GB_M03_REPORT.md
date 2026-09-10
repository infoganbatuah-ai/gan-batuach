# GB-M03 — Candidate activation guards and role semantics

## Status

Implementation complete on the branch derived from GB-M02. Model recommendation: Astra because candidate activation controls access to child, medical, inspection and cross-garden operational data.

## Result

The stored `staff` or `inspector` role is no longer sufficient for Management operational access.

Staff access now requires all of the following:

- authenticated user and matching profile identity;
- `profiles.active = true`;
- selected `profiles.garden_id`;
- matching `staff` row for the same profile and garden;
- `staff.approved_to_work = true`;
- `staff.onboarding_status = active`;
- matching `staff_kindergarten_employments` row for profile, staff record and garden with `status = active`.

Inspector access now requires all of the following:

- authenticated user and matching active inspector profile;
- approved `inspector_applications` row with an activation timestamp;
- matching canonical `inspectors` identity row;
- at least one garden assigned through `gardens.inspector_id`.

Missing lifecycle state returns 403. Missing identity returns 401. Authority lookup failures return 503 without private database details. Only explicit states grant access. Manager/owner paths routed through the new operational guard retain GB-M02's session-scoped `can_manage_garden` database decision.

## Protected surfaces

The operational guard is applied before payload parsing or data access in 21 Management APIs, covering attendance, daily operations, child journals and health, medicine, incidents, task updates, GPS verification, assistant/interaction summaries, smart insights, inspection submission/reporting, violations and safety/AI actions.

It is also applied to 28 operational page sources covering the staff workspace, inspector workspace and shared task center. The inspector control-center alias re-exports its guarded command-center page, making 29 reachable operational routes covered.

Candidate access remains intentionally available for:

- staff onboarding, personal settings, documents, background checks, certificates, public job market and job applications;
- inspector application and personal settings.

An approved staff profile missing canonical employment is sent to a safe `access-pending` screen instead of entering an onboarding/dashboard redirect loop. That screen exposes only the user's own activation status.

## Activation consistency

The staff job-application approval path now creates a permanent staff file and a pending canonical employment before activating the profile. It changes the employment to active only after profile and candidate activation succeed. If a required write fails, the API reports a conflict and the operational guard remains closed.

Direct staff approval, correction and suspension now update `staff_kindergarten_employments` to `active`, `pending_approval` or `suspended`. A missing employment update returns a conflict and operational access remains blocked.

This improves safe transition ordering but does not claim full transaction/idempotency completion. The broader staff invitation/application transaction remains scheduled for GB-M18, and multi-garden employment context remains GB-M19.

## Boundaries preserved

No migrations, Digital Observer core, provider configuration, billing logic, shared `lib/auth.ts`, shared Supabase helpers or dependency files were changed. Candidate records keep the existing role values; this push defines and enforces their lifecycle semantics without adding a parallel role enum.

No live production database was modified. Live RLS/IDOR probes and cross-garden verification remain required under GB-M35/36 and the final launch gate.

## Validation

Validated with the unchanged committed lockfile on Node 24.16.0, within the repository's supported range. CI remains configured for Node 22.

| Check | Result |
|---|---|
| Management authorization suites | PASS, 65/65 combined GB-M02 and GB-M03 tests |
| GB-M03 activation semantics | PASS, 21/21 tests |
| Typecheck | PASS |
| Lint baseline | PASS, 5,363 existing errors / 213 warnings, 0 regressions, canonical scope 0/0 |
| Management contract QA | PASS, 20/20 |
| Domain regression | PASS, 18/18 suites |
| Security regression | PASS, 7/7 suites in the committed configuration |
| Migration health | PASS, 190 committed migrations; existing duplicate descriptive-name warning |
| Production build | PASS, Next.js 16.3.2, 489 pages generated, live activation disabled |
| Patch/protected paths | PASS, no whitespace errors and no changes to Observer core, migrations, shared auth/Supabase helpers or dependency files |

Runtime tests use mocked lifecycle storage to prove fail-closed branch behavior and ordering. A live authenticated Supabase environment was not configured in this isolated checkout, so live RLS/IDOR evidence remains open and is not implied by this PASS.

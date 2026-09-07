# Gan Batuach Management — Effective Data Model Audit

## Scope and counts

- Migration files inspected: **191**.
- SQL-created table names found repository-wide: **approximately 797 valid names** (plus one parser artifact); most are readiness, analytics or Digital Observer tables and are not core Management entities.
- **64 Management tables** are directly material to the requested lifecycle domains and current routes. This is the hard count used by GB-M01.
- The effective model is additive: the initial schema remains, then later migrations add permanent files, affiliation/enrollment/employment junctions, onboarding, billing, communications, compliance and audit structures.

## Core 64-table set

`profiles`, `gardens`, `inspectors`, `teachers`, `staff`, `parents`, `children`, `parent_kindergarten_links`, `permanent_child_files`, `child_kindergarten_enrollments`, `staff_permanent_files`, `staff_kindergarten_employments`, `staff_timeline_events`, `self_service_user_profiles`, `kindergarten_enrollment_requests`, `kindergarten_staff_openings`, `staff_candidate_profiles`, `staff_job_applications`, `inspector_applications`, `user_affiliation_requests`, `kindergarten_onboarding_records`, `kindergarten_age_group_setups`, `kindergarten_fee_groups`, `authorized_adults`, `authorized_pickup_contacts`, `pickup_authorizations`, `child_pickup_events`, `attendance`, `staff_shifts`, `staff_work_schedules`, `staff_location_samples`, `documents`, `messages`, `communication_threads`, `communication_thread_participants`, `notifications`, `communication_preferences`, `complaints`, `complaint_inspection_escalations`, `complaint_regulatory_actions`, `inspection_forms`, `inspection_form_questions`, `inspection_form_assignments`, `inspections`, `inspection_answers`, `inspection_signatures`, `monthly_inspection_cycles`, `required_inspections`, `late_inspections`, `violations`, `tasks`, `child_daily_journals`, `child_health_records`, `child_payment_history`, `subscription_plans`, `kindergarten_subscriptions`, `subscription_payments`, `subscription_checkout_sessions`, `payment_method_tokens`, `parent_payment_authorizations`, `parent_payment_transactions`, `billing_invoices`, `billing_receipts`, `audit_logs`.

## Cardinality truth

| Question | Effective answer | Status |
|---|---|---|
| `user = one garden`? | Not universally. Auth user owns one profile, but relationship tables may link it to many gardens. | PARTIAL |
| `profile = one garden`? | Legacy/current convenience field says yes: `profiles.garden_id` is singular and many pages use it directly. | PARTIAL |
| Owner of multiple gardens? | No canonical owner-garden membership; blocked by single context in current UX/services. | MISSING |
| Parent with children in different gardens? | Supported by permanent child files + `child_kindergarten_enrollments` + `parent_kindergarten_links`, but legacy `parents.garden_id`, `children.garden_id`, `primary_parent_id` coexist. | PARTIAL |
| Staff across/moving gardens? | Employment/history tables support it; current staff/profile context is frequently singular. | PARTIAL |
| Inspector many gardens? | Yes: many garden rows may reference one inspector. One garden currently has one `inspector_id`. | COMPLETE_NEEDS_QA |

## Classroom/capacity model

- There is no canonical `classrooms` entity.
- `kindergarten_age_group_setups` is unique by garden+age group and therefore cannot cleanly represent multiple classes of the same age.
- `kindergarten_fee_groups` combines age range, tuition and capacity; it is being used as a class-like selector.
- `gardens.current_children_count`, fee-group capacity and onboarding counts are denormalized. No transactional seat reservation/enforcement was found.
- Hard-coded assumptions live in `lib/domain/kindergarten-onboarding.ts`: 15/6 infants, 22/9 young toddlers, 27/11 mature toddlers and 35/17.5 kindergarten. These values have no versioned legal source in code and must not be treated as verified law.

Status: **PARTIAL**. Preserve both group tables while a future push introduces a canonical classroom relation and migration/consolidation plan.

## RLS and isolation

RLS is enabled across the major lifecycle tables and uses `is_admin`, `can_access_garden`, own-profile and assignment predicates. The strongest later models bind requests to `auth.uid()` and verify permanent-child ownership. The main residual risk is dual authority: legacy direct garden fields and newer junction tables can disagree. Service-role routes bypass RLS and therefore must always perform explicit target-scope checks.

No production database policy probe was run in this static audit. Classification: **COMPLETE_NEEDS_QA**, not COMPLETE.

## Relevant migration families

| Migration | Purpose | Disposition |
|---|---|---|
| `20260523000000_initial_schema.sql` | initial roles/core entities | preserve |
| `20260523014000_child_finance_center.sql` / `15000_kindergarten_fee_groups.sql` | tuition/group pricing | extend/consolidate |
| `20260527006000_multi_kindergarten_parent_child_architecture.sql` | permanent child and multi-garden links/enrollments | preserve/extend |
| `20260601004000_identity_uniqueness_staff_history.sql` | staff permanent file/employments/history | preserve/extend |
| `20260602003000_subscription_billing_platform.sql` / `20260612013500_*` | platform billing/provider readiness | preserve/repair |
| `20260602004000_communication_platform.sql` | communications/notifications | preserve/consolidate |
| `20260612013100_staff_workforce_gps_attendance_platform.sql` | staff time/workforce | preserve |
| `20260612013200_inspector_monthly_supervision_regulatory_operations.sql` | monthly inspection lifecycle | preserve |
| `20260612013900_full_kindergarten_onboarding_activation.sql` | garden activation | repair |
| `20260612014800_legal_attendance_parent_identity_pickup_compliance.sql` | attendance/pickup evidence | preserve/QA |
| `20260612019200_self_service_registration_affiliations.sql` | current self-service and affiliation requests | preserve/repair |

# PR #235 — Production PUBLIC-function privilege safety review (read-only)

> Follow-up: the direct-login/verifier-returning draft was withdrawn before
> application. See `DIGITAL_OBSERVER_HOME_LEGACY_SECURE_COMPARE_DESIGN_CLOSURE_20261021.md`
> for the current design and the separate narrow ACL proposal. The broad
> REVOKE block below is historical analysis, **not approved execution SQL**.

Date: 2026-10-21. Production Supabase project: `kuaywzvucllxjsxarogb`. Source PR: #235, Draft. All Production inspection was catalog/definition metadata only; no Home enrollment rows or verifiers were read, no function was invoked, and no Production DDL/DML was executed.

## Decision

**Do not provision a direct database LOGIN or grant a LOGIN membership in `home_legacy_compare_reader`.** The draft role is `NOLOGIN NOINHERIT NOBYPASSRLS`, but `NOINHERIT` does not cancel privileges given to `PUBLIC`. Production grants `PUBLIC` schema `USAGE` and `EXECUTE` on all 57 currently audited `public` functions. A login assuming the reader role would therefore also be able to invoke unrelated callable functions. This remains true although no base-table `SELECT` or write grant to `PUBLIC` was found and the enrollment table has RLS.

Five `VOLATILE SECURITY DEFINER` functions are callable directly and contain writes: `assign_child_to_classroom`, `assign_staff_to_classroom`, `escalate_task`, `notify_role`, and `process_monthly_inspection_reminders`. The first two check `can_manage_garden`; `escalate_task` checks `auth.uid()` and admin/inspector access. The latter two have **no explicit caller authorization check in their current definitions**. `notify_role` inserts notification rows. The monthly reminder function updates tasks and inserts notifications, including calls to `notify_role`. An insert to `notifications` has a separate `SECURITY DEFINER` trigger that can enqueue communication-intent rows, so downstream external-delivery effects must be assessed before any live security correction. None was invoked in this review. This is an existing access-surface finding, not proof of exploitation.

The other 26 `VOLATILE` functions return `trigger`: several write indirectly when their owning DML fires, but a normal SQL caller cannot invoke a trigger-returning function directly as a regular RPC. The remaining 26 are `STABLE` or `IMMUTABLE` read/calculation functions; several are `SECURITY DEFINER`. We found no direct DML tokens in their inspected bodies, but their output/authorization semantics still matter: volatility alone is not a safety classification. This review did not dynamically exercise every Product role or independently prove all transitive function calls safe.

## Effective privileges and RLS

- `public` schema: `PUBLIC USAGE` true, `PUBLIC CREATE` false. All 57 audited functions have explicit `PUBLIC EXECUTE`; all 57 also have explicit `anon`, `authenticated`, and `service_role` EXECUTE. No `PUBLIC` grant was found on `public` tables or sequences. No membership inheritance was found for those three roles; a prospective role would nonetheless receive PUBLIC grants.
- Other non-system schemas had no `PUBLIC USAGE` in the observed snapshot, although several functions there carried PUBLIC EXECUTE ACL entries. They were not counted in the 57 accessible public-schema functions; any future schema-USAGE change requires a fresh audit.
- Existing explicit default function privileges in `public` grant `anon`, `authenticated`, and `service_role` EXECUTE for functions created by `postgres` and `supabase_admin`. No owner-global override removing PostgreSQL's default PUBLIC function EXECUTE was observed. Current-function REVOKEs alone do **not** protect a future direct LOGIN from later functions.
- `public.video_gateway_device_enrollments` has RLS enabled, not FORCE RLS, with one admin-only policy (`USING is_admin(); WITH CHECK is_admin()`). No PUBLIC base-table grant exists. The proposed private `SECURITY DEFINER` reader runs as its privileged owner and therefore does **not** gain its exact-row restriction from this RLS policy; its fixed device/Site predicate is the boundary. Its current return shape includes `refresh_token_hash` and permits up to two rows per allowed device call. Thus the draft SQL function is **not** a safe general-purpose comparison endpoint: a principal with its EXECUTE permission can obtain verifier material. Never expose it via PostgREST or to a generic LOGIN.
- A bounded read-only count (without selecting verifiers) found **one current enrollment row per exact Home device**, each in an active enrollment status, with one tenant and one Site per device. The live unique index on `gateway_id` applies only while status is `approved` or `delivered`; the pending private reader does not restrict status or pin enrollment primary keys/tenant IDs and uses `LIMIT 2` without ordering. Thus current cardinality is not a durable exact-two-record proof: historical or later non-active rows could satisfy its predicate. Before any approval, change the unapplied design to pin the two exact enrollment primary keys and tenant/Site binding, fail closed on unexpected cardinality/status, and avoid returning verifier material to an untrusted principal. No Home row was modified or verifier read in this review.
- Production currently has neither the draft role nor its private schema. The isolated development migration is pending and unapplied to Production. No Production credential match is proven.

## Minimum isolated boundary

The immediate safe state is **no Production LOGIN, no role membership, no public endpoint, and no Production migration/deployment**. If a future comparison is approved, select a trusted private server process that verifies the existing Product administrator, exact two-device/Site/tenant scope, five-minute purpose-bound approval, atomic two-attempt limit, durable redacted audit and revocation **before** touching either local credential. Its database read must be restricted to the exact registrations, with no general SQL proxy. The current function would reveal verifier material to the trusted process, so this is not suitable for an untrusted host or client. An alternative server-side compare-only API returning only `MATCH/MISMATCH/UNKNOWN` needs separate design and explicit approval for the protected credential transfer over pinned authenticated TLS; a token digest is verifier-equivalent and not a safe substitute. Do not invoke Legacy refresh.

If an actual direct database LOGIN is nevertheless proposed, it is **blocked** until a separate Production security change removes its inherited PUBLIC execution surface, addresses future function defaults, verifies Product-role compatibility, and replaces/verifiably confines the verifier-returning function. The exact current-function ACL correction for review is below; it has **not** been executed. All pre-existing named-role grants remain in place in the proposal, but other roles relying only on PUBLIC may break. Recheck the live catalog and dependent RPCs immediately before any separately authorized deployment. Do not run this SQL as a routine migration.

## Isolated synthetic clone result

`node scripts/qa/check-home-legacy-public-execute-clone.mjs` creates only a fresh in-memory PGlite database with synthetic device rows. It reproduces a PUBLIC-executable SECURITY DEFINER mutator: the proposed reader role can call it and cause a write despite having no table-write permission. After clone-only PUBLIC REVOKEs, that role cannot execute the mutator or a synthetic stable helper, while explicit `authenticated` EXECUTE survives; exact Gateway/Connector reads still work, a third device is excluded, table access is denied, and a non-superuser session cannot SET ROLE postgres. Regranting PUBLIC in the clone reopens the path. Existing approval-store tests separately cover atomic attempts/audit/revocation. This is **synthetic permission proof**, not a full Production clone, and does not prove a direct login safe against every live dependency. The draft verifier-returning interface also prevents a claim of zero verifier disclosure to an arbitrary reader.

## Review-only current-function SQL proposal — DO NOT EXECUTE

### Audited function inventory

Every row below had PUBLIC EXECUTE in the observed Production catalog. “Callable write” is based on reading the live function body, not merely its VOLATILE declaration. “Trigger” identifies a trigger-only return type, not proof that its owning DML has no side effect.

| # | Signature | Volatility | Direct-call class | SECURITY DEFINER |
| ---: | --- | --- | --- | --- |
| 1 | `"current_role"()` | STABLE | callable read/calculation | yes |
| 2 | `apply_stream_health_check()` | VOLATILE | trigger | yes |
| 3 | `assign_child_to_classroom(uuid,uuid,uuid)` | VOLATILE | callable write | yes |
| 4 | `assign_staff_to_classroom(uuid,uuid,uuid,text)` | VOLATILE | callable write | yes |
| 5 | `block_audit_logs_mutation()` | VOLATILE | trigger | yes |
| 6 | `block_digital_observer_integration_audit_mutation()` | VOLATILE | trigger | no |
| 7 | `block_immutable_audit_mutation()` | VOLATILE | trigger | yes |
| 8 | `camera_physical_payload_valid(text,jsonb)` | IMMUTABLE | callable read/calculation | no |
| 9 | `can_access_child_record(uuid)` | STABLE | callable read/calculation | yes |
| 10 | `can_access_garden(uuid)` | STABLE | callable read/calculation | yes |
| 11 | `can_access_management_communication_thread(uuid)` | STABLE | callable read/calculation | yes |
| 12 | `can_access_network(uuid)` | STABLE | callable read/calculation | yes |
| 13 | `can_access_payment_record(uuid)` | STABLE | callable read/calculation | yes |
| 14 | `can_access_sensitive_child_data(uuid)` | STABLE | callable read/calculation | yes |
| 15 | `can_inspector_access_garden(uuid)` | STABLE | callable read/calculation | yes |
| 16 | `can_parent_access_child_file(uuid)` | STABLE | callable read/calculation | yes |
| 17 | `can_parent_access_child(uuid)` | STABLE | callable read/calculation | yes |
| 18 | `can_parent_access_enrollment_request(uuid)` | STABLE | callable read/calculation | yes |
| 19 | `can_parent_access_garden(uuid)` | STABLE | callable read/calculation | yes |
| 20 | `can_parent_view_camera(uuid,uuid)` | STABLE | callable read/calculation | yes |
| 21 | `can_report_complaint(uuid,uuid)` | STABLE | callable read/calculation | yes |
| 22 | `can_staff_access_garden(uuid)` | STABLE | callable read/calculation | yes |
| 23 | `can_view_management_task(uuid,uuid,text,text,uuid)` | STABLE | callable read/calculation | yes |
| 24 | `check_tuition_entry_scope()` | VOLATILE | trigger | yes |
| 25 | `check_tuition_period_scope()` | VOLATILE | trigger | yes |
| 26 | `complaint_sla_state(uuid,timestamp with time zone)` | STABLE | callable read/calculation | yes |
| 27 | `correlate_digital_observer_signal_trigger()` | VOLATILE | trigger | yes |
| 28 | `current_garden_id()` | STABLE | callable read/calculation | yes |
| 29 | `current_user_role()` | STABLE | callable read/calculation | no |
| 30 | `distance_meters(numeric,numeric,numeric,numeric)` | IMMUTABLE | callable read/calculation | no |
| 31 | `enforce_digital_observer_device_limit()` | VOLATILE | trigger | yes |
| 32 | `enforce_digital_observer_incident_transition()` | VOLATILE | trigger | no |
| 33 | `enforce_first_pilot_activation_gates()` | VOLATILE | trigger | yes |
| 34 | `enforce_observer_engine_boundary()` | VOLATILE | trigger | yes |
| 35 | `escalate_task(uuid,text,uuid)` | VOLATILE | callable write | yes |
| 36 | `guard_camera_diagnostic_queue()` | VOLATILE | trigger | no |
| 37 | `guard_used_inspection_form_insert()` | VOLATILE | trigger | no |
| 38 | `guard_used_inspection_question()` | VOLATILE | trigger | no |
| 39 | `handle_ai_event_after_insert()` | VOLATILE | trigger | yes |
| 40 | `handle_new_user()` | VOLATILE | trigger | yes |
| 41 | `inspection_attention_threshold()` | STABLE | callable read/calculation | yes |
| 42 | `is_admin()` | STABLE | callable read/calculation | yes |
| 43 | `iso_control_score(text,text,text)` | IMMUTABLE | callable read/calculation | no |
| 44 | `jwt_garden_id()` | STABLE | callable read/calculation | no |
| 45 | `jwt_room_uuid()` | STABLE | callable read/calculation | no |
| 46 | `link_corrective_action_task()` | VOLATILE | trigger | yes |
| 47 | `notify_role(uuid,app_role,text,text,text,uuid)` | VOLATILE | callable write | yes |
| 48 | `process_monthly_inspection_reminders(timestamp with time zone)` | VOLATILE | callable write | yes |
| 49 | `set_immutable_audit_hash()` | VOLATILE | trigger | yes |
| 50 | `snapshot_platform_subscription_terms()` | VOLATILE | trigger | yes |
| 51 | `stamp_staff_location_sample_received_at()` | VOLATILE | trigger | no |
| 52 | `sync_garden_management_memberships()` | VOLATILE | trigger | yes |
| 53 | `touch_updated_at()` | VOLATILE | trigger | no |
| 54 | `validate_classroom_assignment_scope()` | VOLATILE | trigger | no |
| 55 | `validate_classroom_reservation_scope()` | VOLATILE | trigger | no |
| 56 | `validate_garden_teaching_assignment()` | VOLATILE | trigger | yes |
| 57 | `validate_management_message_attachment()` | VOLATILE | trigger | no |

The following 57 statements are an exact snapshot manifest, not a blanket `REVOKE ON ALL FUNCTIONS`; it deliberately does not remove named-role grants. A deployment owner must recompare the 57 signatures and ACLs against Production, audit other dependent roles, make a recoverable database backup, and approve a transactional change separately. This correction is **not sufficient by itself** for a direct LOGIN because future PUBLIC defaults and the two-verifier return still remain.

```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION public."current_role"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_stream_health_check() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_child_to_classroom(uuid,uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_staff_to_classroom(uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_audit_logs_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_digital_observer_integration_audit_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_immutable_audit_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.camera_physical_payload_valid(text,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_child_record(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_garden(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_management_communication_thread(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_network(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_payment_record(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_sensitive_child_data(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_inspector_access_garden(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_parent_access_child_file(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_parent_access_child(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_parent_access_enrollment_request(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_parent_access_garden(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_parent_view_camera(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_report_complaint(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_staff_access_garden(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_management_task(uuid,uuid,text,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_tuition_entry_scope() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_tuition_period_scope() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complaint_sla_state(uuid,timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.correlate_digital_observer_signal_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_garden_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.distance_meters(numeric,numeric,numeric,numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_digital_observer_device_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_digital_observer_incident_transition() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_first_pilot_activation_gates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_observer_engine_boundary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.escalate_task(uuid,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_camera_diagnostic_queue() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_used_inspection_form_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_used_inspection_question() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_ai_event_after_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inspection_attention_threshold() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.iso_control_score(text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.jwt_garden_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.jwt_room_uuid() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_corrective_action_task() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_role(uuid,public.app_role,text,text,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_monthly_inspection_reminders(timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_immutable_audit_hash() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.snapshot_platform_subscription_terms() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stamp_staff_location_sample_received_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_garden_management_memberships() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_classroom_assignment_scope() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_classroom_reservation_scope() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_garden_teaching_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_management_message_attachment() FROM PUBLIC;
-- Verify zero PUBLIC EXECUTE on the reviewed signatures and named-role compatibility.
-- COMMIT only in a separately authorized Production change window.
COMMIT;
```

Rollback of this ACL-only proposal, if it were later deployed and caused breakage, must restore **only these prior PUBLIC grants**, after disabling the comparison LOGIN/adapter. The rollback reopens the original exposure and is not a substitute for security remediation. The private reader migration, if separately deployed, needs its own forward-only retirement/revocation plan; it is not deployed now.

```sql
BEGIN;
GRANT EXECUTE ON FUNCTION public."current_role"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_stream_health_check() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_child_to_classroom(uuid,uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_staff_to_classroom(uuid,uuid,uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_audit_logs_mutation() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_digital_observer_integration_audit_mutation() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_immutable_audit_mutation() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.camera_physical_payload_valid(text,jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_child_record(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_garden(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_management_communication_thread(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_network(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_payment_record(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_sensitive_child_data(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_inspector_access_garden(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_parent_access_child_file(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_parent_access_child(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_parent_access_enrollment_request(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_parent_access_garden(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_parent_view_camera(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_report_complaint(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_staff_access_garden(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_management_task(uuid,uuid,text,text,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_tuition_entry_scope() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_tuition_period_scope() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.complaint_sla_state(uuid,timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.correlate_digital_observer_signal_trigger() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_garden_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.distance_meters(numeric,numeric,numeric,numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_digital_observer_device_limit() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_digital_observer_incident_transition() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_first_pilot_activation_gates() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_observer_engine_boundary() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_task(uuid,text,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_camera_diagnostic_queue() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_used_inspection_form_insert() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_used_inspection_question() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_ai_event_after_insert() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspection_attention_threshold() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.iso_control_score(text,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_garden_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_room_uuid() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_corrective_action_task() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_role(uuid,public.app_role,text,text,text,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_monthly_inspection_reminders(timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_immutable_audit_hash() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_platform_subscription_terms() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_staff_location_sample_received_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_garden_management_memberships() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_classroom_assignment_scope() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_classroom_reservation_scope() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_garden_teaching_assignment() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_management_message_attachment() TO PUBLIC;
COMMIT;
```

Required separate authorization before any live step: Production security/database owner signs off the chosen **private comparison architecture**, exact function/role grants or deployment, verifier trust boundary, Product-role compatibility, default-privilege plan, backup, bounded cost and rollback. Then the owner separately approves a two-device comparison window. Until then Gateway and Connector matches are `UNKNOWN`, signed candidate installation and Keychain recovery remain unresolved, and live telemetry switching is not authorized.

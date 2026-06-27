# PILOT FIX 2 - Migration Status Verification

Date: 2026-06-27

## Verification Mode

Local files were verified. Remote application status was not verified because Supabase CLI/DB access is not available in this workspace.

Final remote status for every migration below is therefore `manual_required`.

## Key Migrations

| Migration | Purpose | Local status | Expected remote status | Verified in real Supabase | Pilot blocker |
| --- | --- | --- | --- | --- | --- |
| `20260523000000_initial_schema.sql` | Base schema, core RLS functions/policies. | present | applied | no | yes, if missing |
| `20260602002000_security_hardening_rls_storage.sql` | Private storage buckets and storage/RLS hardening. | present | applied | no | yes |
| `20260612014600_privacy_security_architecture_high_security_compliance.sql` | Privacy/security architecture readiness. | present | applied | no | yes |
| `20260612014700_legal_camera_streaming_parent_viewing_anti_leak.sql` | Camera streaming anti-leak/legal readiness. | present | applied | no | yes if camera included |
| `20260612014900_ai_privacy_dpia_responsible_ai_governance.sql` | AI privacy/governance readiness. | present | applied | no | yes if AI included |
| `20260612015300_medical_sensitive_data_field_encryption.sql` | Medical/sensitive field encryption readiness. | present | applied | no | yes |
| `20260612015400_immutable_audit_trail_evidence_logs_worm_readiness.sql` | Audit trail/evidence logging readiness. | present | applied | no | high |
| `20260612015600_data_rights_retention_deletion_right_to_be_forgotten.sql` | Retention/deletion readiness. | present | applied | no | legal/privacy gate |
| `20260612016200_database_migration_stabilization_supabase_integrity_audit.sql` | RLS/storage integrity audit registry. | present | applied | no | yes |
| `20260612016400_real_camera_gateway_dvr_nvr_home_pilot.sql` | Camera gateway pilot schema/readiness. | present | applied if camera tested | no | camera gate |
| `20260612016500_real_ai_observer_pilot_shadow_calibration.sql` | AI shadow/pilot calibration schema. | present | applied if AI tested | no | AI gate |
| `20260616000100_parent_rls_scope_hardening.sql` | Parent child-specific RLS hardening. | present | applied | no | critical |
| `20260616000200_payment_provider_rls_scope_hardening.sql` | Payment/provider RLS hardening. | present | applied | no | critical |
| `20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql` | Webhook idempotency and demo/freeze readiness. | present | applied after migration error fix | no | payment/provider gate |

## Static Findings

- The parent hardening migration replaces broad parent/garden inheritance with child-specific helpers such as `can_parent_access_child`, `can_parent_access_enrollment_request`, and `can_access_child_record`.
- The payment hardening migration explicitly limits finance/provider tables to admin or `can_manage_garden(garden_id)` and excludes staff/inspectors from inherited operational garden access.
- The PROD 1 migration now uses partial indexes with simple null predicates, avoiding the previous immutable-function predicate failure.
- Several migrations intentionally register live verification gaps, especially storage private-bucket proof and parent isolation.

## Manual SQL Editor Action Required

Daniel must verify remotely:

1. Each listed migration exists in Supabase migration history or its SQL effects exist in catalog.
2. Sensitive tables have `relrowsecurity = true`.
3. Policies for parent/payment/storage/camera/AI tables exist and match expected role boundaries.
4. Negative role tests return zero rows for unauthorized users.


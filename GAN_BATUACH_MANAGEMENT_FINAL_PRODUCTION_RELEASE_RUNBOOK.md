# Gan Batuach Management final Production release runbook

This runbook is executable only after a new owner instruction explicitly authorizes the named RC, merge to `main`, Production migrations and deployment. GB-M40 did none of those actions.

## Hard pre-release checklist — any failure means ABORT

- [ ] Exact owner-authorized RC SHA matches the frozen remote commit and required CI is complete/green.
- [ ] `origin/main` and current Production deployment SHA are verified immediately before the window.
- [ ] Production migration head is verified read-only and no unexpected version/drift exists.
- [ ] Migration file names, checksums and order match the release manifest.
- [ ] Latest Production database backup is completed and the accepted restore proof/plan is current.
- [ ] Private Storage recovery state and retention are accepted.
- [ ] `LEGACY CREDENTIAL REMEDIATION COMPLETE` is independently verified for all 23 records.
- [ ] Required Production URL/Auth configuration and secret names are present and validated without printing values.
- [ ] Optional providers are explicitly classified enabled/disabled; disabled UI states are truthful.
- [ ] Owner-authorized maintenance/release window and customer communication are recorded.
- [ ] No open Product P0/P1 exists.
- [ ] Explicit owner release authorization covering `main`, migrations and Production deploy is recorded.

## Phase A — preparation

1. Name one release owner. Freeze the exact integration/RC SHA; stop unrelated merges into the candidate.
2. Fetch remote state and record current `origin/main`, `origin/integration/development`, Production Vercel deployment ID/SHA and Supabase project reference/migration head.
3. Reconcile the Development and migration ledgers with the RC ancestry. Enumerate INCLUDED, EXCLUDED and BLOCKED units.
4. Confirm Production/Development/QA database, Auth and Storage identities are distinct.
5. Verify a newly completed daily Production physical backup. Verify the owner-accepted provider restore evidence and private Storage recovery evidence.
6. Confirm credential recovery evidence using redacted account references. Never inspect or transmit old/new passwords.
7. Validate required configuration: canonical app/Auth URLs, Supabase server/client credentials, invitation signing, encryption key/version, dedicated hash pepper, health secret and cron secret. Keep passkey/payment/SMS/WhatsApp/DO optional capabilities disabled unless separately proven and authorized.
8. Run the exact RC checks: locked install, typecheck, lint/static regression, Production build, domain, security/isolation, tenant context, migration audit, dependency/secret checks and release preflight.
9. Start the RC in the isolated Production-like environment and run the role/security/storage/report/legacy smoke. Confirm no P0/P1.
10. If all gates pass, create the one consolidated owner-authorized release PR to `main`. Do not bypass branch protection.

## Phase B — migrations 1–11

Put the application in the approved maintenance posture if required. Apply one migration transaction at a time and update the ledger only after commit. Stop at first failure.

GB-M40 empty-clone rehearsal baseline: phase 1 applied in about 5.23 seconds; migration 9 was the longest at 1.09 seconds. Phase 2 applied in about 2.50 seconds. These figures do not predict customer-data lock time; inspect live table volume and locks before the window.

| # | Migration | Verification | Failure handling |
|---:|---|---|---|
| 1 | `20260913210000_management_canonical_messaging_threads.sql` | messaging tables/functions/constraints and tenant policy present | rollback transaction; investigate existing constraint/data |
| 2 | `20260913211000_management_messaging_qa_hardening.sql` | hardened RLS/idempotency functions resolve | rollback/reapply only after cause fixed |
| 3 | `20260913212000_management_private_message_attachments.sql` | private attachment table/index/RLS present | rollback transaction |
| 4 | `20260919170000_classroom_scope_trigger_record_fields.sql` | trigger function points at record fields | reapply prior function or forward fix |
| 5 | `20260919180000_management_notification_pipeline.sql` | notification columns/constraints/indexes pass | rollback; inspect communication table preconditions |
| 6 | `20260920110000_management_email_first_verification.sql` | Email-first verification evaluator resolves | reapply prior function/forward fix |
| 7 | `20260920120000_management_external_delivery.sql` | delivery intent/lease indexes and RPCs present | rollback; inspect intent data |
| 8 | `20260920130000_management_private_documents.sql` | document fields/FKs/RLS/private policy present | rollback; no URL rewrite assumption |
| 9 | `20260920140000_management_child_attendance_pickup.sql` | unique daily records, pickup functions/RLS pass | abort on duplicate/precondition; repair explicitly |
| 10 | `20260920150000_management_staff_time_ledger.sql` | one-active-session constraints, RPCs, RLS/indexes pass | rollback/forward fix |
| 11 | `20260920160000_management_tuition_audit_role_fix.sql` | canonical RPC actor/audit role preserved | reapply prior RPC/forward fix |

Re-read the migration ledger and schema. If the application-compatible phase-1 state differs from the rehearsal, ABORT.

## Phase C — application deploy

1. Merge only the approved release PR to `main` after all exact-head checks pass.
2. Observe the single normal Vercel Production deployment; do not trigger an extra manual deployment.
3. Record deployment ID, built commit, build result, domain alias/TLS state and health.
4. Verify the new application is serving before phase 2. If it fails while the phase-1 schema remains backward compatible, roll back to the recorded previous Vercel deployment and stop.

## Phase D — migrations 12–16

**POINT OF NO RETURN: immediately before migration 12.** Reassert `LEGACY CREDENTIAL REMEDIATION COMPLETE`, current backup/restore acceptance, new app health and exact migration order. If any is false, ABORT.

| # | Migration | Verification | Failure handling |
|---:|---|---|---|
| 12 | `20260920170000_retire_generated_plaintext_credentials.sql` | legacy plaintext column absent; new app Auth smoke works | do not run old app; use new app + forward fix or database recovery |
| 13 | `20260921150000_management_staff_candidate_private_documents.sql` | candidate documents/RLS/indexes present | rollback transaction/forward fix |
| 14 | `20260922100000_management_enrollment_audit_role_fix.sql` | enrollment decision audit actor preserved | reapply prior RPC/forward fix |
| 15 | `20260922110000_management_enrollment_activation_audit_role_fix.sql` | activation audit actor preserved; no unsolicited payment mutation | reapply prior RPC/forward fix |
| 16 | `20260922120000_management_parent_notification_category_fix.sql` | parent notification taxonomy/constraint valid | rollback/forward fix |

After migration 12 commits, never blindly roll back to the old Production application. Database rollback means coordinated provider recovery or a reviewed forward repair, with Auth and Storage consistency assessed.

## Phase E — final verification

1. Verify final migration ledger/count, schema checksums, RLS, RPCs, indexes and constraints.
2. Verify application version/deployment ID, domain alias/TLS, public health and authenticated deep health.
3. Verify Auth configuration and controlled login/recovery entry without contacting customers.
4. Verify private Storage policy and one authorized controlled retrieval if an approved Production-safe fixture exists.
5. Confirm optional unavailable provider states remain truthful.

## Post-release smoke

- Public: homepage, login, signup entry and recovery entry.
- Owner: Dashboard and authorized Garden context.
- Parent: Dashboard and own Child context.
- Staff: Dashboard and active employment context.
- Inspector: Dashboard plus assigned/unassigned boundary.
- Admin: aggregate-safe Dashboard.
- API: `/api/health`, authenticated deep health, and representative protected unauthenticated route returning 401/403.
- Reporting: canonical summary and CSV formula-injection guard.
- Storage: authorized private retrieval and anonymous denial using a controlled safe fixture only.
- Finance: manual tuition/subscription state and unavailable checkout truth; no real charge.
- Notifications: readiness or controlled QA destination only; no customer blast.
- Safety: unavailable/readiness unless the independent DO capability contract is Production verified.

## Monitoring window

Observe an owner-approved bounded window after smoke. Monitor HTTP 5xx, Auth/recovery failures, database/constraint/RLS errors, Storage errors, cron/notification worker failures and unexpected enrollment/payment/attendance/time state changes. No Production SLA is inferred.

## Incident decisions

- **Release P0:** cross-tenant exposure, Child release bypass, credential exposure or widespread corruption. Stop rollout/writes where safe, contain access and invoke the recovery owner immediately.
- **Release P1:** core login, onboarding, enrollment, attendance/pickup or broad role access failure. Stop the release and choose app rollback only when schema-compatible; otherwise forward-fix or recover.
- App failure with compatible schema: return domain alias to the recorded previous Vercel deployment.
- Migration failure before commit: transaction rollback, diagnose and retry only the same reviewed migration.
- Data corruption or post-point-of-no-return failure: do not improvise SQL rollback; preserve evidence, stop affected writes and use reviewed forward repair or provider recovery.

## Post-release integrity sample

Read a bounded sample of Garden membership, Guardian link, active enrollment, employment, Classroom, tuition, message, document, attendance and Staff-time records. Reconcile access through canonical roles. Do not run destructive broad scans.

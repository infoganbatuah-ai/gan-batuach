# PILOT FIX 1 - Roadmap To Real Pilot Ready

Date: 2026-06-27

## Phase 1 - PILOT FIX 2: Supabase/RLS Real Environment Verification & Security Closure

Purpose:

- prove role isolation and storage/payment privacy in the target Supabase project.

Blockers addressed:

- RLS
- role access
- parent/child privacy
- sensitive documents
- payment/provider table access

Expected outputs:

- executed SQL/JWT test plan
- evidence screenshots/logs
- pass/fail matrix
- security fixes if required

Success criteria:

- no cross-role data leak
- signed URLs short-lived and authorized

## Phase 2 - PILOT FIX 3: Legal, Privacy, Consent & Child Data Documentation Closure

Purpose:

- complete legal/privacy documentation before real data.

Expected outputs:

- privacy/terms
- child data notice
- camera/AI notice
- retention/deletion plan
- consent model

Success criteria:

- legal/privacy owner signs off for pilot scope.

## Phase 3 - PILOT FIX 4: Real Pilot Environment Separation, Seed/Test Accounts & Access Control

Purpose:

- separate demo/staging/pilot/production and prepare pilot accounts.

Expected outputs:

- environment matrix
- pilot Supabase/Vercel config
- demo data segregation
- real pilot account plan

Success criteria:

- no demo data in real pilot environment.

## Phase 4 - PILOT FIX 5: Real Pilot Role Flow End-to-End Validation

Purpose:

- validate manager/staff/inspector/admin/limited-parent flows.

Expected outputs:

- role journey evidence
- mobile/tablet/desktop QA
- bug list and fixes

Success criteria:

- all included pilot roles can complete their scoped workflows.

## Phase 5 - PILOT FIX 6: Camera Pilot Policy, Gateway Validation & Parent-Viewing Lockdown

Purpose:

- validate camera gateway only if camera is in pilot scope.

Expected outputs:

- camera policy
- gateway test
- no-RTSP evidence
- token/audit tests
- parent viewing disabled or fully approved

Success criteria:

- no camera credential exposure.

## Phase 6 - PILOT FIX 7: AI Shadow Mode Pilot Validation & Human Review Lockdown

Purpose:

- validate AI as internal shadow/review only.

Expected outputs:

- shadow event tests
- parent raw AI denial test
- human review flow
- legal mode checklist

Success criteria:

- no parent raw AI and no automatic accusations.

## Phase 7 - PILOT FIX 8: Provider/Payment/Notification Pilot Mode Closure

Purpose:

- close payment/provider/notification readiness for pilot.

Expected outputs:

- provider mode decisions
- sandbox webhook tests if used
- notification test recipient setup
- manual/sandbox billing policy

Success criteria:

- no live side effects without explicit approval.

## Phase 8 - PILOT QA 1: Real Pilot Go/No-Go Validation

Purpose:

- final validation against all readiness gates.

Expected outputs:

- Go/No-Go report
- blocker register
- pilot decision

## Phase 9 - PILOT RELEASE 1: Controlled Real Kindergarten Pilot Launch

Purpose:

- launch only after all critical/high blockers are closed.

Expected outputs:

- pilot runbook
- access list
- rollback path
- support rota

roadmap_status = ready_for_pilot_fix_2

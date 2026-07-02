# PILOT FIX 5 - Synthetic Data Readiness Report

Date: 2026-07-03

## Result

Synthetic data readiness is documented but not executed.

No seed scripts were run. No destructive reset was performed. No real users, children, parents, documents, payments, camera streams or AI records were created.

## Required Entities

| Entity | Required | Current readiness | Notes |
|---|---:|---|---|
| Kindergarten A | yes | PLANNED | required for positive manager/staff/inspector scope |
| Kindergarten B | yes | PLANNED | required for negative boundary tests |
| Manager A/B | yes | PLANNED | accounts must be created manually or by a new non-destructive staging-only seed |
| Parent A/B | yes | PLANNED | must use synthetic child data only |
| Child A/B | yes | PLANNED | no real names, documents or medical data |
| Staff Unassigned | yes | PLANNED | denial test before assignment |
| Staff Assigned A | yes | PLANNED | positive work-context test |
| Inspector Unassigned | yes | PLANNED | denial test before assignment |
| Inspector Assigned A | yes | PLANNED | positive inspection-scope test |
| Admin | yes | PARTIAL | generic seed script can create admin but not full A/B dataset |
| Enrollment request | yes | PLANNED | Parent A -> Kindergarten A |
| Attendance record | yes | PLANNED | Garden A only |
| Schedule day | yes | PLANNED | parent/staff/manager visibility |
| Message thread | yes | PLANNED | role-targeted messages |
| Document placeholder | yes | PLANNED | private storage/signed URL test |
| Inspection form/report | yes | PLANNED | assigned inspector flow |
| Subscription/demo/payment state | yes | PLANNED | no live provider |
| Camera readiness record | yes | PLANNED | no raw RTSP or credentials |
| AI shadow/readiness record | yes | PLANNED | parent raw AI denial |
| Digital Observer test site | if included | PLANNED | product separation test |

## Existing Script Review

| Script | Status | Safe for this phase? | Reason |
|---|---|---|---|
| `scripts/seed-test-users.mjs` | exists | NO | creates only five generic users and does not create A/B gardens/children/assignments |
| `scripts/seed-demo-full.mjs` | exists | NO | broad demo script with reset behavior; demo-only and not suitable for pilot access-boundary proof without explicit target confirmation |

## Required Next Setup

1. Confirm target Supabase project is staging/demo, not production.
2. Create or manually add A/B synthetic accounts from `PILOT_FIX_4_SEED_TEST_ACCOUNTS_PLAN.md`.
3. Add A/B synthetic records from `PILOT_FIX_4_SEED_DATA_PLAN.md`.
4. Run negative access tests from `PILOT_FIX_5_NEGATIVE_ACCESS_TEST_RESULTS.md`.
5. Record screenshots/logs without secrets.

## Status

Synthetic data status: **MANUAL_REQUIRED**

Real pilot status: **BLOCKED_FOR_REAL_CHILD_PARENT_DATA**

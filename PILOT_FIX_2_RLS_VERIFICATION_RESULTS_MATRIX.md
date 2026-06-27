# PILOT FIX 2 - RLS Verification Results Matrix

Date: 2026-06-27

Status values:

- `PASS`: verified.
- `FAIL`: verified failed.
- `NOT_TESTED`: not attempted.
- `MANUAL_REQUIRED`: must be run in real Supabase.
- `BLOCKED_BY_ENVIRONMENT`: cannot run from this workspace.
- `NEEDS_SUPABASE_SQL_EDITOR`: Daniel must run in Supabase SQL Editor.

## Results

| Test ID | Role | Data/object | Expected result | Actual result | Status | Severity if fail | Fix applied | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUILD-001 | all | local app typecheck | pass | passed | PASS | critical | none | none |
| BUILD-002 | all | local production build | pass | passed | PASS | critical | none | none |
| BUILD-003 | all | diff whitespace/conflict markers | pass | passed | PASS | low | none | none |
| MIG-001 | admin | local parent RLS migration exists | present | present | PASS | critical | none | remote application unverified |
| MIG-002 | admin | local payment RLS migration exists | present | present | PASS | critical | none | remote application unverified |
| MIG-003 | admin | remote migration history | applied remotely | not checked | BLOCKED_BY_ENVIRONMENT | critical | none | needs Supabase SQL Editor/CLI |
| CAT-001 | admin | sensitive table RLS catalog | RLS enabled | not checked | NEEDS_SUPABASE_SQL_EDITOR | critical | none | manual required |
| CAT-002 | admin | broad policy scan | no broad sensitive access | not checked | NEEDS_SUPABASE_SQL_EDITOR | critical | none | manual required |
| STORAGE-001 | admin | sensitive bucket public flags | private | not checked | NEEDS_SUPABASE_SQL_EDITOR | critical | none | manual required |
| STORAGE-002 | parent A | signed URL for Child B document | denied | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PARENT-001 | parent A | own profile | allow | not checked | MANUAL_REQUIRED | high | none | manual required |
| PARENT-002 | parent A | Child A | allow | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PARENT-003 | parent A | Child B | deny/zero rows | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PARENT-004 | parent A | all children in Kindergarten A | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PARENT-005 | parent A | platform subscription/provider records | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PARENT-006 | parent A | raw AI events | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PARENT-007 | parent A | raw camera credentials | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| STAFF-001 | staff unassigned | children/parents | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| STAFF-002 | staff assigned A | Kindergarten A work context | allow scoped | not checked | MANUAL_REQUIRED | high | none | manual required |
| STAFF-003 | staff assigned A | Kindergarten B | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| STAFF-004 | staff assigned A | payment/provider records | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| MANAGER-001 | manager A | Kindergarten A | allow | not checked | MANUAL_REQUIRED | high | none | manual required |
| MANAGER-002 | manager A | Kindergarten B | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| MANAGER-003 | pending manager | active manager capabilities | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| INSPECTOR-001 | inspector unassigned | gardens | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| INSPECTOR-002 | inspector assigned A | Kindergarten A inspections | allow scoped | not checked | MANUAL_REQUIRED | high | none | manual required |
| INSPECTOR-003 | inspector assigned A | Kindergarten B | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| ADMIN-001 | non-admin | admin route/API by URL | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| ADMIN-002 | admin | provider health without secrets | allow status only | static routes checked partly | MANUAL_REQUIRED | high | none | live UI/API review required |
| PAY-001 | parent/staff/inspector | provider webhook events | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| PAY-002 | manager A | own subscription status | allow | not checked | MANUAL_REQUIRED | high | none | manual required |
| PAY-003 | manager A | other garden subscription | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| CAMERA-001 | parent A | camera token without policy/attendance | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| CAMERA-002 | manager A | raw RTSP/credentials in API payload | deny | static sanitization reviewed | MANUAL_REQUIRED | critical | none | live payload inspection required |
| AI-001 | parent A | raw AI event/review queue | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| AI-002 | manager/inspector | scoped AI events only | allow scoped | not checked | MANUAL_REQUIRED | high | none | manual required |
| OBS-001 | Gan Batuach parent | Digital Observer site data | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |
| OBS-002 | Digital Observer customer | Gan Batuach children | deny | not checked | MANUAL_REQUIRED | critical | none | manual required |

## Gate Result

Recommended RLS/security status:

`RLS_MANUAL_SUPABASE_VERIFICATION_REQUIRED`

Real pilot remains blocked until critical/high manual tests pass in the target Supabase environment.


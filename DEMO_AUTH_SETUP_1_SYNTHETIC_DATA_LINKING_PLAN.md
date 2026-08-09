# DEMO AUTH SETUP 1 - Synthetic Data Linking Plan

No real child data, real parent data, real documents or real camera credentials are allowed.

| Role | Minimum synthetic data |
|---|---|
| Parent | Child A, parent-child link, enrollment/request status, messages, schedule, payment readiness, camera locked/readiness, AI locked/readiness |
| Manager | Kindergarten A, approved manager status, children list, enrollment request, staff records, attendance/schedule sample, subscription/payment readiness, camera readiness, inspection/report readiness |
| Staff unassigned | Profile only; no kindergarten assignment; no child access |
| Staff assigned | Assigned to Kindergarten A; shift/task/message/document readiness |
| Inspector unassigned | Profile only; no inspector assignment; no garden access |
| Inspector assigned | Assigned Kindergarten A; required inspection, inspection form/report readiness |
| Admin | Admin profile; pending/approved user samples; provider health/readiness; pilot readiness/support owner reminder |
| Digital Observer | Standalone demo observer site; owner membership; camera/AI readiness state; review queue readiness; billing readiness if applicable |

Existing `seed:demo-full` covers most assigned Gan Batuach role data. The optional QA script fills missing unassigned and Digital Observer access users, but Daniel still needs to verify that target Supabase data exists before all-role visual QA.

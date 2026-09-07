# Gan Batuach Management — Inspector Audit

## Lifecycle matrix

| Capability | Route/API/Data | Status | Finding |
|---|---|---|---|
| Registration/application | `/app/register/inspector`, `/dashboard/inspector/apply`, inspector applications API | COMPLETE_NEEDS_QA | inactive profile and application record |
| City/region/profile | inspectors + preferred/assigned regions | COMPLETE_NEEDS_QA | stored and admin editable |
| Admin approval/rejection | admin applications page/API | COMPLETE_NEEDS_QA | includes reason and notifications |
| Garden assignment | `gardens.inspector_id` updated by admin | COMPLETE_NEEDS_QA | many gardens per inspector; one inspector per garden |
| Assigned-garden access | RLS/helper checks and page queries | COMPLETE_NEEDS_QA | production IDOR proof still required |
| Monthly inspections | forms, cycles, cron, due/history pages, submit API | COMPLETE_NEEDS_QA | runtime schedule and migration state need QA |
| Scoring/signature/GPS | answers, signatures, validations, report route | COMPLETE_NEEDS_QA | legal/device proof not performed |
| Violations/remediation | violations/tasks/corrective actions | PARTIAL | duplicate workflow concepts |
| Complaints/escalations | complaint and regulatory tables/pages | PARTIAL | SLA/closure E2E unverified |
| Reports | inspector/admin/garden report pages | PARTIAL | multiple reporting implementations |
| Create preliminary Garden | no inspector-scoped creation/invite endpoint | MISSING | requested flow absent |

## Requested missing flow

Inspector → preliminary Garden → invite owner/teacher → registration → activation → inspector assignment is **MISSING**. Existing admin provisioning and garden manager application foundations should be extended; do not create a second identity or invitation engine.

## Security

The assignment check must be server-side for every garden/inspection/complaint/document target. Admin approval currently performs inspector upsert, optional garden updates, profile activation and application update as separate operations; partial success is possible. Classification: **P1 transactional integrity**, not a demonstrated P0 exploit.

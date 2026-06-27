# PILOT FIX 2 - Sensitive Data Surface Inventory

Date: 2026-06-27

## Inventory

| Surface | Sensitivity | Allowed roles | Must not access | Local RLS/storage status | Pilot blocker |
| --- | --- | --- | --- | --- | --- |
| `profiles` | personal data, role identity | own user, admin; scoped role reads where needed | anonymous, unrelated users | RLS expected; role helpers present | manual live RLS required |
| role assignments / `profiles.role` / `garden_id` | authorization-critical | admin; own profile limited | non-admin role escalation | Admin routes use `requireRole(["admin"])` for writes reviewed | manual live API/RLS required |
| `gardens` / `kindergartens` | operational plus public-safe subset | public only approved columns; manager own garden; inspector assigned; admin | unrelated manager/staff/inspector for private fields | helper `can_manage_garden`, `can_access_garden` present | manual live RLS required |
| `children` | child personal/sensitive | parent own child; manager own garden; assigned staff by policy; assigned inspector by policy; admin | other parents, unrelated staff/inspectors, public | parent hardening migration present | critical manual negative tests |
| parent-child links | relationship-sensitive | linked parent, own-garden manager, admin | unrelated users | parent scope functions present | critical manual negative tests |
| child-kindergarten enrollment | child operational | linked parent, target garden manager, admin | unrelated gardens/users | parent enrollment function present | manual live RLS required |
| `staff` | employment/personal | own staff, manager own garden, admin | parents, unrelated managers, unassigned staff | staff helper uses active profile/garden match | manual live RLS required |
| staff applications | employment/application data | applicant, target manager, admin | unrelated staff/parents/inspectors | routes use service role in some application flows | manual API and RLS required |
| inspector assignments | compliance-sensitive | assigned inspector, admin | pending/unassigned inspector, public | `can_inspector_access_garden` present | critical manual negative tests |
| attendance | child daily status | parent own child summary, manager own garden, approved staff, admin | unrelated parents/staff/inspectors | base RLS expected | manual live RLS required |
| schedules | child/garden operational | relevant garden/parent/staff/admin | unrelated roles | API uses scoped clients/RLS | manual live RLS required |
| messages | private communications | participants/scoped garden/admin | unrelated users/public | CRUD route relies on permission + RLS | manual live RLS required |
| `documents` | sensitive docs, medical/ID possible | owner/uploaded_by, child-scoped parent, own staff doc, own-garden manager, admin | public, unrelated roles | `can_access_document` in hardening migration; bucket private expected | critical manual storage tests |
| child documents | regulated child data | own parent, own-garden manager/admin where policy allows | other parents/staff pre-approval/public | upload route signed TTL 10 minutes | critical manual signed URL tests |
| staff documents | employment docs | own staff, own-garden manager/admin | parents, other staff, unrelated gardens | upload route scoped by role bucket, DB scope manual | manual live tests |
| incident reports | safety-sensitive | own garden/assigned inspector/admin; parent only approved summaries | raw public/other parents | RLS expected; no live proof | high |
| inspection reports/evidence | regulatory/sensitive | assigned inspector, own manager, admin; parent only approved summaries | public/unassigned inspectors/parents raw evidence | `inspection-reports` bucket expected private | critical manual storage tests |
| camera records | credentials/stream metadata | own manager/admin; parent only sanitized allowed status; inspector assigned if policy | public, unrelated roles, raw credentials to all clients | camera sanitization and token route present | critical manual API tests |
| camera sessions/tokens | high-risk live viewing | authorized viewer only, audited admin | public/unrelated users | token TTL 60-300s in code | critical manual token tests |
| AI events | raw AI sensitive | admin/reviewers by policy, manager/inspector scoped where allowed | parents raw AI, public, unrelated roles | AI shadow route admin-only for creation; CRUD generic read must rely on RLS | critical manual negative tests |
| AI review queue | investigation-sensitive | authorized reviewer/admin | parents/public/unrelated staff | RLS expected | critical manual tests |
| payment subscriptions | finance-sensitive | manager own garden, admin | parents/staff/inspectors/unrelated managers | payment RLS hardening present | manual live RLS required |
| provider webhook events | provider/security-sensitive | server/admin only | all ordinary roles/public | idempotency table/index present | critical manual RLS/API tests |
| invoices/receipts | financial/legal | relevant payer/manager/admin by stream | wrong stream/roles | payment stream docs present | manual live RLS required |
| audit logs | security-sensitive | admin; limited self/audit where explicit | ordinary users/public | RLS expected | high manual tests |
| notifications | private user events | recipient/admin | other users/public | RLS expected | manual live tests |
| Digital Observer sites/cameras/events | product/customer-sensitive | site owner/admin, product admin | Gan Batuach parents/staff/other customers | separation migrations present | critical manual cross-product tests |

## Priority For Real Pilot

Critical manual proof before any real child data:

1. Parent A cannot access Parent B child, docs, messages or AI/camera data.
2. Manager A cannot access Kindergarten B.
3. Staff cannot see child/parent data before approval.
4. Inspector cannot see unassigned gardens.
5. Sensitive buckets are private and signed URLs are short-lived.
6. Provider/payment records are invisible to parent/staff/inspector.
7. Raw AI and raw camera credentials are never returned to browser/client roles.


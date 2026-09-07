# Gan Batuach Management — Role Matrix

| Role | Canonical role value | Entry/activation | Garden scope today | Main routes | Material permissions | Status | Findings |
|---|---|---|---|---|---|---|---|
| Garden owner | `owner` | self-service manager path or admin provisioning | `profiles.garden_id` (single) | `/dashboard/garden/*`, `/onboarding/kindergarten` | garden/children/staff/documents/cameras; notably no billing permissions in current owner list | PARTIAL | Owner shares manager UI but is not automatically a teacher record; no multi-garden ownership model; permission parity with manager is inconsistent. |
| Garden teacher/manager | `manager` | self-service/admin approval | `profiles.garden_id` (single) | same garden routes | broad garden management + billing | COMPLETE_NEEDS_QA | Functional primary role, but singular profile scope conflicts with future networks/multiple gardens. |
| Staff candidate | stored as role `staff`, inactive/pending | self-service | no garden until approval | `/dashboard/staff`, `/dashboard/staff/job-market`, `/onboarding/staff` | role map already grants staff permissions, while `active=false` is expected to gate lifecycle | PARTIAL | Candidate is not a distinct RBAC role. Every route must honor activation/assignment, not only role. |
| Assigned staff | `staff` | application approval or direct provisioning | profile/staff row often singular; employment table supports many | `/dashboard/staff/*` | attendance, child journal, medical read, documents, messages, cameras | PARTIAL | New employment history supports multiple gardens, but active dashboard context still uses one `garden_id`. |
| Parent | `parent` | self-service or garden invitation | links/enrollments support many; profile/parents legacy fields remain singular | `/dashboard/parent/*`, `/parent-onboarding` | own children, messages, complaints, attendance/pickup, documents, cameras | PARTIAL | Multi-child/multi-garden foundation exists; ownership checks are split across profile ID, parents ID and primary parent. |
| Inspector | `inspector` | self-service + admin approval | many gardens through `gardens.inspector_id` | `/dashboard/inspector/*` | inspections, violations, reports, assigned-garden reads | COMPLETE_NEEDS_QA | Many gardens work; one inspector per garden. Preliminary-garden creation flow is missing. |
| Platform admin | `admin` | admin provisioning | global | `/dashboard/admin/*` | all core permissions | COMPLETE_NEEDS_QA | 140 pages create high navigation/duplication risk. Service-role endpoints generally guard admin, but route-level review remains required. |
| Network manager | `network_manager` | migration/admin only | membership-dependent | admin enterprise/observer routes | cross-garden read subset | PARTIAL | Exists in TypeScript but is outside the requested primary role UX and not consistently represented in DB/history. |

## RBAC conclusions

- Preserve `requireRole`, `requirePermission`, `rolePermissions` and the dashboard redirect helpers.
- Repair the owner permission list: the intended Garden→Gan Batuach subscription journey conflicts with owner lacking `billing:read/write` while manager has both.
- Add an explicit candidate-state gate to sensitive staff/inspector routes; role alone is not equivalent to activation.
- Consolidate tenant context around memberships/employments/enrollments. Do not continue treating `profiles.garden_id` as the only authority.
- Keep Management authorization above any Digital Observer technical capability.

## Route/API authorization risk classes

| Pattern | Assessment | Status |
|---|---|---|
| Central `requireRole`/`requirePermission` | strong reusable foundation | COMPLETE_NEEDS_QA |
| Supabase session client + RLS | correct default for CRUD | COMPLETE_NEEDS_QA |
| Service-role client after explicit garden/child/application lookup | acceptable pattern, needs adversarial tests | COMPLETE_NEEDS_QA |
| Generic CRUD accepting client `garden_id` | relies heavily on RLS; potential IDOR if policy drift occurs | PARTIAL |
| Candidate represented as inactive staff/inspector | fragile unless every route checks lifecycle | PARTIAL |
| Admin frontend navigation only | not accepted as authorization; audited admin mutation routes generally have server guard | COMPLETE_NEEDS_QA |

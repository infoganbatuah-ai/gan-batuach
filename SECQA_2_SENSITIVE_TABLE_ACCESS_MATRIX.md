# SECQA 2 Sensitive Table Access Matrix

Date: 2026-06-27

Legend:

- yes = allowed when scoped and authenticated.
- no = not allowed.
- public-safe = only approved public fields.
- admin = admin-only.
- required = RLS/server guard is required.

| Data model / table area | Sensitivity | Parent | Manager | Staff | Inspector | Admin | Public | RLS required | Server guard required | Current risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `profiles`, roles, auth-linked profile data | sensitive | own only | own + own garden users as allowed | own only | own only | yes | no | required | required | medium: role escalation needs live tests |
| `parents`, parent records | sensitive | own only | own garden only | no | no | yes | no | required | required | low after parent hardening, live test needed |
| `children` | child-sensitive | own children only | own garden only | assigned garden/role only | no unless authorized inspection context | yes | no | required | required | high if latest RLS not applied |
| `permanent_child_files`, child profiles | child-sensitive | own child files only | own garden only | role-limited | no unless authorized | yes | no | required | required | high if latest RLS not applied |
| parent-child/enrollment links | child-sensitive | own requests/links | own garden requests | no | no | yes | no | required | required | medium |
| `gardens`, kindergartens | mixed | public-safe + linked garden | own garden | assigned garden | assigned gardens only | yes | public-safe | required | required | medium |
| manager-kindergarten links | sensitive | no | own only | no | no | yes | no | required | required | medium |
| `staff`, staff assignments | sensitive | no | own garden only | own record | limited assigned-garden summary only | yes | no | required | required | medium |
| staff applications | sensitive | no | own garden openings/apps | own applications | no | yes | public-safe openings only | required | required | medium |
| staff documents/certificates | sensitive documents | no | own garden as authorized | own docs only | no | yes | no | required | required | high: storage signed URL live tests needed |
| inspectors | sensitive | no | no | no | own profile + assigned state | yes | public-safe explanation only | required | required | medium |
| inspector applications | sensitive documents | no | no | no | own application only | yes | no | required | required | medium |
| inspector assignments | sensitive | no | no | no | own assigned gardens only | yes | no | required | required | high: negative assignment tests required |
| enrollment requests | child-sensitive | own requests | own garden requests | no | no | yes | no | required | required | medium |
| messages / communication threads | sensitive | own conversations only | own garden conversations | permitted conversations only | assigned context only | yes by policy | no | required | required | medium |
| child diaries/timelines | child-sensitive | own approved child entries only | own garden | assigned/role-limited | no except report context | yes | no | required | required | high: parent-visible filtering must be live tested |
| medical notes/allergies/medicine | medical | own child only where intended | own garden need-to-know | role/need-to-know only | no unless explicit authorized inspection need | yes | no | required | required | high |
| attendance/pickup permissions | child-sensitive | own child pickup/attendance | own garden | role-limited | no unless inspection context | yes | no | required | required | medium |
| documents metadata | sensitive documents | own/uploaded/own child only | own garden | own/assigned as authorized | assigned inspections/docs only | yes | no | required | required | high |
| storage buckets/files | sensitive documents/evidence | signed own access only | signed own garden access | signed own/assigned access | signed assigned inspection access | signed admin access | public assets only | required | required | high |
| child tuition/payment records | finance/child-sensitive | own child tuition only | own garden only | no | no | yes | no | required | required | high |
| Gan Batuach subscriptions/payments | finance | no | own garden subscription only | no | no | yes | no | required | required | high |
| invoices/provider webhook events | finance/provider | no | own garden invoices where applicable | no | no | yes | no | required | required | high |
| Digital Observer subscriptions/billing | finance/product-sensitive | no | no unless product owner | no | no | yes | no | required | required | high |
| inspections/reports | regulated | own child public-approved reports only | own garden reports | no except assigned tasks | assigned gardens only | yes | no | required | required | high |
| findings/corrective actions | regulated | no raw/internal | own garden | no | assigned gardens only | yes | no | required | required | high |
| inspection evidence/signatures | regulated evidence | no | own garden as authorized | no | assigned inspection only | yes | no | required | required | high |
| camera streams metadata | camera-sensitive | own allowed child/garden cameras sanitized only | own garden | assigned/role-limited only | assigned garden/purpose only | yes | no | required | required | high |
| camera credentials / RTSP / gateway secrets | secret | no | no raw credential display | no | no | no raw display | no | required | required | critical if exposed |
| AI observer events | AI-sensitive | no raw events | reviewed/scoped only | reviewed/scoped only if authorized | reviewed assigned signals only | yes | no | required | required | high |
| raw AI frames/payloads/audio/face signals | AI-sensitive/legal | no | no | no | no unless authorized reviewed workflow | admin/legal only | no | required | required | high/legal |
| audit logs | audit/security | no | own garden summaries only if intended | no | no | yes | no | required | required | high |
| support tickets/demo leads | personal data | own submissions | own garden leads where converted | no | no | yes | public insert only | required | required | medium: abuse/rate limiting |
| Digital Observer sites/cameras/events | product-sensitive | no | no unless owner/member | no | no | yes | public marketing only | required | required | high |

## Cross-Role Boundary Findings

| Classification | Finding | Status |
|---|---|---|
| requires_supabase_manual_test | Parent-child, manager-garden, staff-assignment and inspector-assignment boundaries must be negative-tested against live Supabase policies. | Required before production. |
| high | Medical, child timeline and storage signed URL flows are the highest privacy-risk areas after UX rescue. | Runtime seeded tests required. |
| high | Camera/AI areas contain multiple readiness/admin views; no raw credentials were found in tracked code, but live data must be checked. | Runtime seeded tests required. |


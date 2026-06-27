# PILOT FIX 2 - Role Access Matrix

Date: 2026-06-27

Legend:

- `allow`: role may access under the stated scope.
- `deny`: role must not access.
- `conditional`: access only after assignment/approval/policy.
- `public-safe`: approved public fields only.

| Role/state | Own profile | Public kindergarten listing | Child profile | All children in kindergarten | Parent contact | Staff data | Inspector data | Attendance | Messages | Documents | Inspection reports | Payments/provider | Camera records/viewing | AI events/review | Audit logs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| anonymous/public | deny | public-safe | deny | deny | deny | deny | deny | deny | deny | deny | deny | deny | deny | deny | deny |
| parent | allow | public-safe | own child only | deny | own only | deny | deny | own child summary | participant only | own child/uploaded only | approved parent-facing only | parent tuition only if implemented; no platform provider | deny unless all camera policy gates pass | deny raw; approved summary only | deny |
| parent no child | allow | public-safe | deny | deny | deny | deny | deny | deny | participant/support only | own uploads only | deny | deny platform provider | deny | deny | deny |
| parent pending enrollment | allow | public-safe | own pending child/file | deny | own only | deny | deny | deny until active | request-related only | own uploads only | deny | deny platform provider | deny | deny | deny |
| parent approved child-kindergarten | allow | public-safe | own approved child | deny | own only | deny | deny | own child if policy | participant only | own child/uploaded only | approved summaries only | parent tuition only if implemented | conditional policy/token/attendance | approved reviewed summaries only | deny |
| staff unassigned | allow | public-safe job/opening data | deny | deny | deny | own application only | deny | deny | own application/support only | own staff docs only | deny | deny | deny | deny | deny |
| staff pending approval | allow | public-safe | deny | deny | deny | own staff record/application | deny | deny | own application/support only | own staff docs only | deny | deny | deny | deny | deny |
| staff approved for one kindergarten | allow | public-safe | conditional limited work scope | conditional own garden only if policy | deny private parent data unless explicit | own garden staff work context | deny | own garden allowed actions | relevant garden messages | own docs and permitted garden docs | deny unless explicitly assigned | deny provider/platform | deny unless explicit staff camera permission | deny raw unless explicit internal policy | deny |
| manager pending admin approval | allow | public-safe | deny active manager capabilities | deny | deny | deny | deny | deny | onboarding/admin messages only | onboarding docs only | deny | own pending subscription/request state only | deny | deny | deny |
| manager approved not active | allow | public-safe | deny or onboarding-only | deny | deny | onboarding staff setup only | deny | deny | onboarding/admin messages | onboarding docs | deny | own subscription state only | deny live viewing | deny raw | deny |
| manager active | allow | public-safe | own garden children | own garden only | own garden operational contacts | own garden staff | assigned inspector contact as needed | own garden | own garden | own garden | own garden reports if policy | own garden subscription only | own garden status; viewing token only if policy | own garden review queue if policy | deny platform logs |
| inspector pending approval | allow | public-safe | deny | deny | deny | deny | own application only | deny | admin/application only | own docs only | deny | deny | deny | deny | deny |
| inspector approved unassigned | allow | public-safe | deny | deny | deny | deny | own profile | deny | admin messages only | own docs only | deny | deny | deny | deny | deny |
| inspector assigned one kindergarten | allow | public-safe | conditional assigned garden only | assigned garden only if policy | limited compliance context only | assigned garden compliance scope | own inspector data | assigned garden compliance | relevant inspection messages | inspection evidence/docs by policy | assigned garden | deny payment/provider | assigned garden status/viewing only with purpose/policy | reviewed/authorized signals only | deny |
| admin | allow | allow | allow operationally | allow operationally | allow operationally | allow operationally | allow operationally | allow | allow | allow with care | allow | allow status without secrets | operational status without secrets | operational/review | allow |
| Digital Observer customer/admin | own product profile | public-safe | deny Gan Batuach children | deny | deny | deny | deny | deny | product messages only | product docs only | deny Gan Batuach | own Digital Observer billing only | own site cameras only | own site observer events only | deny platform logs |

## Notes

- Role-level permissions in `lib/roles.ts` are intentionally broad for UI capability routing and must not be treated as the final security boundary.
- Final enforcement must be proven by RLS, server-side object checks, and negative tests against the target Supabase project.


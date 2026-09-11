# Gan Batuach Staff Ratio Policy — External Review Required

No value listed here is verified as law or approved production policy. GB-M13 removes these values from operational decisions and deploys no active policy data.

| Legacy value | Source location | Previous use | Verification | Review needed |
|---|---|---|---|---|
| Infant maximum 15; ratio 1:6 | `lib/domain/kindergarten-onboarding.ts` before GB-M13 | Onboarding validation and staff estimate | Unverified legacy assumption | Identify jurisdiction, framework type, age definition, effective date, primary source, and legal/product approver. |
| Young toddler maximum 22; ratio 1:9 | Same | Same | Unverified legacy assumption | Same review, including whether thresholds are per room, program, or operating period. |
| Mature toddler maximum 27; ratio 1:11 | Same | Same | Unverified legacy assumption | Same review and age-boundary confirmation. |
| Kindergarten maximum 35; two staff at full class / ratio 17.5 | Same | Same | Unverified legacy assumption | Confirm whether this is a capacity rule, staffing rule, conditional rule, or obsolete product assumption. |
| `max_children_per_class` and `required_staff` | `kindergarten_age_group_setups` writes in `app/api/kindergarten-onboarding/route.ts` | Stored onboarding summary | Derived from the unverified constants | Treat existing rows as legacy only; do not import as approved policy. |
| “basic ratio” staffing alert | Same onboarding route | Manager warning | Unverified UI claim | Replaced with a neutral policy-pending message. |
| Maximum/rule copy on Garden join and onboarding screens | `app/join-kindergarten/page.tsx`, `components/kindergarten-onboarding-form.tsx` | User-facing claim | Unverified | Replaced with neutral wording. |

## Required review package

For each proposed policy version, reviewers must provide the source title and reference, jurisdiction and program scope, effective dates, canonical age/category mapping, calculation thresholds, qualifying-role and qualification definitions, multi-Classroom coverage rules, exception handling, and named approval evidence.

Scheduling coverage is not yet precise enough to count one employee fully in multiple simultaneous Classrooms. Until scheduling data closes that gap, the evaluator returns `staffing_data_incomplete` for shared assignments.

Production must remain `policy_not_configured` or `policy_unverified` until a reviewed dataset is entered, approved, and deliberately activated by Platform Admin.

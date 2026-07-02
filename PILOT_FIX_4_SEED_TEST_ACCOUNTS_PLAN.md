# PILOT FIX 4 – Seed/Test Accounts Plan

Date: 2026-07-03

Do not commit real passwords. Passwords must be passed outside code through environment variables or created manually in Supabase.

## Required Synthetic Accounts

| Account | Role | Purpose | Environment | Data scope | Access expected | Access forbidden | Create now? | Password handling |
|---|---|---|---|---|---|---|---|---|
| `demo_admin` | admin | platform validation | internal demo / staging synthetic | synthetic platform | demo admin surfaces | real pilot secrets/data | manual or seed | outside code |
| `demo_manager_a` | manager | Kindergarten A manager | synthetic QA | Kindergarten A | Garden A children/staff/requests | Garden B / provider secrets | manual or seed | outside code |
| `demo_manager_b` | manager | negative access test | synthetic QA | Kindergarten B | Garden B only | Garden A | manual or seed | outside code |
| `demo_parent_a` | parent | Parent A positive/negative tests | synthetic QA | Child A | own child/enrollment/messages | Child B/all garden children | manual or seed | outside code |
| `demo_parent_b` | parent | Parent B boundary test | synthetic QA | Child B | own child | Child A | manual or seed | outside code |
| `demo_staff_unassigned` | staff | unassigned boundary test | synthetic QA | own profile only | profile/applications | child/parent/garden internals | manual or seed | outside code |
| `demo_staff_assigned_a` | staff | assigned staff flow | synthetic QA | Kindergarten A | assigned work context | Kindergarten B/payment/provider | manual or seed | outside code |
| `demo_inspector_unassigned` | inspector | pending/unassigned test | synthetic QA | own profile only | own application/status | gardens/children/payments | manual or seed | outside code |
| `demo_inspector_assigned_a` | inspector | assigned inspection flow | synthetic QA | Kindergarten A | assigned garden inspections | Kindergarten B/payments/raw camera/AI | manual or seed | outside code |
| `demo_digital_observer_admin` | Digital Observer admin | product separation test | synthetic QA | DO site only | DO site/camera/readiness | Gan Batuach children/gardens | manual if needed | outside code |

## Existing Script Review

`scripts/seed-test-users.mjs` creates five generic users only:

- admin
- inspector
- manager
- parent
- staff

It does not create A/B separation accounts and does not create linked children/gardens. It is not enough for PILOT FIX 5 access-boundary validation.

`scripts/seed-demo-full.mjs` creates larger demo data with `is_demo` and `demo_batch_id`, but it resets demo data and includes broad demo UX content. It must not be run against pilot/production without explicit approval.

## Recommendation

For PILOT FIX 5, create accounts manually or create a new non-destructive synthetic access-test seed script after confirming the target Supabase project is staging/demo only.


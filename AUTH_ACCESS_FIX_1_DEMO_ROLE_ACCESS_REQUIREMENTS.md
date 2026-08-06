# AUTH ACCESS FIX 1 - Demo Role Access Requirements

Date: 2026-08-06  
Scope: authenticated UX/UI QA preparation only. No real pilot activation.

## Required Role Sessions

| Role session | Purpose | Expected dashboard route | Required synthetic data | Forbidden data | Account state | Existing account known | Manual creation required |
|---|---|---|---|---|---|---:|---:|
| demo_parent | Parent dashboard, child card, messages, payments, camera readiness | `/dashboard/parent/family-home` and `/dashboard/parent` | Parent linked to Child A and Kindergarten A; messages/payment/camera readiness | Real parent/child data; raw AI; live camera | active parent with completed onboarding | yes | no, if seed/demo account exists in target env |
| demo_manager | Manager dashboard and garden operations | `/dashboard/garden` or `/dashboard/garden/command-center` | Kindergarten A, children, staff, enrollment requests, readiness states | Other kindergarten data; live providers | approved manager assigned to Kindergarten A | yes | no, if seeded in target env |
| demo_staff_unassigned | Staff empty/unassigned state | `/dashboard/staff` | Staff profile without approved garden assignment | Child/parent data | unassigned/pending staff | unknown | yes if not present |
| demo_staff_assigned | Staff assigned dashboard/actions | `/dashboard/staff` | Staff assigned to Kindergarten A, shifts/tasks/messages | Kindergarten B data; provider records | approved/assigned staff | yes | no, if seeded in target env |
| demo_inspector_unassigned | Inspector pending/unassigned state | `/dashboard/inspector/apply` or `/dashboard/inspector` | Inspector profile without garden assignment | Garden/child evidence | pending/unassigned inspector | unknown | yes if not present |
| demo_inspector_assigned | Inspector assigned dashboard and inspection form | `/dashboard/inspector` or `/dashboard/inspector/control-center` | Inspector assigned to Kindergarten A; inspection readiness | Kindergarten B data; raw credentials | approved/assigned inspector | yes | no, if seeded in target env |
| demo_admin | Admin/provider/pilot readiness QA | `/dashboard/admin` | Admin profile, provider modes, pilot readiness samples | Secrets in UI | active admin | yes | no, if seeded in target env |
| demo_digital_observer_admin | Digital Observer dashboard QA if in scope | `/digital-observer/dashboard` | Demo site, cameras/readiness, billing/readiness | Gan Batuach child data | scoped Digital Observer user/admin | unknown | yes if Digital Observer is in QA 2 scope |

## Required Feature Defaults

- Live payments disabled.
- Parent camera viewing disabled.
- Live AI disabled.
- Production SMS/WhatsApp disabled.
- Demo/synthetic markers visible.


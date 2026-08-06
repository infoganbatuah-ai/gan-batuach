# AUTHED UX QA 1 - Demo User Availability Audit

Date: 2026-08-06  
Branch: main  
Latest checked commit: ed5f785 UX/UI QA 3 – Real Product Visual, Functional & Responsive Acceptance

## Summary

Demo/synthetic users are defined in the repository, but the QA run could only validate one active authenticated browser session: Parent. Other roles were not accepted because a safe session switch/logout path was not available during the automated browser run.

Do not print or commit real passwords. Demo passwords exist in seed scripts and should be treated as operational test credentials, not public documentation.

## Demo User Sources Found

- `scripts/seed-test-users.mjs`: env-password based test users for admin, inspector, manager, parent, staff.
- `scripts/seed-demo-full.mjs`: full synthetic demo data and demo-domain users.
- `app/dashboard/admin/qa-checklist/page.tsx`: checks demo users under `demo.ganbatuach.com`.

## Required Users

| User | Status | Role | Login method | Expected route | Can be used in QA | Blocker |
|---|---:|---|---|---|---:|---|
| demo_parent | exists | parent | demo seed / active browser session | `/dashboard/parent` | yes | none for parent screenshot QA |
| demo_manager | exists | manager | demo seed | `/dashboard/manager` | not yet | no safe session switch completed |
| demo_staff_unassigned | unknown | staff | seed/user setup needed | staff dashboard/unassigned state | no | specific unassigned account not verified |
| demo_staff_assigned | exists/planned | staff | demo seed | staff dashboard | not yet | no safe session switch completed |
| demo_inspector_unassigned | unknown | inspector | seed/user setup needed | inspector pending/unassigned state | no | specific unassigned account not verified |
| demo_inspector_assigned | exists/planned | inspector | demo seed | inspector dashboard | not yet | no safe session switch completed |
| demo_admin | exists | admin | demo seed | `/dashboard/admin` | not yet | no safe session switch completed |
| demo_digital_observer_admin | unknown | digital_observer/admin | not clearly identified | Digital Observer dashboard | no | account not confirmed |

## Safety Notes

- Seed scripts may create/update users in Supabase and some demo scripts reset demo data. They were not run during this QA.
- Real users were not used.
- Real passwords are not included in this report.
- Multi-role QA requires either Daniel-provided demo credentials for each role with a reliable logout/session reset path, or separate prepared browser sessions.


# AUTHED UX/UI QA 2 - Demo Account / Login Readiness

Date: 2026-08-06

## Summary

Demo credentials are discoverable for assigned Parent, Manager, Staff, Inspector and Admin accounts from the existing demo seed source. Passwords were not printed or copied into this report.

Full all-role QA is still blocked because unassigned Staff, unassigned Inspector and Digital Observer authenticated accounts are not confirmed, and session switching could not be completed for every role in the browser run.

| Role | Account exists | Login possible | Login method | Dashboard route | Synthetic data | Approval / assignment | Can run QA | Blocker |
|---|---|---|---|---|---|---|---|---|
| demo_parent | yes | yes | normal login form | `/dashboard/parent` | yes | active parent | yes | none for parent dashboard |
| demo_manager | yes | not proven in this run | normal login form required | `/dashboard/garden` | yes | assigned manager | no | session switching was not proven after parent login |
| demo_staff_unassigned | unknown | no | manual account required | `/dashboard/staff` | unknown | unassigned | no | BLOCKED_MISSING_DEMO_LOGIN |
| demo_staff_assigned | yes | not proven in this run | normal login form required | `/dashboard/staff` | yes | assigned staff | no | session switching was not proven after parent login |
| demo_inspector_unassigned | unknown | no | manual account required | `/dashboard/inspector` or `/dashboard/inspector/apply` | unknown | unassigned | no | BLOCKED_MISSING_DEMO_LOGIN |
| demo_inspector_assigned | yes | not proven in this run | normal login form required | `/dashboard/inspector` | yes | assigned inspector | no | session switching was not proven after parent login |
| demo_admin | yes | not proven in this run | normal login form required | `/dashboard/admin` | yes | active admin | no | session switching was not proven after parent login |
| demo_digital_observer_admin | unknown | no | manual account required | `/digital-observer/dashboard` | unknown | scoped DO user/admin | no | BLOCKED_MISSING_DEMO_LOGIN |

## Decision

Only the Parent role is accepted as actually logged-in during this QA run.

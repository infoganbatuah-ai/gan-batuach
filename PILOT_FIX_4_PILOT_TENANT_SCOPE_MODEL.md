# PILOT FIX 4 – Pilot Tenant / Kindergarten Scope Model

Date: 2026-07-03

## First Pilot Scope

The first real pilot should support **one controlled kindergarten** only.

## Recommended Scope Object

| Field | Purpose |
|---|---|
| `pilot_id` | identifies the pilot program |
| `kindergarten_id` / `garden_id` | primary tenant boundary |
| `environment_scope` | `pilot_staging`, not demo and not production |
| `participating_roles` | admin, manager, limited staff, inspector; parents only after signoff |
| `allowed_modules` | registration, manager dashboard, staff assignment, inspector flow, in-app notices |
| `disabled_modules` | parent camera view, raw AI, live payments, mass onboarding |
| `feature_flags` | pilot access gates |
| `data_retention_profile` | pilot-specific retention and deletion rules |
| `support_owner` | internal owner for issues |
| `incident_owner` | privacy/security escalation owner |
| `rollback_owner` | person authorized to suspend pilot |

## Safe Starting Configuration

- One real kindergarten manager.
- One admin.
- One or two staff users.
- One inspector/test inspector.
- Parents disabled until RLS/legal signoff.
- Parent camera viewing disabled.
- AI shadow only if enabled at all.
- Payments manual/sandbox only.
- Digital Observer separated from Gan Batuach pilot data.

## Not In Scope

- mass onboarding
- public parent registration
- public store launch
- live parent camera viewing
- automatic AI alerts
- live payment automation
- production launch


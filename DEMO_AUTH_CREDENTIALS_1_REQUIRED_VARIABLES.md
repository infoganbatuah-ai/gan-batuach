# DEMO AUTH CREDENTIALS 1 - Required Variables

Value printing rule: never print credential values.

Local file status: `.env.qa-demo.local` exists. Values were checked by presence only; no values were printed.

| Variable | Required for AUTHED UX/UI QA 3 | Exists in `.env.qa-demo.example` | Exists in local env/file by name | Value printed |
|---|---|---|---|---|
| `QA_DEMO_USER_SETUP_CONFIRM` | yes, if running setup script | yes | yes | never |
| `QA_DEMO_ENVIRONMENT` | yes, if running setup script | yes | yes | never |
| `NEXT_PUBLIC_SUPABASE_URL` | yes, if running setup script | yes | no | never |
| `SUPABASE_SERVICE_ROLE_KEY` | yes, if running setup script | yes | no | never |
| `QA_DEMO_PARENT_ASSIGNED_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_PARENT_ASSIGNED_PASSWORD` | optional if `QA_DEMO_PARENT_PASSWORD` exists | yes | no | never |
| `QA_DEMO_PARENT_EMAIL` | backwards-compatible optional override | yes | no | never |
| `QA_DEMO_PARENT_PASSWORD` | yes for assigned parent fallback | yes | yes | never |
| `QA_DEMO_PARENT_UNASSIGNED_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_PARENT_UNASSIGNED_PASSWORD` | yes for unassigned parent QA | yes | no | never |
| `QA_DEMO_MANAGER_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_MANAGER_PASSWORD` | yes | yes | yes | never |
| `QA_DEMO_STAFF_ASSIGNED_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_STAFF_ASSIGNED_PASSWORD` | yes | yes | yes | never |
| `QA_DEMO_STAFF_UNASSIGNED_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_STAFF_UNASSIGNED_PASSWORD` | yes | yes | no | never |
| `QA_DEMO_INSPECTOR_ASSIGNED_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_INSPECTOR_ASSIGNED_PASSWORD` | yes | yes | yes | never |
| `QA_DEMO_INSPECTOR_UNASSIGNED_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_INSPECTOR_UNASSIGNED_PASSWORD` | yes | yes | no | never |
| `QA_DEMO_ADMIN_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_ADMIN_PASSWORD` | yes | yes | yes | never |
| `QA_DEMO_DIGITAL_OBSERVER_EMAIL` | optional override | yes | no | never |
| `QA_DEMO_DIGITAL_OBSERVER_PASSWORD` | yes, if Digital Observer in QA scope | yes | no | never |

## Result

PARTIAL_CREDENTIALS_PRESENT_MISSING_UNASSIGNED_AND_DIGITAL_OBSERVER

# DEMO AUTH SETUP 1 - Existing Demo User Discovery

Sources checked: `scripts/seed-demo-full.mjs`, `scripts/seed-test-users.mjs`, prior AUTH ACCESS reports, manual login docs, `.env.example`, auth helpers and route maps.

Passwords are intentionally not printed.

| Account/email | Role | Source file | Password known | Safe for QA | Synthetic data linked | Approval/assignment state | Dashboard route | Can be used in next QA |
|---|---|---|---|---|---|---|---|---|
| `parent.1@demo.ganbatuach.com` | parent | `scripts/seed-demo-full.mjs` | yes, not printed | yes in demo env | yes | active parent linked to demo child | `/dashboard/parent` | yes |
| `manager.rakefet@demo.ganbatuach.com` | manager | `scripts/seed-demo-full.mjs` | yes, not printed | yes in demo env | yes | assigned to Rakefet | `/dashboard/garden` | yes, if credential supplied locally |
| `staff.1@demo.ganbatuach.com` | staff | `scripts/seed-demo-full.mjs` | yes, not printed | yes in demo env | yes | assigned to Rakefet | `/dashboard/staff` | yes, if credential supplied locally |
| `inspector.yael@demo.ganbatuach.com` | inspector | `scripts/seed-demo-full.mjs` | yes, not printed | yes in demo env | yes | assigned to Rakefet/Oranim | `/dashboard/inspector` | yes, if credential supplied locally |
| `admin-demo@demo.ganbatuach.com` | admin | `scripts/seed-demo-full.mjs` | yes, not printed | yes in demo env | yes | active admin | `/dashboard/admin` | yes, if credential supplied locally |
| `qa.staff.unassigned@demo.ganbatuach.com` | staff | `scripts/qa/create-demo-role-users.mjs` | no, local env required | yes after setup | profile only | unassigned | `/dashboard/staff` | after Daniel/local setup |
| `qa.inspector.unassigned@demo.ganbatuach.com` | inspector | `scripts/qa/create-demo-role-users.mjs` | no, local env required | yes after setup | profile only | unassigned/pending | `/dashboard/inspector/apply` | after Daniel/local setup |
| `qa.digital.observer@demo.ganbatuach.com` | network_manager / observer owner | `scripts/qa/create-demo-role-users.mjs` | no, local env required | yes after setup | synthetic observer site | observer site owner | `/digital-observer/dashboard` | after Daniel/local setup |
| `admin@ganbatuach.com`, `manager@ganbatuach.com`, `parent@ganbatuach.com`, `staff@ganbatuach.com`, `inspector@ganbatuach.com` | mixed | `scripts/seed-test-users.mjs` | env-only | test env only | limited profile only | not full visual QA data | role dashboard | not enough for full dashboard acceptance |

Finding: the full demo seed covers assigned core Gan Batuach roles, but it does not provide unassigned staff, unassigned inspector or Digital Observer QA accounts. A safe env-based setup script was added for those gaps.

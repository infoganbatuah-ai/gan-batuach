# AUTH ACCESS FIX 1 - Demo User Inventory

## Sources Checked

- `scripts/seed-test-users.mjs`
- `scripts/seed-demo-full.mjs`
- `package.json`
- `app/dashboard/admin/qa-checklist/page.tsx`
- AUTHED UX QA 1 reports

## Discovered Demo/Test Users

Passwords are intentionally not printed here. Use the seed script/source of truth or a secure local handoff.

| User/email placeholder | Role | Source file | Password status | Safe for QA | Synthetic data link | Approval/assignment state |
|---|---|---|---|---:|---|---|
| `admin@ganbatuach.com` | admin | `scripts/seed-test-users.mjs` | env var required | yes if created in demo/staging | test profile | active admin |
| `inspector@ganbatuach.com` | inspector | `scripts/seed-test-users.mjs` | env var required | yes if created in demo/staging | test profile | depends on setup |
| `manager@ganbatuach.com` | manager | `scripts/seed-test-users.mjs` | env var required | yes if created in demo/staging | test profile | depends on setup |
| `parent@ganbatuach.com` | parent | `scripts/seed-test-users.mjs` | env var required | yes if created in demo/staging | test profile | depends on setup |
| `staff@ganbatuach.com` | staff | `scripts/seed-test-users.mjs` | env var required | yes if created in demo/staging | test profile | depends on setup |
| `admin-demo@demo.ganbatuach.com` | admin | `scripts/seed-demo-full.mjs` | known in script, not printed | yes in demo env | full demo batch | active admin |
| `manager.rakefet@demo.ganbatuach.com` | manager | `scripts/seed-demo-full.mjs` | known in script, not printed | yes in demo env | Kindergarten A / Rakefet | assigned manager |
| `staff.1@demo.ganbatuach.com` | staff | `scripts/seed-demo-full.mjs` | known in script, not printed | yes in demo env | Kindergarten A / Rakefet | assigned staff |
| `inspector.yael@demo.ganbatuach.com` | inspector | `scripts/seed-demo-full.mjs` | known in script, not printed | yes in demo env | Rakefet/Oranim | assigned inspector |
| `parent.1@demo.ganbatuach.com` | parent | `scripts/seed-demo-full.mjs` | known in script, not printed | yes in demo env | Rakefet children | active parent |

## Missing/Unconfirmed

- Dedicated unassigned staff demo account was not clearly identified.
- Dedicated unassigned inspector demo account was not clearly identified.
- Digital Observer authenticated demo admin/user was not clearly identified.

## Safety Finding

`seed:demo-full` can reset demo data when run with reset mode and uses Supabase admin capabilities. It should not be run casually during UX QA.


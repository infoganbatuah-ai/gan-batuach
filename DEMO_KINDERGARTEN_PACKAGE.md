# Demo Kindergarten Package

The project already includes a full demo seed script:

```bash
npm run seed:demo-full
```

This script is intended for sandbox/demo environments only.

## What The Demo Package Includes

Accounts:

- Admin demo account
- Inspector demo accounts
- Manager demo accounts
- Owner demo accounts
- Staff demo accounts
- Parent demo accounts

Kindergartens:

- Multiple demo kindergartens
- City/address/contact details
- Manager/owner assignments
- Inspector assignments
- Public profile fields
- Logo/image placeholders
- Inspection status and safety status

Children and parents:

- Parent records
- Children records
- Parent-child links
- Health/allergy notes
- Child photos/placeholders
- Parent dashboards with meaningful content

Staff:

- Staff accounts
- Staff links to kindergartens
- Staff dashboard data
- Certificates/documents where supported by the seed

Inspections and violations:

- Inspection form
- Inspection questions
- Completed/pending inspection examples
- Violation examples
- Unsafe/requires-fix examples

Cameras:

- Camera records
- Parent-viewing examples
- Gateway/sample states depending on seeded values

Notifications/messages/tasks:

- Parent messages and requests
- Manager notifications
- Staff tasks/notifications
- Inspector/admin operational examples

Finance/documents:

- Child payment statuses
- Fee examples
- Missing/pending/approved document examples where supported by the seed

## Safe Use

Use only with a demo Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
npm run seed:demo-full
```

Optional:

```bash
DEMO_BATCH_ID=pilot-demo-001 npm run seed:demo-full
```

The seed marks rows with:

- `is_demo = true`
- `demo_batch_id`

Do not run this against the first real customer production project unless the customer explicitly wants demo rows in the same environment.

## Demo Dashboard Coverage

Admin:

- users
- kindergartens
- inspectors
- reports
- audits
- cameras
- violations

Manager / owner:

- command center
- leads/parents/children
- finance
- cameras
- messages
- documents
- inspections
- insights

Staff:

- daily work dashboard
- child updates
- tasks
- incidents
- documents

Parent:

- child dashboard
- requests/messages
- documents
- cameras
- notifications

Inspector:

- assigned kindergartens
- inspections
- violations
- cameras if permitted

## Before A Sales Demo

- Run `npm run typecheck`.
- Run `npm run build`.
- Run the seed in a sandbox.
- Log in as every demo role.
- Verify every dashboard has useful data.
- Verify no demo credentials are used in production.

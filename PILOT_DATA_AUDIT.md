# Pilot Data Audit

Use this before the first real kindergarten pilot. The goal is to verify that every role has real data and that every dashboard opens with meaningful content.

## Required Pilot Accounts

Admin:

- Account exists in Supabase Auth.
- Matching `profiles` row exists.
- `profiles.role = admin`.
- Admin can open `/dashboard/admin`.
- Admin can manage users, kindergartens, inspectors, reports and audits.

Kindergarten manager / owner:

- Manager account exists.
- Owner account exists if the pilot kindergarten has a separate owner.
- Manager profile has name, phone, email, identity number and profile photo.
- Manager is linked to the pilot kindergarten.
- Manager can open `/dashboard/garden`.
- Manager can approve leads, children, staff, payments, cameras and requests.

Staff:

- At least one staff account exists.
- Staff profile has name, phone, role, identity number and profile photo.
- Staff is linked to the pilot kindergarten.
- Staff can open `/dashboard/staff`.
- Staff can update child journal, tasks, incidents and documents.

Inspector:

- Inspector account exists.
- Inspector has assigned kindergarten or assigned area.
- Inspector profile has name, phone, identity number and profile photo.
- Inspector can open `/dashboard/inspector`.
- Inspector can see assigned kindergarten, inspections and violations.

Parent:

- At least one parent account exists.
- Parent is linked to the pilot kindergarten.
- Parent has at least one child record or pending child completion task.
- Parent can open `/dashboard/parent`.
- Parent can see child, requests, documents, payments and cameras if enabled.

## Required Pilot Data

Kindergarten:

- Name
- Address
- Phone
- Logo/image
- Manager/owner link
- Age groups
- Monthly fees
- Public profile enabled or intentionally disabled
- Storage upload flows verified

Children:

- At least one active child.
- At least one pending child approval for manager testing.
- Child photo exists.
- Parent photo exists.
- Pickup permissions exist.
- Allergies/health notes include at least one realistic case.

Requests/messages:

- One open parent request.
- One handled parent request.
- One routed request to staff or manager.

Finance:

- One paid child.
- One overdue/unpaid child.
- One failed or not transferred payment.
- Fee groups configured.

Documents:

- One missing/requested document.
- One uploaded document pending review.
- One approved document.

Cameras:

- One connected or sample camera if camera testing is included.
- One pending source camera.
- Parent viewing enabled for at least one camera.

Inspections:

- One upcoming inspection.
- One completed inspection/report.
- One open violation if inspector/admin flows are part of pilot.

Notifications:

- One unread parent notification.
- One unread manager notification.
- One staff task/notification.
- One inspector notification if applicable.

## Verification Checklist

- Public kindergarten page shows pilot kindergarten.
- Parent registration creates lead for the correct kindergarten.
- Manager sees the lead.
- Manager approval creates parent credentials.
- Parent first login reaches child completion task.
- Parent completes child profile.
- Manager approves child.
- Child appears in active children list.
- Parent sees active child.
- Staff sees assigned children.
- Inspector sees assigned kindergarten.
- Admin sees all pilot data.

## Demo Data Notes

The repository includes `scripts/seed-demo-full.mjs`, which creates a rich demo environment with:

- admin
- inspectors
- managers/owners
- staff
- parents
- kindergartens
- children
- cameras
- inspections
- violations
- messages
- notifications

Use demo data only in a sandbox or demo Supabase project. Do not run demo seeding against a real customer production project unless the pilot owner explicitly wants demo rows and understands they are marked with `is_demo` / `demo_batch_id`.

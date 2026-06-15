# Self-Service User Registration, Affiliation Requests & Role-Based Access Completion

## Scope

Phase 190A adds self-service entry for users who were not invited directly:

- Parents
- Staff candidates
- Inspector candidates
- Kindergarten managers through the existing commercial/onboarding path

Existing invitation flows remain supported and were not removed.

## Security Principle

Self-registration does not grant sensitive access.

New self-service accounts are created with `profiles.active = false`, `garden_id = null`, and a self-service status such as `pending_affiliation`. This prevents existing RLS helpers such as `current_role()` and `can_access_garden()` from granting garden access before approval.

Access opens only after:

- Parent: manager approval and activation/payment completion or manager override.
- Staff candidate: manager approval and staff activation.
- Inspector candidate: admin approval and explicit inspector setup/assignment.

## Parent Flow

Parent self-registration:

1. User registers at `/register`.
2. User logs in and lands at `/dashboard/parent`.
3. Parent creates a parent-owned child profile.
4. Parent opens `/dashboard/parent/discover-kindergartens`.
5. Parent sees only public-safe kindergarten data.
6. Parent submits `kindergarten_enrollment_requests`.
7. Manager reviews at `/dashboard/garden/enrollment-requests`.
8. Manager can request more information, reject, approve pending payment, waive payment, or mark payment paid.
9. Only activation creates:
   - Parent record for that kindergarten
   - Child record under that kindergarten
   - `parent_kindergarten_links` active link
   - Active profile/garden access

Payment activation remains readiness-level. Parent tuition is separate from Gan Batuach subscription revenue.

## Staff Candidate Flow

Staff self-registration:

1. User registers at `/register` as staff candidate.
2. User lands at `/dashboard/staff`.
3. If no approved staff record exists, the dashboard shows a limited candidate view.
4. Candidate opens `/dashboard/staff/job-market`.
5. Candidate sees only public-safe staff openings.
6. Candidate submits `staff_job_applications`.
7. Manager reviews at `/dashboard/garden/staff-applications`.
8. Manager approval creates the staff record, assigns the profile to the garden, and activates access.

Before approval, the candidate cannot access children, parents, documents, cameras, staff lists, or internal kindergarten reports.

## Inspector Candidate Flow

Inspector self-registration:

1. User registers at `/register` as inspector candidate.
2. User lands at `/dashboard/inspector/apply`.
3. Candidate submits `inspector_applications`.
4. Admin reviews at `/dashboard/admin/inspector-applications`.
5. Admin approval creates/updates the inspector record and can assign gardens.
6. Only then does inspector access open.

Before approval and assignment, the candidate sees no kindergarten data.

## Data Models Added

Migration:

`supabase/migrations/20260612019200_self_service_registration_affiliations.sql`

Tables:

- `self_service_user_profiles`
- `kindergarten_enrollment_requests`
- `kindergarten_staff_openings`
- `staff_candidate_profiles`
- `staff_job_applications`
- `inspector_applications`
- `user_affiliation_requests`

Existing table alignment:

- `permanent_child_files` now supports parent-owned self-service child profiles.
- `profiles` now tracks self-service status and approval metadata.

## RLS / Access Assumptions

Added RLS is intentionally narrow:

- Users can read/write their own self-service profile/application records.
- Managers can read/update requests only for their own garden through `can_access_garden(garden_id)`.
- Admin can review inspector and platform-wide records.
- Public staff openings are readable when published.
- Parent discovery of kindergartens is served through server-side safe-field selection only.

No broad RLS weakening was added.

## Sensitive Data Boundaries

Not exposed to unassigned users:

- Kindergarten children
- Parent lists
- Staff lists
- Internal documents
- Cameras
- Internal inspections
- Medical records
- Private reports
- Raw AI events

Parent-owned child profiles remain parent-owned until submitted to a specific kindergarten.

## QA Checklist

Parent:

- Register as parent.
- Login routes to `/dashboard/parent`.
- Create child profile.
- Discover public kindergartens.
- Submit enrollment request.
- Manager sees request only for own garden.
- Manager approves pending payment.
- Parent remains limited until payment/activation.
- Manager marks payment paid or waives payment.
- Child and parent access become active.

Staff:

- Register as staff candidate.
- Login routes to limited `/dashboard/staff`.
- Open job market.
- Submit application.
- Manager sees application only for own garden.
- Manager approves.
- Staff record is created and dashboard access opens.

Inspector:

- Register as inspector candidate.
- Login routes to `/dashboard/inspector/apply`.
- Submit application.
- Admin sees application.
- Admin approves and optionally assigns gardens.
- Inspector dashboard opens only after approval.

Permission checks:

- Unassigned parent cannot access kindergarten data.
- Unassigned staff cannot access child data.
- Unapproved inspector cannot access gardens.
- Rejected users remain blocked from sensitive data.
- Manager sees only own kindergarten requests.
- Parent sees only own child profiles and own requests.

## Manual Review Items

- Payment provider integration for real parent tuition collection still requires legal/provider review.
- Document uploads for staff/inspector sensitive files should be connected to the private storage/audit model before production use.
- Duplicate detection is flag-only and does not merge records automatically.
- Email/phone verification remains provider-mode dependent.

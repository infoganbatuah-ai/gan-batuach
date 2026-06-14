# Master QA, End-to-End Validation & Bug Stabilization

Phase 161 creates the internal QA control layer for Gan Batuach. It is focused on validation, bug discovery, stabilization and product readiness. It does not claim that all flows are production-ready.

## QA Command Center

Admin route:

```text
/dashboard/admin/master-qa
```

The dashboard shows:

- QA readiness score
- Passed, failed, blocked and needs-review tests
- Critical launch blockers
- High-priority bugs
- Role coverage
- Workflow coverage
- Regression bug register
- Readiness recommendation

## Database Model

Migration:

```text
supabase/migrations/20260612016100_master_qa_end_to_end_validation_bug_stabilization.sql
```

Tables:

- `qa_test_cases`
- `qa_bug_reports`
- `qa_workflow_runs`

All three tables use admin-only RLS policies.

## QA Matrix

The initial matrix includes coverage for:

- Admin
- Manager / kindergarten owner
- Parent
- Staff
- Inspector
- Public website
- Security and permissions
- Mobile
- Payments
- Cameras
- Digital Observer
- Inspections
- Onboarding

Statuses:

- `not_tested`
- `passed`
- `failed`
- `blocked`
- `needs_review`

Severity:

- `critical`
- `high`
- `medium`
- `low`

## Role QA Scope

### Admin

Covered areas:

- Login and dashboard
- Users and kindergartens
- Leads and growth
- Billing and subscriptions
- Compliance and inspections
- Camera admin
- AI / observer
- Security and audit logs
- Launch readiness
- ISO readiness
- Capability legal matrix

Current status: needs review / blocked by repository verification failures.

### Manager / Owner

Covered areas:

- First login
- Onboarding and activation
- Child setup
- Parent invitations
- Staff invitations
- Documents
- Payments
- Cameras
- Compliance
- Tasks
- Messages
- Daily operations
- Command center

Current status: blocked until full activation, payment and seeded browser QA are completed.

### Parent

Covered areas:

- Invitation
- First login
- Password change
- Child registration completion
- Profile
- Child timeline
- Messages
- Documents
- Payments
- Pickup contacts
- Camera viewing when allowed
- Notifications
- Privacy boundaries

Must verify parent cannot access:

- Other children
- Other gardens
- Raw AI events
- Internal investigations
- Staff-only notes

Current status: blocked until seeded negative access tests are completed.

### Staff

Covered areas:

- Invitation
- First login
- Profile completion
- Document upload
- GPS attendance readiness
- Daily tasks
- Child updates
- Incident report
- Communication
- Emergency actions
- Permissions

Current status: needs mobile/GPS QA.

### Inspector

Covered areas:

- Login
- Assigned kindergartens
- Monthly inspection cycles
- Inspection reminders
- GPS validation
- Inspection forms
- Photos and evidence
- Signature
- PDF report
- Complaint handling
- Observer feed
- Compliance issues
- Follow-up inspections

Current status: blocked until inspection lifecycle and PDF report are verified end to end.

## Public Website QA

Covered areas:

- Homepage CTAs
- Book demo
- Join kindergarten
- Parent demand page
- Parent demand form
- Kindergarten registration form
- Lead creation
- Lead source tracking
- Mobile responsiveness
- Hebrew copy

Current status: needs live form and lead creation QA.

## Payment QA

Gan Batuach annual kindergarten subscription must validate:

- Plan calculation
- Base price
- Extra class price
- Discount code
- Invoice
- Renewal warning
- Failed payment grace period
- Suspension

Parent-to-kindergarten payments must validate:

- Age group pricing
- Monthly / annual billing cycle
- Parent approval
- Payment history
- Invoice / receipt view
- Kindergarten payout configuration

Critical rule:

- No raw card data may be stored.

Current status: payment provider sandbox QA is still required.

## Camera QA

Must validate:

- Camera setup
- DVR/NVR flow
- RTSP flow
- ONVIF readiness
- Gateway readiness
- Parent visibility rules
- Viewing hours
- Camera token creation
- Audit logs
- No RTSP exposed
- No credentials exposed
- Parent blocked when child is not checked in

Current status: policy guard exists, but real gateway/device QA is still required.

## Digital Observer QA

Must validate:

- AI events
- Skeleton/motion readiness
- Observer signals
- Human review flow
- Manager digest
- Inspector feed
- Admin observer network
- Parent raw visibility blocked
- `legal_review_required` capabilities blocked

Current status: raw parent visibility and legal-review capability blocks need seeded negative tests.

## Compliance And Inspection QA

Must validate:

- Compliance score
- Document expiry
- Staff certificates
- Corrective actions
- Alerts
- Manager, inspector and admin views
- Monthly inspection cycles
- Required inspections
- Inspection answers
- Findings
- GPS validation
- Signature
- PDF report with all questions and answers

Current status: inspection report generation and field workflow need live QA.

## Security And Permissions QA

Critical areas:

- Route protection
- RLS assumptions
- Role boundaries
- Parent access isolation
- Staff access isolation
- Manager garden scope
- Inspector assignment scope
- Admin access
- Sensitive file access
- Audit logs

Critical launch blockers include:

- Parent can access another child
- Raw AI visible to parent
- Camera credentials exposed
- RTSP exposed
- Payment stores raw card data
- Medical data exposed
- Admin route open to non-admin
- Build fails
- Migration fails
- Login broken
- Onboarding broken
- Payment activation broken

## UX / UI QA

Still required:

- Clutter review
- Technical wording cleanup
- Mixed Hebrew/English cleanup
- Broken spacing
- Oversized cards
- Empty states
- Mobile usability
- Confusing actions
- Scrolling problems

## Mobile QA

Required viewports:

- 360px
- 390px
- 414px
- Tablet
- Desktop

Roles:

- Parent
- Staff
- Manager
- Inspector
- Admin

Current status: not completed in this environment.

## Bugs Found

Seeded critical/high QA bugs:

- Typecheck fails.
- Build fails because local `@next/env` module is missing.
- Parent isolation negative tests are not completed.
- Real camera gateway and parent token flow are not verified.
- Payment provider sandbox is not verified.
- Inspection PDF report is not verified end to end.
- Mobile device QA is not completed.

## Fixes Completed In This Phase

- Added a single Master QA command center.
- Added persistent QA test matrix.
- Added regression bug register.
- Added workflow readiness tracking.
- Registered Master QA in admin navigation and route safety checks.
- Documented the honest readiness state instead of marking untested flows as passed.

## Current Recommendation

Recommendation: `not ready`

Reason:

- Typecheck fails.
- Build fails locally due missing Next dependency.
- Critical seeded QA for parent isolation, onboarding, payment activation, camera access and inspection reports remains incomplete.

Next readiness target:

`QA in progress` after typecheck/build are fixed and seeded browser QA begins.

Pilot readiness target:

`pilot ready after fixes` only after critical blockers are verified fixed and negative permission tests pass.

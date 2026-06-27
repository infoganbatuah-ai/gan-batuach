# MOBILE 2 - Reviewer Notes Draft

Date: 2026-06-27

## Reviewer Access

The app is role-based and requires reviewer test accounts. Do not include real passwords in the repository.

Placeholders:

- reviewer_admin_email / reviewer_admin_password
- reviewer_manager_email / reviewer_manager_password
- reviewer_parent_email / reviewer_parent_password
- reviewer_staff_email / reviewer_staff_password
- reviewer_inspector_email / reviewer_inspector_password
- reviewer_observer_email / reviewer_observer_password

## Role Walkthrough

Admin:

- review platform dashboard
- kindergarten approvals
- users
- provider readiness
- monitoring/alerts

Kindergarten Manager:

- garden dashboard
- children/enrollment requests
- staff
- documents
- subscription/payment readiness

Parent:

- child card
- enrollment/request status
- messages/notifications
- payments/readiness
- camera availability state

Staff:

- assignment status
- attendance/shifts/tasks
- documents/messages

Inspector:

- application/pending state or approved dashboard
- assigned gardens
- inspections/reports

Digital Observer:

- separate public/product area
- readiness/shadow/status screens only unless provider/camera setup is complete

## Feature Notes

- Payments may be sandbox/readiness unless live provider credentials are configured.
- Camera is not to be treated as live parent viewing unless separately configured and validated.
- AI Observer is shadow/readiness/internal review unless real inference was validated.
- Child data in reviewer flows must be synthetic/demo data.

Status:

reviewer_notes_status = draft_requires_test_accounts

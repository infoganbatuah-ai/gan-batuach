# UX/UI QA 3 - Tables Forms Modals Acceptance

Date: 2026-08-06

## Forms Checked

- login form
- register role-selection page

## Browser Findings

- No horizontal overflow on captured auth forms.
- Login/register are visible on mobile/tablet/desktop.
- Small inline link/control metrics were flagged and a small CSS touch/readability fix was applied.

## Not Fully Checked

- add child
- manager onboarding
- staff application
- inspector application
- inspection form
- message compose
- document upload
- payment readiness
- admin drawers/modals
- dense tables/lists

Reason: authenticated routes redirected to login.

Decision: **PARTIAL_AUTH_FORMS_PASS_DASHBOARD_FORMS_MANUAL_REQUIRED**


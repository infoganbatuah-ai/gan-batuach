# MOBILE 2 - Reviewer Test Accounts Plan

Date: 2026-06-27

Do not seed or create production accounts without explicit approval.

## Required Accounts

Admin:

- email: `reviewer_admin_email`
- password: `reviewer_admin_password`
- dataset: platform overview, synthetic garden, provider readiness

Kindergarten Manager:

- email: `reviewer_manager_email`
- password: `reviewer_manager_password`
- dataset: synthetic kindergarten, children, staff, enrollment requests, documents, subscription readiness

Parent:

- email: `reviewer_parent_email`
- password: `reviewer_parent_password`
- dataset: synthetic child linked to synthetic kindergarten

Staff:

- email: `reviewer_staff_email`
- password: `reviewer_staff_password`
- dataset: synthetic staff assignment or candidate state

Inspector:

- email: `reviewer_inspector_email`
- password: `reviewer_inspector_password`
- dataset: synthetic inspector application or assigned synthetic garden/inspection

Digital Observer:

- email: `reviewer_observer_email`
- password: `reviewer_observer_password`
- dataset: synthetic observer site/camera readiness, no real camera secrets

## Dataset Rules

- Use synthetic child data only.
- Use synthetic documents/evidence only.
- Do not include live payment credentials.
- Do not include real camera streams unless legally approved and tokenized.
- Do not expose AI raw events to parents.

Status:

reviewer_test_accounts_status = plan_only

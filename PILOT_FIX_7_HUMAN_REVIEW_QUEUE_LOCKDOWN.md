# PILOT FIX 7 - Human Review Queue Lockdown

## Current Status

Internal review queue exists for admin, manager/owner, and inspector paths. Parents are not review users.

## Allowed Reviewers

- Admin: platform-level internal review and operations.
- Active manager/owner: own kindergarten only, if policy allows.
- Assigned inspector: assigned kindergarten only, if policy allows.
- Digital Observer customer/admin: own site only, where product scope allows.

## Denied

- Anonymous users
- Parents
- Unassigned staff
- Staff by assignment alone
- Unassigned inspectors
- Managers of other kindergartens
- Unrelated Digital Observer users

## Review Actions

Implemented review actions include review, confirm, dismiss, escalate, false_positive, valid_detection, and needs_more_data. Required future alignment: add explicit not_enough_context, model_issue, and camera_issue outcomes where not already mapped.

## Evidence Controls

Evidence preview must remain internal and authorized. Raw evidence must not be exposed to parents.


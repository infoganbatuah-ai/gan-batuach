# PILOT FIX 7 - Parent AI Visibility Lockdown

## Decision

Parent raw AI visibility is locked.

## Enforced / Verified

- Parent role no longer has generic `ai_events:read` permission.
- Parent AI page only queries approved parent-visible summaries and filters for:
  - `metadata.parent_visible === true`
  - `metadata.parent_approved === true`
  - non-empty `metadata.parent_summary`
  - reviewed/confirmed/done status
- Parent page does not display raw confidence score, raw frame, internal review notes, provider diagnostics, or raw candidate events.

## Parent Must Not See

- Raw AI events
- Candidate events
- Confidence scores
- Raw frame/evidence
- Internal review queue
- Unreviewed alerts
- Staff accusations
- Other children evidence
- Internal model diagnostics

## Safe Default

`ai_parent_summary_disabled` until legal, RLS, policy, review workflow, and wording gates pass.


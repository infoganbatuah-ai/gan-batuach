# PILOT FIX 6 - Inspector Camera Access Validation

Date: 2026-07-03

## Static Validation

| Check | Result |
|---|---|
| Inspector camera page requires `inspector` role | PASS |
| Inspector camera page derives garden IDs from `gardens.inspector_id = profile.id` | PASS |
| Inspector token rejects disabled inspector access policy | PASS |
| Inspector token requires reason when policy is `assigned_garden_with_reason` | PASS |
| Inspector token confirms assigned garden | PASS |
| Raw credentials not displayed in inspector UI | PASS |

## Pilot Recommendation

Inspector camera viewing should remain readiness/status only unless a written inspection/compliance policy allows live view.

Status: **INSPECTOR_POLICY_VIEW_ONLY_AFTER_SIGNOFF**

# PILOT FIX 6 - Camera UI Truthfulness Validation

Date: 2026-07-03

## Expected States

- camera disabled
- camera readiness only
- gateway not configured
- gateway configured
- camera offline
- camera online
- live view not allowed
- parent viewing disabled
- viewing outside allowed hours
- child not checked in
- token expired
- permission denied
- gateway error
- internal view available if allowed

## Fixes Applied

- Legacy camera wizard no longer allows parent-view toggle.
- Legacy camera wizard no longer shows local IP placeholder.
- Legacy camera wizard now says AI Shadow/readiness, not live AI.
- Demo seed no longer marks parent viewing allowed by default.

## Static Result

| UI | Result |
|---|---|
| Parent camera page | honest unavailable/readiness states |
| Garden camera page | states gateway/readiness and no RTSP/password display |
| Staff camera page | unassigned blocked; assigned only if `staff_view_allowed` |
| Inspector camera page | assigned gardens only; purpose wording |
| Admin camera/gateway pages | operational status; response redaction fixed |

## Remaining Manual Review

Manual visual review is still required after staging data exists.

Status: **TRUTHFUL_READINESS_UI_AFTER_FIXES**

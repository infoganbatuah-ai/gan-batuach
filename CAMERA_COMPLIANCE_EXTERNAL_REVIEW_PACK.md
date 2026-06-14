# Camera Compliance External Review Pack

**DRAFT FOR LEGAL REVIEW**

## Controls Prepared

- No direct RTSP exposure to browser.
- No camera credentials exposed to client.
- Streaming through gateway layer only.
- Short-lived viewing tokens.
- Parent viewing requires permission, viewing window and child checked-in validation.
- Session start/end and viewer metadata are audited.
- Dynamic watermark readiness.
- Manager and inspector viewing require role and scope checks.
- Parent raw AI visibility is blocked.

## Gan Batuach Israel Mode

Disabled:

- audio recording
- audio analytics
- speech recognition
- face recognition
- face matching

## Parent Viewing Review Questions

- What notices are required before enabling parent viewing?
- Are viewing hours legally sufficient?
- Is child checked-in validation required or recommended?
- What retention is allowed for viewing logs?
- What language should be used for web screenshot limitations?
- What consent or declaration is required from staff?

## Native And Web Anti-Leak Distinction

Native readiness:

- Android `FLAG_SECURE` readiness.
- iOS screen-capture detection readiness.

Web limitations:

- watermark and audit only.
- no full screenshot-prevention claim.

## Reviewer Checklist

- Review parent viewing policy.
- Review camera signage / notice language.
- Review staff notice language.
- Review access logs and audit trail.
- Review incident escalation from suspicious viewing.

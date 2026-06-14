# Final Regulatory, Privacy, Security & Launch Compliance Review

This document records the final internal compliance review for Gan Batuach before moving toward a real pilot or production deployment.

It is not legal advice, not an ISO certificate, and not a penetration-test report. It prepares the platform so external reviewers receive a clean and organized technical evidence base.

## Internal Readiness Scores

The final dashboard calculates live scores from regulatory, privacy, security, camera, AI, ISO and launch-readiness tables.

Initial seeded internal review:

- Regulatory readiness: 78
- Privacy readiness: 72
- Security readiness: 68
- Camera compliance: 74
- AI governance: 76
- ISO readiness: 70
- Launch readiness: 66
- Final readiness score: 72

Initial recommendation:

`pilot_ready_with_blockers`

This means the platform is organized enough for controlled pilot planning, but production must wait for blocker closure and external review.

## Completed Controls

Implemented or prepared control areas:

- Gan Batuach Israel regulatory mode
- Vertical capability matrix
- Digital Observer Core mapping
- AI governance and DPIA readiness
- Skeleton and motion analytics boundaries
- Parent camera viewing policy model
- Secure viewing token model
- Camera access audit trail
- Legal attendance and pickup model
- Authorized adults and temporary pickup readiness
- Sensitive data inventory
- AES-GCM field-encryption utility readiness
- Medical access audit log model
- Mandatory MFA policy model
- Trusted device registry
- Session security readiness
- Privacy request workflows
- Retention policy registry
- Legal hold system
- ISO evidence repository
- Statement of Applicability readiness
- Supplier evidence pack
- CI/CD security gate readiness
- Launch readiness dashboard

## Critical Blockers

Critical blockers prevent pilot until fixed or formally handled:

1. MFA provider verification before pilot
   - MFA policies exist, but actual provider challenge success and sensitive-action enforcement must be tested.

2. Sensitive table RLS final review
   - RLS and policies exist across many tables, but a final schema scan must verify no sensitive table is exposed.

## Production Blockers

Production blockers must be closed before production:

- Private sensitive storage proof
- Parent camera streaming legal review
- Medical encryption backfill evidence
- CI/CD green run
- External penetration test
- External ISO consultant review

## Legal Review Items

Open legal review items:

- Contextual child association via skeleton context
- Soft biometric matching and gait-related signals
- Parent camera streaming policy
- Retention periods for child, medical, camera and evidence data
- Public or parent-facing safety score exposure
- Payment routing and accounting separation

These items must remain restricted or disabled until external review is complete.

## Gan Batuach Israel Mode Validation

Gan Batuach Israel mode must enforce:

- audio analytics disabled
- speech recognition disabled
- keyword detection disabled
- face recognition disabled
- face matching disabled
- biometric child identification disabled
- persistent child identity tracking disabled or legal-review-only
- gait recognition legal-review-only
- soft biometric matching legal-review-only
- cross-day skeleton identity legal-review-only

Allowed capabilities:

- pose estimation
- skeleton analytics
- motion analytics
- suspected fall detection
- suspected inactivity detection
- suspected crowding detection
- restricted area detection
- safety anomaly detection

All allowed AI capabilities must require human review.

## Parent Visibility Boundary

Parents may see only:

- approved summaries
- their own child data
- approved documents
- approved safety updates
- allowed camera streams

Parents must not see:

- raw AI events
- raw observer signals
- internal investigation drafts
- staff-only notes
- other children
- other gardens
- unapproved camera events
- internal risk scores

## Camera Compliance Status

Required controls:

- no direct RTSP exposure
- no camera credentials in browser/client code
- no gateway secrets in client code
- short-lived parent viewing tokens
- parent permission check
- child checked-in validation
- viewing schedule enforcement
- session audit logging
- dynamic watermark readiness
- native anti-screen-capture readiness for mobile apps

External legal review is still required for parent streaming policy.

## Attendance and Pickup Compliance

The legal attendance model must remain non-biometric.

Required boundaries:

- no camera-based attendance
- no face-based child attendance
- GPS check-in/check-out workflow
- authorized adult registry
- temporary pickup permission model
- emergency pickup with manager approval
- digital signatures
- pickup audit trail
- unauthorized pickup blocked

## Medical and Sensitive Data

Required controls:

- sensitive data inventory
- server-side encryption utilities
- encrypted medical and identity fields
- no decrypted values in logs
- medical access audit logs
- private document buckets
- signed URL access where needed

Remaining gap:

- controlled backfill and verification evidence.

## MFA and Identity Hardening

Required controls:

- MFA policy per role
- MFA for sensitive actions
- trusted device registry
- new device alerts
- session hardening
- audited account recovery

Remaining gap:

- provider-level MFA challenge testing and evidence.

## Audit Coverage

Audit coverage must include:

- login
- MFA
- medical access
- camera viewing
- document downloads
- parent data access
- child data access
- role changes
- staff changes
- inspection actions
- AI review actions
- payment actions
- regulatory actions

Audit logs must not contain secrets or sensitive plaintext.

## Data Rights and Retention

Required controls:

- access requests
- correction requests
- export requests
- deletion requests
- anonymization readiness
- legal hold workflow
- retention policy registry
- telemetry anonymization

Deletion must respect:

- legal holds
- evidence retention
- active incidents
- payment/accounting requirements
- audit integrity

## ISO Readiness Status

ISO 27001 readiness areas:

- access control
- audit logging
- risk register
- incident response
- asset inventory
- change management
- backups

ISO 27017 readiness areas:

- cloud provider inventory
- tenant isolation
- Vercel readiness
- Supabase readiness
- environment security
- deployment controls

ISO 27701 readiness areas:

- privacy rights
- child data protection
- DPIA readiness
- consent model
- data retention
- AI privacy controls

External ISO consultant review is still required.

## CI/CD and Deployment Gates

Required controls:

- GitHub workflow readiness
- typecheck gate
- build gate
- dependency scan readiness
- secret scan readiness
- CodeQL readiness
- migration safety checklist
- branch protection recommendations

Production should not proceed until checks pass and branch protection is enforced.

## Security Headers

Required deployment headers:

- Strict-Transport-Security
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- CSP readiness

CSP should be tightened progressively so the app is not broken by an overly strict first deployment.

## Storage and File Access

Sensitive files must be private:

- ID documents
- medical documents
- staff certificates
- signatures
- inspection evidence
- incident evidence

Views and downloads must be role-scoped and audited.

## Payment Compliance

Revenue separation:

- Gan Batuach subscription payments go to the Gan Batuach company account.
- Parent tuition payments go directly to the kindergarten/provider account.

Required controls:

- no raw card storage
- tokenized provider payments only
- invoices generated
- billing actions audited
- bank/payment configuration changes audited

Payment/accounting review remains required.

## Digital Observer Separation

Digital Observer Core remains mapped for future verticals.

Gan Batuach profile must keep restricted capabilities controlled by policy:

- no silent enablement of restricted AI
- no audio in Gan Batuach Israel mode
- no face recognition in Gan Batuach Israel mode
- skeleton/contextual identity matching legal-review-only unless approved

## External Review Checklist

Privacy lawyer:

- AI restrictions
- parent visibility
- camera viewing
- retention and deletion
- child data boundaries

ISO consultant:

- ISO evidence pack
- Statement of Applicability
- policies
- supplier reviews
- audit binder

Penetration tester:

- authentication
- authorization
- API routes
- uploads
- cameras
- documents
- payments

Cloud security reviewer:

- Supabase RLS
- Supabase Storage
- Vercel environment variables
- GitHub branch protection
- CI/CD gates

Accounting/payment reviewer:

- subscription routing
- tuition routing
- invoices
- refunds
- provider account setup

## Production Launch Recommendation

Current internal recommendation:

`pilot_ready_with_blockers`

Production recommendation:

Not production-ready until:

- critical blockers are fixed
- high production blockers are fixed or formally accepted
- legal review items are reviewed externally
- ISO consultant review is completed
- penetration test is completed
- typecheck/build/security gates pass
- storage/RLS evidence is attached
- payment/accounting review is complete

Do not claim certification. Only state internal readiness.

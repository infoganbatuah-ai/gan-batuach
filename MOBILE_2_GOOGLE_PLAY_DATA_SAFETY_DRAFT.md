# MOBILE 2 - Google Play Data Safety Draft

Date: 2026-06-27

Conservative draft for Google Play Data Safety. Final answers require legal/privacy review.

## Data Collected

Likely collected:

- name, email, phone, account identifiers
- role and affiliation data
- child profile data entered by authorized adults
- documents/uploads
- messages and operational content
- inspection records/evidence
- payment/subscription metadata if providers are enabled
- device/push token if push is enabled
- diagnostics/logs if configured

Possibly collected depending on enabled features:

- location for GPS attendance/inspection
- photos/videos for upload/evidence/gallery
- camera viewing session metadata
- AI review metadata in shadow/internal mode

## Data Shared

Provider dependent:

- Supabase/storage/auth infrastructure
- notification providers if configured
- payment/invoice providers if configured
- push providers if configured

Do not disclose as shared publicly unless provider/data flow is enabled and legally reviewed.

## Purposes

- app functionality
- account management
- communication
- safety/compliance documentation
- support
- payment/subscription management where enabled
- security/audit

## Security

- encryption in transit: should be declared only if deployment enforces HTTPS.
- deletion request support: needs final public instructions.
- data retention: needs legal review.

## Children / Family Policy

The app is adult-facing and processes child-related data for kindergarten operations. Final Google Play target audience and families-policy classification requires legal/store policy review.

Status:

google_data_safety_status = draft_needs_legal_privacy_review

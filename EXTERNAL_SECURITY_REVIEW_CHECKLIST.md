# External Security Review Checklist

**DRAFT FOR AUTHORIZED EXTERNAL REVIEW**

## Authentication

- login/logout
- password reset
- one-time password flow
- MFA enrollment and challenge
- account lockout
- session expiration
- session revocation
- trusted device behavior
- new device alert readiness

## Authorization

- parent cannot access another child
- parent cannot access another garden
- staff cannot access admin/manager-only routes
- manager cannot access other gardens
- inspector cannot access unassigned gardens
- admin access is audited

## RLS

- children
- parents
- staff
- gardens
- documents
- medical records
- camera access
- inspections
- complaints
- payments
- AI events
- observer signals
- audit logs
- privacy requests

## API

- missing authentication
- broken authorization
- IDOR
- injection
- unsafe redirects
- upload abuse
- rate limiting readiness
- CSRF readiness
- privilege escalation

## Storage

- public bucket exposure
- private bucket access
- signed URL leakage
- ID document access
- medical document access
- staff certificate access
- evidence access
- invoice access
- signature file access

## Cameras

- RTSP exposure
- credential exposure
- playback token misuse
- viewing outside hours
- child checked-out bypass
- inspector/staff scope bypass
- session audit logging
- watermark readiness

## AI / Observer

- raw AI event exposure to parents
- observer signal exposure
- `parent_visible` bypass
- `review_required` bypass
- restricted capability activation
- audio disabled
- face recognition disabled

## Payments

- no raw card storage
- webhook validation
- replay protection
- idempotency
- invoice access
- subscription tampering
- discount abuse
- parent-to-kindergarten payment separation

## Mobile

- session handling
- push tokens
- deep links
- camera viewing
- screenshot protection readiness
- device trust
- GPS spoofing risk
- offline queue abuse

## CI/CD And Infrastructure

- secret scanning readiness
- dependency scanning readiness
- CodeQL readiness
- branch protection
- Vercel headers
- server-only environment variables
- service role key never exposed to client

# Security Architecture External Review Pack

**DRAFT FOR EXTERNAL SECURITY REVIEW**

## Stack

- Next.js / TypeScript
- Vercel
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- GitHub CI/CD
- Capacitor for mobile

## Auth Model

- Supabase Auth.
- Role-based application routes.
- MFA readiness for sensitive actions.
- Trusted device readiness.
- Session and device security dashboards.

## Authorization Model

Scopes to test:

- parent -> own child only
- staff -> assigned kindergarten only
- manager -> own garden only
- inspector -> assigned gardens only
- admin -> audited privileged access

## Supabase RLS Model

Sensitive table categories:

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

External testing should verify expected allowed/denied access using staging JWTs only.

## Storage Model

Sensitive files should be private:

- ID documents
- medical documents
- staff certificates
- inspection evidence
- incident evidence
- invoices
- signatures

Access should use role-scoped server routes or signed URL readiness, with audit logging for sensitive views/downloads.

## Camera Security Model

- No RTSP URL in browser.
- No camera credential exposure.
- Playback tokens are short-lived.
- Parent viewing requires permission, viewing hours, child checked-in status and MFA where required.
- Inspector access is assigned-scope only.
- Viewing sessions are audited.

## AI / Observer Model

- Raw AI events are internal only.
- `parent_visible` defaults false.
- `review_required` is mandatory for sensitive outputs.
- Gan Batuach Israel Mode disables audio and face recognition.
- Restricted capabilities are disabled or legal-review-required.

## Payment Model

- No raw card storage.
- Provider tokenization only.
- Gan Batuach subscription payments route to Gan Batuach account.
- Parent tuition payments route to kindergarten account/provider account.
- Webhook readiness requires signature verification, replay protection and idempotency.

## Audit Model

Audit coverage should include:

- login/logout
- MFA
- medical access
- document downloads
- camera viewing
- role changes
- payment actions
- regulatory settings
- AI review actions

Audit logs must not store secrets or sensitive plaintext.

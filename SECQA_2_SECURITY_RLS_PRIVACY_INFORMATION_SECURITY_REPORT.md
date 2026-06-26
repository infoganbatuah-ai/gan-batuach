# SECQA 2 Security, RLS, Privacy And Information Security Report

Date: 2026-06-27
Branch: main
Latest commit checked: e91b177 TECHQA 1 – Full Technical Regression After Final UX/UI Rescue

## Completion Status

SECQA 2 static regression is completed.

Production is still blocked because live Supabase RLS verification, provider webhook implementation/testing, broader abuse protection, security headers, and external/legal review items remain open.

No push was performed.

## Baseline Commands

| Command | Result | Duration |
|---|---:|---:|
| `npm run typecheck` | passed | 17s |
| `npm run build` | passed | 49s |
| `git diff --check` | passed | <1s |

No security-specific automated test suite was found in `package.json`.

## Reports Created

- `SECQA_2_SUPABASE_MIGRATION_STATUS_AUDIT.md`
- `SECQA_2_SENSITIVE_TABLE_ACCESS_MATRIX.md`
- `SECQA_2_API_AUTHORIZATION_AUDIT.md`
- `SECQA_2_SECURITY_RLS_PRIVACY_INFORMATION_SECURITY_REPORT.md`

## RLS Status

Latest hardening migrations exist:

- `20260616000100_parent_rls_scope_hardening.sql`
- `20260616000200_payment_provider_rls_scope_hardening.sql`

Static assessment:

- Parent access is intended to be child/request/document scoped, not whole-kindergarten scoped.
- Manager access is intended to use `can_manage_garden`.
- Staff access is split from manager access.
- Inspector access is assigned-garden scoped.
- Payment/provider finance records are intended to be manager/admin/own-parent scoped, excluding staff/inspectors.
- Security definer functions in latest hardening migration include `set search_path = public`.

Production blocker:

- The repository does not prove these migrations were applied in Supabase. Live catalog verification is required.

## API Authorization Status

- API route handlers inventoried: 169.
- Shared CRUD routes use `createCrudHandlers`, which enforces permissions.
- After recognizing shared wrappers and re-exports, static scan found no confirmed unguarded sensitive API route.
- Many sensitive routes still require live negative tests because RLS and ownership checks are data-dependent.

## Storage / Signed URL Status

Observed safeguards:

- Generic upload route requires authenticated user.
- Upload route enforces bucket allowlist, role bucket access, MIME allowlist and 12MB max size.
- Sensitive signed URL TTL: 10 minutes.
- Public-ish logo/gallery preview TTL: 15 minutes.
- Inspection signature storage uses private inspection bucket with 10-minute signed URL when service role is configured.

Required verification:

- Confirm bucket privacy and policies in Supabase.
- Confirm no existing storage objects expose public long-lived sensitive URLs.
- Confirm document download events are audited in live flows.

## Payment / Provider Security Status

Observed safeguards:

- Parent tuition, Gan Batuach subscription and Digital Observer billing are modeled separately.
- `payment_method_tokens` is documented as token references only.
- Digital Observer beta subscriptions include `raw_card_storage_allowed = false` constraint.
- Manager child-payment route updates own-garden children only and stores no raw card data.
- Garden subscription route uses manual/future provider adapter and does not activate live payment.

Blockers:

- Concrete payment/invoice webhook endpoints were not found.
- Production provider activation remains blocked until signature verification, idempotency and replay protection are implemented/tested.

## Webhook Security Status

- Readiness tables for production webhooks exist.
- Actual `/api/webhooks/...` endpoint files were not found.
- Production mode must reject unsigned events, store event IDs, enforce idempotency and avoid duplicate activation before live provider use.

Classification: blocking for production provider activation.

## Camera Security Status

Observed safeguards:

- Camera playback token route requires `video:stream` permission and rate limiting.
- Parent camera list route requires parent role and sanitizes camera output.
- Camera credentials/RTSP construction is server-side.
- `lib/domain/video-streaming.ts` rejects direct `rtsp://` playback base URLs.
- UI copy repeatedly states no RTSP/credentials in browser.

High-risk follow-up:

- Parent/manager/inspector camera access must be negative-tested with seeded users.
- Frozen/inactive kindergarten camera blocking must be tested in live policy/data state.
- Real gateway token lifetime and audit events must be verified before live camera use.

## AI / Digital Observer Security Status

Observed safeguards:

- AI observer ingestion requires `AI_OBSERVER_SECRET`.
- AI/camera event tables include `parent_visible boolean not null default false`.
- Admin/legal-review pages document blocked or restricted capabilities including audio/face/automatic accusations.
- Inspector AI routes query assigned garden IDs in UI data loaders.

High-risk follow-up:

- Gan Batuach Israel Mode must be verified live: no audio, no face recognition, no raw AI parent visibility, human review required.
- Audio/face-related schemas/routes/views exist for readiness; they require legal/security review and policy enforcement before production.
- Digital Observer/Gan Batuach data separation must be tested with real site/garden data.

## Medical And Child Privacy Status

Observed safeguards:

- Latest RLS migration scopes child/medical access through child record or garden role helpers.
- CRUD insert logic encrypts sensitive child identity/medical fields before insert.
- Parent hardening migration includes child health, medicine and medical event read/write policies.

Required verification:

- Live negative tests: parent A cannot query child B, unapproved staff cannot access child data, inspector cannot access unassigned child records.
- Confirm encrypted columns are used in production flows and legacy plaintext columns are not overexposed in list views.

## Messaging And Notification Privacy Status

Observed safeguards:

- Communication RLS policies are participant/garden/user scoped.
- Payment failure notification route targets the linked parent profile.
- Provider services are readiness/mock-gated unless configured.

Required verification:

- Live tests for unrelated parent/staff/inspector conversation access.
- External delivery payload minimization before real provider activation.

## Audit Logging Status

Observed safeguards:

- Upload route writes `audit_logs`.
- Child payment route writes `audit_logs`.
- Camera playback/session helpers include audit logging paths.
- Proxy can write request audit logs when service role is configured.
- Immutable audit readiness migration exists.

Required verification:

- Live tests for audit writes on role changes, document downloads, camera viewing, AI review, inspection submission and provider events.
- Confirm audit records cannot be edited/deleted through UI or API.

## Secrets / Client Bundle Status

Static secret scan:

- No tracked `.env.local` found.
- No literal service-role key or obvious provider secret value found in app/component/lib/public tracked code.
- `.env.example` contains placeholders only.
- Scripts reference service-role environment variables but do not contain actual values.
- Demo seed scripts contain demo emails and env-based passwords, not real passwords.

No secret rotation is required based on this static scan.

## Security Headers / Middleware Status

Observed:

- Project uses `proxy.ts`; production build confirms `Proxy (Middleware)`.
- Session refresh and Digital Observer host rewrite are present.

Gaps:

- No explicit CSP, `frame-ancestors`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, or sensitive-page no-cache policy was found in config/proxy.

Classification: high for production hardening, but not fixed here to avoid breaking the app without browser/provider testing.

## Rate Limiting And Abuse Readiness

Observed:

- Rate limiting exists on AI observer ingestion, camera playback-token, video gateway health checks and cron inspection routes.

Gaps:

- Public lead/demo routes, registration, login/password reset, messaging, upload, admin actions and provider/payment actions do not show broad route-level rate limiting.

Classification: high / production blocker unless covered by external WAF/Supabase/Vercel controls.

## Data Retention And Deletion Readiness

Observed:

- Right-to-be-forgotten script exists.
- Retention/deletion/legal-hold migration exists.

Gaps:

- No live deletion/retention dry-run evidence in repo.
- Legal approval and evidence retention policy must be reviewed before production.

Classification: requires_legal_review.

## Findings Summary

| Classification | Count | Findings |
|---|---:|---|
| critical | 0 | No tracked secret or confirmed active access leak found statically. |
| high | 5 | Live RLS negative tests required; broad rate limiting incomplete; security headers missing; camera/AI live boundaries need seeded tests; medical/plaintext list-view exposure needs manual review. |
| blocking | 2 | Provider webhooks missing/readiness-only; Supabase migration application not proven. |
| requires_supabase_manual_test | 4 | RLS catalog state, active helper bodies, storage bucket privacy, cross-role negative access. |
| requires_provider_setup | 2 | Payment/invoice/communication webhooks; real camera gateway token/audit verification. |
| requires_external_security_review | 2 | RLS/authorization negative testing; penetration/security review. |
| requires_legal_review | 2 | AI/audio/face capabilities and retention/deletion/legal hold. |
| fixed | 0 | No code/security fix was applied in this pass. |

## Production Approval Status

Production is not approved by SECQA 2.

It is safe to proceed to PROD 1 / payment-provider blocker completion only as a blocker-resolution phase, not as production launch approval.

Before production launch:

1. Run live Supabase RLS catalog verification and cross-role negative tests.
2. Implement/test payment/invoice/communication webhook signature and idempotency handling.
3. Add or externally enforce rate limiting on public/auth/upload/message/admin/provider surfaces.
4. Add tested security headers and sensitive-page cache controls.
5. Complete camera gateway live token/audit tests.
6. Complete AI/Digital Observer legal/security review for audio/face/raw-event boundaries.
7. Complete storage signed URL and bucket privacy tests.

## Secret Rotation

No tracked secret value was found, so no immediate secret rotation is required from this static scan.

If any real value was previously committed outside the scanned scope or exists in deployment logs, rotate it separately.


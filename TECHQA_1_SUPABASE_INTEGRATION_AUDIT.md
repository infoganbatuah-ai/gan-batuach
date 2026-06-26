# TECHQA 1 Supabase Integration Audit

Date: 2026-06-27

## Supabase Helpers

| Helper | Location | Result |
|---|---|---|
| server user client | `lib/supabase/server.ts` | Uses `@supabase/ssr` and cookie-backed server client with publishable key. |
| browser client | `lib/supabase/browser.ts` | Uses public Supabase URL and publishable key only. |
| admin/service client | `lib/supabase/admin.ts` | Server-side helper gated by `SUPABASE_SERVICE_ROLE_KEY`; no client-side import was confirmed by build. |
| proxy/session helper | `lib/supabase/middleware.ts` and `proxy.ts` | Refreshes session through Next proxy and attaches request audit logging when service role is configured. |

## Migration Inventory

- Migration files found: 159.
- First migration: `20260523000000_initial_schema.sql`.
- Latest migrations include:
  - `20260616000100_parent_rls_scope_hardening.sql`
  - `20260616000200_payment_provider_rls_scope_hardening.sql`
- Duplicate timestamp prefixes: none found.

## Environment Readiness

`.env.example` was compared to environment variable names referenced by `app`, `components`, `lib`, `next.config.ts`, and `capacitor.config.ts`.

- Missing non-system names before this pass: `VIDEO_GATEWAY_PUBLIC_URL`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`.
- Fixed in this pass by adding empty placeholders.
- System-managed names not expected in `.env.example`: `NODE_ENV`, `VERCEL_URL`.
- `.env.local` exists locally but is ignored and not tracked.

## Storage And Signed URL Findings

| Area | Result |
|---|---|
| Generic upload route | Requires authenticated user and server-side service role; enforces allowed buckets, MIME types, max 12MB, role-bucket access, and audit logging. |
| Sensitive upload signed URL TTL | 10 minutes. |
| Public-preview signed URL TTL | 15 minutes for kindergarten logos/gallery previews. |
| Inspection signature upload | Uses private `inspection-reports` bucket and 10-minute signed URL when service role is available. |
| Public sensitive files | No tracked public-sensitive file exposure found by static scan. |

## API And Role-Scoped Access Notes

Static scan found 169 API route handlers.

Route categories:

- Admin: 29
- Parent: 23
- Garden/manager: 23
- Staff: 6
- Inspector/inspection: 6
- Camera/video: 14
- AI/observer: 15
- Cron: 3
- Auth/passkeys: 6
- Documents/storage: 3
- Other/shared: 41

The static guard scan identified 45 route handlers where an obvious guard term was not detected. This is not proof of exposure because several routes use shared CRUD helpers or are public by design, but it is enough to require focused SECQA review before production hardening is considered complete.

## Findings

| Classification | Finding | Status |
|---|---|---|
| fixed | `.env.example` missed three provider/gateway variable names referenced by code. | Fixed. |
| security_followup_required | 45 API routes need manual guard verification because static search did not detect direct auth/role enforcement. | Documented for SECQA 2. |
| manual_review_required | `proxy.ts` writes audit logs using service role if configured. It does not expose the key, but audit volume/performance should be reviewed before production. | Documented. |
| low | There is no `middleware.ts`; the project uses Next proxy (`proxy.ts`) and build confirms `Proxy (Middleware)`. | No action needed. |


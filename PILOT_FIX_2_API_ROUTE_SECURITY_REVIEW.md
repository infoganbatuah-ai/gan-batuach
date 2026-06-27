# PILOT FIX 2 - API Route Security Review

Date: 2026-06-27

## Review Scope

Static review of key API/security patterns:

- auth and role helpers
- generic CRUD route helper
- storage upload route
- admin routes
- payment/provider webhooks
- camera token routes
- parent camera list route
- AI event routes

No live API attack test was run because target Supabase credentials and test users are not available in this workspace.

## Positive Findings

| Area | Finding |
| --- | --- |
| Browser Supabase client | Uses public Supabase URL and publishable key only. |
| Service role helper | Centralized in `lib/supabase/admin.ts`; static scan did not find direct import in client components. |
| Admin user writes | `app/api/admin/users/route.ts` requires `requireRole(["admin"])` before using service role. |
| Storage upload | Requires authenticated user, role bucket allow-list, content-type allow-list, size limit, server-side service role, audit log, and short signed URL TTL. |
| Camera playback token | Re-checks authenticated user, role, camera assignment, parent policy, legal capability, MFA gate, child presence, viewing hours, and browser-safe playback URL before issuing token. |
| Camera status mutation | Requires admin/manager/owner and verifies non-admin garden ownership. |
| Parent camera list | Uses safe selected columns and post-query policy filtering/sanitization. |
| Payment webhooks | Centralized through `handleProviderWebhook`; uses server-side admin client for side effects. |

## Findings Requiring Manual Or Follow-Up Verification

| Severity | Area | Finding | Required action |
| --- | --- | --- | --- |
| high | Generic CRUD | `createCrudHandlers` relies on role permission plus Supabase RLS for object ownership on many tables. Broad role permissions include `staff` child/camera access and `parent` AI/camera permissions. | Run negative RLS tests for every exposed CRUD table. Tighten route-specific filters if RLS tests fail. |
| high | Admin pages using user client | Many admin dashboards use `createClient()` after shell/route protection. This is acceptable only if admin RLS policies are correct. | Confirm admin role policies in live Supabase. |
| high | Service role in public/server pages | Public pages such as homepage/garden directory use service role server-side to fetch public-safe garden fields. | Confirm selected columns remain public-safe and no private fields are serialized. |
| high | Parent camera list with service role | `getParentCameraListForProfile` can use service role for data lookup but applies explicit scope/sanitization. | Run live parent A/B camera negative tests; inspect response payload for no RTSP/secrets. |
| high | Parent/child onboarding routes | Several parent routes use service role for multi-table writes. | Verify server-side ownership checks and resulting rows with live tests. |
| medium | Error handling | `handleRouteError` appends the error message to a generic failure. | For production hardening, avoid returning raw DB/provider messages from sensitive routes. |
| medium | Debug route | `/api/debug/parent-camera-access` exists and uses service role when configured. | Confirm debug output is unavailable or non-sensitive in production. |

## Security Gate Result

API route security is not closed for real pilot yet.

Recommended status:

`MANUAL_SUPABASE_AND_API_NEGATIVE_TESTS_REQUIRED`

## Required API Tests Before Pilot

1. Parent A requests `/api/children`, `/api/parent/*`, `/api/ai-events`, camera token for Camera A/B.
2. Staff unassigned requests child, parent, camera, payment, AI endpoints.
3. Staff assigned A requests Kindergarten B resources.
4. Manager A requests Kindergarten B child/staff/payment/camera records.
5. Inspector unassigned requests garden/inspection/camera/AI records.
6. Parent/staff/inspector request provider webhook/payment admin routes.
7. All roles attempt direct signed URL generation for another user's file.


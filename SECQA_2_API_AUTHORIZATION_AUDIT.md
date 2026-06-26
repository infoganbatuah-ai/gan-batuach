# SECQA 2 API Authorization Audit

Date: 2026-06-27

## Scope

- API route handlers inventoried: 169.
- Static auth/guard patterns checked:
  - `requireRole`
  - `requireUser`
  - `getSessionProfile`
  - `requirePermission`
  - `createCrudHandlers`
  - Supabase server/admin helpers
  - endpoint secrets such as `CRON_SECRET`, `HEALTHCHECK_SECRET`, `AI_OBSERVER_SECRET`, `VIDEO_GATEWAY_SIGNING_SECRET`
  - `assertRateLimit`

## Summary

| Area | Result |
|---|---|
| Shared CRUD routes | Use `createCrudHandlers`, which calls `requirePermission` for read/write unless explicitly public insert. |
| Parent routes | Major parent routes use `requireRole(["parent"])` or server Supabase/RLS queries. |
| Manager/garden routes | High-risk actions reviewed use `requireRole(["manager", "owner"])` and explicit garden ownership checks. |
| Staff routes | Build and static guard scan passed; runtime assignment tests still required. |
| Inspector routes | Build and static guard scan passed; assigned-garden negative tests still required. |
| Admin routes | Major admin actions use admin role guards or shared admin data helpers; one re-export route was a static scanner false positive. |
| Camera playback token | Requires `video:stream` permission and rate limiting before session creation. |
| AI observer ingestion | Requires `x-ai-observer-secret` and rate limiting. |
| Video gateway health | Requires `x-video-gateway-secret` and rate limiting. |

## Static Review Results

After recognizing shared CRUD wrappers and route re-exports:

- API routes needing manual auth review by static scan: 1.
- Route: `/api/admin/camera-gateway`
- Assessment: false positive; it re-exports `POST` from `/api/admin/video-gateway/route`.

## Sensitive Route Notes

| Route / family | Auth | Ownership / assignment | Input validation | Output minimization | Risk |
|---|---|---|---|---|---|
| `/api/children` | permission helper | RLS + permission | schema | table select via CRUD | medium: live RLS required |
| `/api/documents`, `/api/storage/upload` | user/permission | role bucket access | MIME/size/bucket validation | signed URL only | medium |
| `/api/garden/child-payments` | manager/owner | checks child garden equals profile garden | zod schema | no card data | low/medium |
| `/api/garden/subscription` | manager/owner | profile garden only | zod schema | manual provider only | low |
| `/api/camera-streams/[id]/playback-token` | `video:stream` permission | delegated to playback session logic | zod schema | session token flow | high: runtime policy tests required |
| `/api/parent/cameras` | parent role | child/garden scope resolver + sanitizer | query only | sanitized parent cameras | medium |
| `/api/ai/observe` | secret header | server ingestion only | zod schema | server response | high: secret rotation and provider tests required |
| `/api/video-gateway/health-checks` | secret header | gateway event only | zod schema | safe health response | high: provider tests required |
| public lead/demo routes | public | public insert only | varies | public-safe | medium/high abuse risk without broad rate limiting |

## Webhook Readiness

- No concrete `/api/webhooks/...` route files were found.
- Provider webhook readiness is modeled in database/readiness screens.
- Production provider activation remains blocked until actual webhook endpoints, signature verification, idempotency and replay protection are implemented and tested.

## Rate Limiting

Rate limiting exists on:

- `/api/ai/observe`
- `/api/camera-streams/[id]/playback-token`
- `/api/video-gateway/health-checks`
- cron inspection routes

Missing or not proven broadly:

- login/auth attempts
- registration/self-service
- public lead/demo forms
- message sending
- document upload
- admin actions
- payment/provider actions

## Findings

| Classification | Finding | Status |
|---|---|---|
| high | Rate limiting is not consistently applied to public insert and abuse-prone routes. | Production blocker or external WAF requirement. |
| blocking | Payment/invoice/email/SMS/WhatsApp/push webhook endpoints are readiness-mode only; concrete routes were not found. | Provider production remains blocked. |
| requires_supabase_manual_test | API authorization relies on RLS for many dynamic data scopes; live negative tests are required. | Required. |
| low | `/api/admin/camera-gateway` was a static false positive because it re-exports guarded video-gateway behavior. | No code change. |


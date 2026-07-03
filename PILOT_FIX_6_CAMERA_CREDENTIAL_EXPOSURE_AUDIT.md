# PILOT FIX 6 - Camera Credential Exposure Audit

Date: 2026-07-03

## Scope

Searched code, components, scripts and public assets for:

- `rtsp://`
- local IP examples
- username/password camera fields
- gateway secrets
- raw stream URLs
- credential-bearing API responses
- client display risks

## Findings And Fixes

| Finding | Severity | Location | Fix |
|---|---|---|---|
| Camera status/gateway update routes returned full camera rows after mutation | high | `app/api/camera-streams/[id]/status/route.ts`, `app/api/admin/video-gateway/route.ts` | Added `sanitizeCameraForAdminResponse` before returning camera rows |
| Demo seed used local IP examples and `parent_view_allowed: true` | medium | `scripts/seed-demo-full.mjs` | Removed local IP placeholders and changed demo cameras to parent viewing disabled / AI disabled |
| Old camera wizard exposed local IP placeholder and parent-view toggle | high | `components/camera-ai-wizard.tsx` | Removed local IP placeholder, locked parent viewing false, changed AI wording to Shadow/readiness |

## Static Exposure Result

| Area | Result |
|---|---|
| Client playback-token response | tokenized playback URL only; RTSP/private hosts rejected |
| Parent camera API | sanitized parent camera objects; no playback URL fields returned |
| Generic camera CRUD read | safe allow-list excludes raw credentials/source URL |
| Generic camera CRUD create | strips `password`, deletes `manual_rtsp_url`, sets `source_url` empty and encrypts credential fields |
| RTSP ingest | stores masked source URL and encrypted sensitive fields |
| Admin/gateway mutation responses | fixed to redact sensitive fields |
| Public assets | no credential file found |

## Remaining Manual Checks

- Inspect built client bundle after real env configuration.
- Verify Supabase table policies prevent selecting credential columns by unauthorized roles.
- Confirm logs in production do not contain camera setup payloads.

Credential exposure status: **NO_KNOWN_ACTIVE_CLIENT_EXPOSURE_AFTER_FIXES**

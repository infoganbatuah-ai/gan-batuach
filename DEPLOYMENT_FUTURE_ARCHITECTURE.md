# Gan Batuach Future Deployment Architecture

This document is preparation only. The current production system should continue running exactly as it does today.

Do not migrate the live deployment to Docker until a separate infrastructure phase is planned, tested and approved.

## A. Current Architecture

Gan Batuach currently runs as:

- Next.js application
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase RLS/RBAC
- Vercel deployment

Current deployment model:

```text
Users
-> Vercel / Next.js
-> Supabase Auth + PostgreSQL + Storage
```

Current environment variables such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VIDEO_GATEWAY_URL` and `AI_GATEWAY_URL` remain the integration contract.

## B. Future Digital Observer Flow

Future Digital Observer / camera / AI architecture:

```text
RTSP / ONVIF cameras
-> Video Gateway
-> HLS / WebRTC
-> AI Gateway
-> Face recognition
-> Speech detection
-> Motion analysis
-> Structured events
-> Notifications
-> Gan Batuach dashboards
```

Important rule:
The product must not claim live video or live AI is active unless the relevant gateways are connected and healthy.

Until then, cameras and AI rules can be configured as pending infrastructure.

## C. Future Services

### web-app

The existing Next.js application.

Responsibilities:
- Public website
- Authenticated dashboards
- RBAC and route protection
- API routes
- Supabase queries
- Camera and AI configuration UI
- Event management UI

### video-gateway

Future service for camera ingestion and playback.

Responsibilities:
- RTSP ingestion
- ONVIF discovery
- DVR/NVR connection handling
- HLS conversion
- WebRTC conversion
- Stream health checks
- Secure playback token validation
- No direct DVR exposure to parents

Expected contract:
- `VIDEO_GATEWAY_URL`
- `VIDEO_GATEWAY_SIGNING_SECRET`

### ai-gateway

Future orchestration service for Digital Observer analysis.

Responsibilities:
- Receive frame/audio samples from the video gateway
- Call specialized AI services
- Normalize confidence/severity
- Apply cooldowns and thresholds
- Send structured events to Gan Batuach

Expected contract:
- `AI_GATEWAY_URL`
- `AI_OBSERVER_SECRET`

### face-recognition-service

Future specialized service.

Responsibilities:
- Compare camera frames with child/staff profile photos
- Support attendance confidence
- Detect missing child / unexpected child where configured
- Return confidence scores only, not biometric raw data

### speech-analysis-service

Future specialized service.

Responsibilities:
- Detect crying/screaming/distress sounds
- Detect argument escalation patterns
- Detect configured Hebrew safety keywords
- Return event type, confidence and timestamp

### pdf-service

Future server-side PDF renderer.

Responsibilities:
- Render inspection reports
- Embed logo, images, signatures and QR verification
- Add page numbers and metadata
- Return signed report file path in Supabase Storage

### workers-service

Future background worker service.

Responsibilities:
- Monthly inspection creation
- Inspection countdown reminders
- Late inspection escalation
- Camera health polling
- AI event post-processing
- Notification fanout

## Docker Readiness Files

The repository now includes:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.example.yml`

These files are examples only. They are not required for the current Vercel deployment.

## Migration Policy

Before using the future container architecture:

1. Build staging containers.
2. Connect to a staging Supabase project.
3. Validate Auth, RLS, Storage and service-role boundaries.
4. Validate video gateway secrets.
5. Validate AI gateway event signing.
6. Run full app QA.
7. Only then consider production migration.

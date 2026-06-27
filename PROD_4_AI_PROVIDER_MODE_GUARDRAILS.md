# PROD 4 AI Provider Mode Guardrails

Date: 2026-06-27

## Supported Modes

| Mode | Meaning | Allowed behavior |
|---|---|---|
| `disabled` | AI provider disabled | UI/readiness only |
| `mock` | Deterministic mock/shadow only | No real frames, no external AI |
| `readiness` | Setup checklist | Missing env names may be shown |
| `shadow` | Internal candidate events only | Human review required; no parent raw visibility |
| `test_inference` | Controlled non-production inference | Requires safe frame source and provider endpoint |
| `real_inference` | Real provider connected to safe frame source | Still shadow/review only |
| `production` | Production mode | Requires explicit provider setup, frame source, legal/security approval and user approval |

## Required Environment Names

Generic AI env names:

- `AI_PROVIDER`
- `AI_PROVIDER_MODE`
- `AI_PROVIDER_API_KEY`
- `AI_INFERENCE_ENDPOINT`
- `AI_WEBHOOK_SECRET`
- `AI_MODEL_VERSION`
- `AI_FRAME_SAMPLE_RATE_SECONDS`
- `AI_CONFIDENCE_THRESHOLD`
- `AI_SHADOW_MODE_ENABLED`
- `DIGITAL_OBSERVER_AI_MODE`
- `GAN_BATUACH_AI_LEGAL_MODE`
- `AI_REVIEW_QUEUE_ENABLED`
- `AI_SAFE_TEST_FRAME_PATH`
- `AI_TEST_FRAME_STORAGE_PATH`

Legacy/readiness compatibility names:

- `AI_GATEWAY_URL`
- `AI_OBSERVER_SECRET`
- `LOCAL_VISION_PROVIDER`
- `VISION_PROVIDER`
- `LOCAL_VISION_ENABLED`
- `LOCAL_VISION_ENDPOINT`
- `CUSTOM_VISION_ENDPOINT`
- `VISION_SHADOW_MODE`
- `VISION_HUMAN_REVIEW_REQUIRED`

No secret values may appear in UI, reports, logs, public assets or client bundles.

## Production Rules

- Production requires explicit provider configuration.
- Real inference requires a safe frame source and provider endpoint.
- Shadow mode creates internal review events only.
- Parents must not see raw AI events.
- AI may recommend review, never determine blame or regulatory outcome.
- No audio processing in Gan Batuach Israel Mode.
- No face recognition in Gan Batuach Israel Mode.
- Legal-review-required capabilities remain disabled unless a separate approved workflow exists.
- Digital Observer can have separate capability decisions, but broader capabilities must not leak into Gan Batuach.

## Frame Source Rules

Supported sources:

- Camera gateway frame snapshot.
- Secure test frame.
- Uploaded test clip where access-controlled.
- Digital Observer site stream.
- Mock frame source.

Frame source must:

- Run server-side or trusted worker-side.
- Never expose RTSP credentials.
- Respect product context.
- Avoid unnecessary raw frame storage.
- Use private storage if a frame is retained.
- Log access without secrets.
- Fail safely if gateway is unavailable.

## Event Wording Rules

Allowed wording:

- suspected
- candidate event
- requires review
- human review required
- motion anomaly
- zone anomaly
- camera health issue

Forbidden wording:

- abuse detected
- violence confirmed
- neglect confirmed
- criminal event detected
- automatic violation
- confirmed guilt

## Current Status

Current AI mode: mock/shadow readiness.

Real frame source: not connected.

Real inference: false.

Production AI: blocked.

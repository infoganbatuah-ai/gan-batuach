# PILOT FIX 7 - AI Secret / Evidence Exposure Audit

## Audit Scope

Searched AI routes, dashboards, components, domain helpers, migrations, and `.env.example` for provider keys, inference endpoints, raw frames, evidence URLs, confidence exposure, parent visibility, face/audio capabilities, and raw AI wording.

## Results

- No actual AI provider secret values were printed or documented.
- `.env.example` lists AI variable names only. No real key values were found there.
- `AI_PROVIDER_API_KEY`, `AI_WEBHOOK_SECRET`, and related variables are referenced server-side as environment names.
- Parent-facing AI page selects only approved metadata summaries and does not expose confidence scores or raw evidence.
- PILOT FIX 7 removed parent broad `ai_events:read` permission from `lib/roles.ts`, reducing generic API exposure risk.
- Admin/internal review components may show confidence scores to authorized internal users; this remains internal and must be policy-scoped.
- Raw frame persistence is explicitly blocked in the pilot shadow calibration migration (`raw_frame_persisted = false`, `raw_frame_logged = false`).

## Open Risks

- Manual Supabase/RLS verification is still required to prove database-level denial for parent/staff/unassigned inspector raw AI access.
- Some historical migrations and internal labels contain event keys such as `violence_indicator`; UI wording was softened where active labels are used, but event type keys remain for compatibility.

Critical exposure found: no


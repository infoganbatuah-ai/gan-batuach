# PILOT FIX 7 - Admin AI Operations Validation

## Admin May See

- Provider mode
- Shadow/live state
- Event counts
- Review queue status
- False positive / false negative stats
- Model version where available
- Camera linkage status
- Legal mode status
- Restricted capabilities
- Redacted provider errors and missing environment variable names

## Admin Must Not See

- AI provider API keys
- Webhook secrets
- Unrestricted raw evidence links
- Unredacted sensitive payloads
- Child data outside operational need

## Current Result

Admin surfaces are operational/readiness-oriented. No provider secret values were found in UI code. Confidence and diagnostics are internal/admin-facing, not parent-facing.

Remaining requirement: formal audit logging for all AI settings changes and provider diagnostics views must be verified against real Supabase.


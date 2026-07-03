# PILOT FIX 7 - Legal Mode / Restricted Capability Enforcement

## Gan Batuach Israel Mode

Restricted capabilities remain disabled or legal-review-required.

## Disabled / Restricted

- Audio analytics
- Speech recognition
- Keyword detection
- Face recognition
- Face matching
- Biometric child profile
- Persistent identity tracking
- Gait recognition unless legal-reviewed and disabled by default
- Raw AI parent alerts
- Automatic decisions
- Automatic accusations
- Unreviewed parent summaries

## Evidence

- `lib/domain/capability-policy-engine.ts` disables audio analytics, face recognition, face matching, child biometric profiles, raw AI parent visibility, automatic AI accusations, and automatic disciplinary actions for Gan Batuach.
- `lib/domain/ai-provider-guardrails.ts` sets `audioAllowedForGanBatuach: false`, `faceRecognitionAllowedForGanBatuach: false`, and `automaticAccusationsAllowed: false`.
- Audio event creation calls `assertCapabilityEnabled(..., "gan_batuach", "audio_analytics")`, so Gan Batuach audio analytics fails closed without legal/provider approval.

## Remaining Gate

Manual review of database capability decision rows is required before real pilot.


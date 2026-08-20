# Gan Batuach - Final Blocker Register

Date: 2026-08-20

| ID | Severity | Area | Status | Blocks | Required action | Owner |
|---|---|---|---|---|---|---|
| STORAGE-01 | Critical | Camera snapshots | CLOSED | none in synthetic Web QA; live camera work remains separately gated | migration applied; sentinel list/download denied to 9/9 browser roles; cleanup PASS | Daniel / Supabase / Codex |
| AUTH-01 | Critical | Assigned inspector routing | CLOSED | none | assigned inspector reaches control center; unassigned inspector reaches apply; desktop/mobile evidence stored | Codex |
| CORE-07 | High | Manager/parent onboarding reality | CLOSED | none in synthetic Web QA | continuous manager setup, 14-day trial readiness and mutual-consent child enrollment implemented | Codex |
| ENV-01 | High | Environment | EXTERNAL_SETUP | all real child/parent data | separate Pilot Supabase/Vercel and secrets | Daniel / infra |
| OPS-01 | High | Operations | MANUAL_REQUIRED | real users | assign support, privacy, rollback, camera, AI, payment owners | Daniel |
| LEG-01 | High | Legal/privacy | EXTERNAL_REVIEW | real child data; camera/AI/payment | review/approve temporary documents and scope | Daniel / reviewer |
| PAY-01 | High | Payment/invoice | PROVIDER_REQUIRED | live billing | select providers, Sandbox E2E, accounting mapping | Daniel / finance |
| MSG-01 | High | External notifications | PROVIDER_REQUIRED | production email/SMS/WhatsApp/push | accounts, consent, allow-list, callbacks, wrong-recipient QA | Daniel / providers |
| CAM-01 | High | Camera Gateway | EXTERNAL_SETUP | live cameras and observer technology | deploy gateway, vault and Test hardware | Technical owner |
| AI-01 | High | AI Shadow | DEPENDENCY_BLOCKED | real AI observer | Gateway+model+metrics+retention+Human Review | AI owner |
| NATIVE-01 | Medium | Android/iOS | EXTERNAL_SETUP | native distribution only | Android SDK, Xcode, devices, push | Mobile owner |
| QA-01 | Medium | CI/quality | PARTIAL | scale/public launch | write-path CI, screenshot regression, accessibility | Engineering |
| OPS-02 | High | Reliability/security | PARTIAL | production operation | monitoring, backup/restore, load and external security review | Technical owner |

## Counts

- Critical open: 0.
- High open/external: 8.
- Medium: 2.
- Critical blockers closed in this round: 4, including the final assigned-inspector route inconsistency.

There is no code-only path to zero blockers because the remaining high items require external providers, hardware, legal decisions, named owners and environment setup.

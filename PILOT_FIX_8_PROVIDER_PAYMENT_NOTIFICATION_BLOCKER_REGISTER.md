# PILOT FIX 8 - Provider / Payment / Notification Blocker Register

Date: 2026-07-05

| ID | Blocker | Severity | Tags | Status | Pilot impact | Required closure |
|---|---|---:|---|---|---|---|
| PF8-001 | Live provider credentials and mode not verified in deployment | high | provider_required, external_setup_required | open | Blocks live payments/invoices/notifications | Daniel verifies Vercel/provider env and test mode. |
| PF8-002 | Real payment/invoice webhook events not replay-tested | high | webhook_required, idempotency_required | open | Blocks live provider mode | Run sandbox signed event, duplicate event, invalid signature test. |
| PF8-003 | External wrong-recipient notification tests not executed | high | manual_verification_required | open | Blocks email/SMS/WhatsApp/push to pilot users | Execute synthetic dataset notification tests. |
| PF8-004 | Legal/provider data sharing and notification consent not externally reviewed | high | legal_update_required | open | Blocks external sends/live billing | Legal/privacy review and final provider list. |
| PF8-005 | Dedicated kill-switch flag layer is partially mode-based, not fully explicit | medium | feature_flag_required | open | Allows manual/sandbox pilot, blocks scale | Add explicit env-backed flags before scale. |
| PF8-006 | Push real-device/native validation still required | medium | external_setup_required, manual_verification_required | open | Blocks push production use | Run native/mobile push test-device validation. |
| PF8-007 | Demo/freeze scheduler not verified in deployed environment | medium | manual_verification_required | open | Blocks scale automation | Verify cron/scheduler and manual fallback. |
| PF8-008 | Provider health status must be verified against actual deployment env | medium | manual_verification_required | open | Blocks live readiness claim | Review admin provider health in staging. |
| PF8-009 | RLS for payment/provider tables still requires real environment signoff | high | rls_required | open | Blocks real pilot with real billing data | Complete Pilot Fix 2 manual verification. |

Critical blockers found in this phase: 0.

High blockers remaining: 5.

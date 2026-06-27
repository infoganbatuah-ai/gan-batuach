# Final Pilot Blockers Register

Date: 2026-06-27

## Critical

| Finding | Impact | Required resolution |
|---|---|---|
| Supabase/RLS role isolation was not manually verified in the target Supabase project during QA 5. | Real parent/staff/inspector/kindergarten pilot cannot safely onboard real users. | Run live JWT/RLS negative tests for parent, manager, staff, inspector, admin, payment/provider tables and signed URL access. |
| Real camera gateway and real stream/token/audit flow were not proven. | Camera must not be exposed to real parents or staff. | Connect a test camera through the real gateway, verify short-lived tokens, audit logs, frozen/inactive garden restrictions and no RTSP/client credential exposure. |
| Real AI inference was not proven and legal safety review is incomplete. | AI must not be exposed as live decisioning or parent alerting. | Keep AI in mock/event-model/shadow readiness only; complete legal/security review and real inference tests before pilot exposure. |

## High

| Finding | Impact | Required resolution |
|---|---|---|
| Payment and invoice providers are readiness/sandbox-prepared but not real-provider tested. | Commercial pilot with live billing is blocked. | Configure sandbox credentials, signed webhooks and provider-specific signature validation; run idempotency/replay tests. |
| External notification providers are not production-ready. | Real email/SMS/WhatsApp/push should not be sent to users. | Configure approved test recipients, provider accounts, templates, callback URLs and delivery logging. |
| Demo/freeze scheduler requires target environment activation and verification. | Demo lifecycle may not run automatically. | Configure cron/scheduler and test expired demo freeze behavior against staging/pilot data. |
| Security headers/rate limiting remain production hardening follow-ups. | Public/auth/upload/provider abuse protection may rely on external controls. | Add or verify Vercel/WAF/Supabase rate limiting and security headers. |
| Privacy/legal consent notices require final review. | Real child/camera/AI/staff-document processing may lack final legal sign-off. | Finalize terms, privacy, camera, AI, retention and deletion notices. |

## Medium

| Finding | Impact | Required resolution |
|---|---|---|
| Visual/manual QA still required on real pilot devices. | Mobile pilot friction may appear on older devices. | Run real-device smoke tests for parent, manager, staff, inspector and admin flows. |
| Support and incident ownership must be staffed for pilot. | Real users may not have a reliable escalation path. | Assign owner, response SLA and admin incident workflow. |
| Push requires real device tokens. | Push cannot be validated from static/local QA only. | Perform Android/iOS/PWA device-token QA. |

## Low

| Finding | Impact | Required resolution |
|---|---|---|
| Some advanced modules remain readiness/provider-dependent. | Not blocking internal demo but should be hidden/disabled honestly. | Keep readiness labels and avoid live claims until configured. |

## Current Blocker Count

- Critical: 3
- High: 5
- Medium: 3
- Low: 1

## Pilot Safety Summary

Real kindergarten pilot with real child/staff/parent data is blocked until critical items are resolved.

Internal demo with synthetic users and no real providers/camera/AI is acceptable.

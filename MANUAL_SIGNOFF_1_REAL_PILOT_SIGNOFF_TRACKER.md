# MANUAL SIGNOFF 1 - Real Pilot Signoff Tracker

Date: 2026-07-12

## Status Legend

Allowed statuses: not_started, in_progress, signed_off, failed, blocked, not_applicable, needs_external_review, Daniel_risk_acceptance_required.

## Tracker

| Area | Signoff owner | Evidence required | Current status | Pass/fail result | Severity | Blocks real parent/child data | Blocks mobile/native only | Blocks external demo/store only | Next action |
|---|---|---|---|---|---:|---|---|---|---|
| Supabase/RLS real environment verification | Daniel / Supabase operator | Completed RLS result form, screenshots/sanitized SQL output, tester/date | not_started | pending | critical | yes | no | no | Run Supabase/RLS checklist in pilot project. |
| Legal/privacy/consent review | Lawyer/privacy reviewer or Daniel | External review record or signed risk acceptance | needs_external_review | pending | critical | yes | no | yes | Send legal package to reviewer or complete risk form. |
| Environment separation confirmation | Daniel / deployment owner | Supabase/Vercel project names, allowed/forbidden data, provider modes | not_started | pending | critical | yes | no | no | Complete environment signoff form. |
| Role-flow A/B access tests | QA/operator | Completed A/B test execution sheet with evidence | not_started | pending | high | yes | no | no | Run synthetic A/B tests after RLS dataset exists. |
| Support/incident owner assignment | Daniel | Named owners, contact paths, escalation and rollback owners | not_started | pending | high | yes | no | yes | Fill support/incident owner assignment. |
| Manual visual review | QA/operator | Completed viewport/screen checklist and screenshots | not_started | pending | medium | no | no | yes | Complete visual review sheet before external demo/store claims. |
| Native/mobile readiness if included | Mobile/operator | Cap sync, native build/device evidence, push status | not_applicable | pending | medium | no unless native pilot | yes | yes | Keep out of current pilot scope or run native validation. |
| Camera/AI lockdown confirmation | Product/security owner | Signed lockdown form and deployed config verification | not_started | pending | high | yes if camera/AI included | no | yes | Complete camera/AI lockdown signoff; keep disabled otherwise. |
| Provider/payment/notification mode confirmation | Provider/finance/operator | Signed provider mode form and deployed env verification | not_started | pending | high | yes if providers included | no | yes | Confirm manual/sandbox/in-app-only modes. |

## Current Overall Status

ready_for_Daniel_manual_execution.

No signoff is marked signed_off in this tracker yet.

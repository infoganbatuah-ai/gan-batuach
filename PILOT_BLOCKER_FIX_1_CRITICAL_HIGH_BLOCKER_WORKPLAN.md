# PILOT BLOCKER FIX 1 - Critical & High Blocker Workplan

Date: 2026-07-12

## Scope

Source: `PILOT_QA_1_FINAL_REAL_PILOT_BLOCKER_REGISTER.md`

Original blocker counts:

- Critical: 3
- High: 10

This phase does not launch a pilot, onboard real users, activate live providers, enable parent camera viewing, or enable live AI.

## Workplan

| Blocker ID | Source report | Severity | Module | Role(s) | Exact issue | Why it blocks real pilot | Required fix | Fix type | Safe fix possible now | Owner/action | Expected output |
|---|---|---:|---|---|---|---|---|---|---|---|---|
| PQA1-C01 | PILOT FIX 2 | critical | Supabase/RLS | all roles | Target Supabase RLS not manually verified | Real users may access cross-role/cross-tenant data if policies differ from assumptions | Run manual JWT/RLS tests in target pilot DB | manual verification | reduce now | Daniel / Supabase operator | Signoff package and pass/fail evidence |
| PQA1-C02 | PILOT FIX 3 | critical | Legal/privacy | parents, children, staff, managers | Legal/privacy/consent drafts not externally reviewed | Real child/parent data cannot be processed without signoff or explicit risk acceptance | Review or Daniel written acceptance | legal review | reduce now | Daniel / legal reviewer | Legal signoff package |
| PQA1-C03 | PILOT FIX 4 | critical | Environment separation | all roles | Demo/staging/pilot/production mapping not manually signed off | Demo and real pilot data could mix | Confirm environments, secrets, allowed data and rollback | environment setup | reduce now | Daniel / deployment owner | Environment closure checklist |
| PQA1-H01 | PILOT FIX 5 | high | Role flows | admin, manager, parent, staff, inspector | A/B role access proof not executed | Routes exist but access isolation is not proven with fixture data | Run synthetic E2E A/B role tests | manual verification | reduce now | QA/operator | A/B test checklist |
| PQA1-H02 | PILOT FIX 5 | high | Storage/documents | parents, staff, inspectors, managers | Private buckets and signed URL boundaries not proven | Sensitive documents could leak | Run storage and signed URL negative tests | manual verification | reduce now | Supabase/operator | Storage test checklist |
| PQA1-H03 | PILOT FIX 6 | high | Camera | parents, managers, inspectors, staff | Parent camera viewing blocked pending gates | Camera access is high-risk child privacy surface | Keep parent view disabled; verify token/audit before any viewing | config/manual verification | reduce now | Product/security | Camera closure review |
| PQA1-H04 | PILOT FIX 7 | high | AI | parents, managers, inspectors, admin | AI on real child data not signed off | Raw or automated AI could create privacy/safety/legal harm | Keep AI readiness/shadow synthetic only | config/manual verification | reduce now | Product/security | AI closure review |
| PQA1-H05 | PILOT FIX 8 | high | Payments/invoices | managers, admin | Live billing/webhooks not proven | Accidental charges or invoices possible | Keep manual/sandbox; test providers before live | config/manual verification | reduce now | Provider owner | Provider closure review |
| PQA1-H06 | PILOT FIX 8 | high | Notifications | parents, staff, managers, inspectors | Wrong-recipient tests not complete | External messages could leak child/user data | Keep in-app only; run recipient tests | manual verification | reduce now | QA/operator | Notification checklist |
| PQA1-H07 | PILOT FIX 1/4 | high | Support/incident | all pilot users | No named owner/contact confirmed | Real users need a support and incident path | Assign owners, support channel, incident log | operational owner | reduce now | Daniel | Support owner closure doc |
| PQA1-H08 | PILOT FIX 1/4/8 | high | Kill switches | all roles | High-risk disable switches not fully verified | Risky modules may not be quickly stoppable | Verify server-enforced switches | config/manual verification | reduce now | Engineering/operator | Kill-switch matrix |
| PQA1-H09 | PILOT FIX 6/7 | high | Camera/AI audit | admin, manager, inspector | Live camera/AI audit proof missing | No accountable trail for sensitive access | Keep live camera/AI disabled; verify audit before use | manual verification | reduce now | Security/operator | Audit closure review |
| PQA1-H10 | PILOT FIX 8 | high | Provider/legal | parents, managers, admin | Provider sharing/external sends need legal review | Payment/notification data sharing may exceed consent | Update/approve legal/provider docs | legal review | reduce now | Legal/provider owner | Provider legal signoff checklist |

## Result

No blocker can be fully closed without manual evidence or external review. This phase reduces the blocker set by producing executable closure packages and preserving safe defaults.

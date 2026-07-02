# PILOT FIX 4 – Environment Access Blocker Register

Date: 2026-07-03

| ID | Blocker | Severity | Classification | Current status | Required closure |
|---|---|---|---|---|---|
| PF4-001 | Supabase environment separation not manually confirmed | High | environment_required, manual_setup_required | open | Daniel must identify demo/staging/production Supabase projects |
| PF4-002 | Real Supabase RLS tests still require manual signoff | High | rls_required | open | Run PILOT FIX 2 manual verification plan in target pilot DB |
| PF4-003 | Legal/privacy docs are drafts, external review/signoff not complete | High | legal_required | open | Complete legal/privacy review or explicit owner acceptance |
| PF4-004 | Unified pilot feature flag enforcement not confirmed | High | feature_flag_required | open | Implement/verify server-enforced flags before real users |
| PF4-005 | Demo vs pilot data relies on partial schema markers | Medium | environment_required | open | Use existing `is_demo`/`demo_batch_id`; plan additive `pilot_id/environment_scope` if needed |
| PF4-006 | Access-control A/B dataset not yet created | Medium | seed_required, account_required | open | Create synthetic accounts/data in non-production environment |
| PF4-007 | Capacitor sync required after responsive layout changes | Medium | capacitor_sync_required | open | Run `npx cap sync` before next native/mobile validation |
| PF4-008 | Manual visual review still required from Responsive QA 2 | Medium | visual_review_required | open | Capture screenshots/manual QA before external demo/store claims |
| PF4-009 | No real pilot support/environment owner confirmed in this phase | Medium | manual_setup_required | open | Assign support, incident and rollback owner |

## Critical Blockers

No new critical blocker was found in static checks, but real pilot remains blocked until high blockers close.


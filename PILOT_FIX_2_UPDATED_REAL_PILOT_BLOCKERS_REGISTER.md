# PILOT FIX 2 - Updated Real Pilot Blockers Register

Date: 2026-06-27

## Security/RLS Blocker Update

| Blocker | Previous status | PILOT FIX 2 status | Severity | Blocks real pilot | Notes |
| --- | --- | --- | --- | --- | --- |
| Build/runtime baseline | open | closed for this phase | low | no | Typecheck/build/diff passed locally. |
| Supabase target environment verification | critical | still open | critical | yes | No live Supabase CLI/DB access from workspace. |
| Migration remote status | critical | manual verification required | critical | yes | Local migrations present; remote application unverified. |
| Parent/child isolation | critical | manual verification required | critical | yes | Parent hardening migration exists locally, but Parent A/B negative tests not run live. |
| Manager own-kindergarten boundary | critical | manual verification required | critical | yes | Needs Manager A vs Kindergarten B live test. |
| Staff assignment boundary | critical | manual verification required | critical | yes | Needs unassigned/pending/assigned tests. |
| Inspector assignment boundary | critical | manual verification required | critical | yes | Needs unassigned/assigned tests. |
| Sensitive document/storage access | critical | manual verification required | critical | yes | Bucket privacy and signed URL denial tests required. |
| Payment/provider RLS | critical | manual verification required | critical | yes | Payment RLS migration present locally; live tests required. |
| Camera credential/token security | critical | manual verification required | critical if camera included | yes if camera included | Code has token checks; live payload tests required. |
| AI raw parent visibility | critical | manual verification required | critical if AI included | yes if AI included | Parent raw AI denial must be proven. |
| Digital Observer separation | critical | manual verification required | critical | yes | Cross-product negative tests required. |
| API route ownership checks | high | manual verification required | high | yes | Static review found reliance on RLS for generic CRUD/object ownership. |
| Legal/privacy/consent | critical | unchanged | critical | yes | Next phase should address docs/consent. |
| Environment separation | high | unchanged | high | yes | Pilot/staging environment still needs explicit setup. |

## Current Recommendation

Security/RLS gate is not closed.

Recommended next status:

`REAL_PILOT_BLOCKED_UNTIL_SUPABASE_MANUAL_SIGNOFF`


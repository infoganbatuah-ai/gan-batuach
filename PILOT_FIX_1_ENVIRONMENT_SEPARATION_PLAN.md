# PILOT FIX 1 - Environment Separation Plan

Date: 2026-06-27

## Required Environments

### Local Development

- purpose: engineering only
- data allowed: fake/local only
- providers: disabled/mock
- camera: disabled/mock
- AI: mock/readiness
- secrets: local only, never committed
- rollback: reset local data

### Demo / Internal RC

- purpose: founder/investor/stakeholder synthetic demo
- data allowed: synthetic only
- users allowed: internal/demo accounts
- providers: disabled/mock/sandbox only
- camera: readiness only
- AI: readiness/shadow only
- Supabase: separate demo project preferred
- Vercel: protected demo deployment preferred
- rollback: disable deployment/accounts

### Staging / Pilot

- purpose: real pilot preparation and limited real pilot after gates
- data allowed: limited real pilot data only after approval
- users allowed: approved pilot users only
- providers: manual/sandbox unless explicitly approved
- camera: disabled or internal-only until legal/gateway gates pass
- AI: shadow only until legal/security gates pass
- Supabase: separate staging/pilot project required
- Vercel: staging/pilot deployment required
- rollback: suspend users, disable feature flags, provider disable

### Production

- purpose: post-pilot production
- data allowed: real production data only after full approval
- providers: live only after provider QA
- camera: only after policy/security approval
- AI: only after legal/security/accuracy approval
- rollback: incident plan and kill switches

## Current Status

environment_separation_required = true

If only one Supabase/Vercel environment is currently active, real pilot remains blocked.

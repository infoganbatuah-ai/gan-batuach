# PILOT FIX 4 – Environment Separation Policy

Date: 2026-07-03

## Purpose

Prevent mixing internal demo data, synthetic QA data, controlled pilot data and future production data.

## Local Development

- Developers only.
- Synthetic data only.
- Mock/sandbox providers only.
- No real child data.
- No real parent data.
- No live camera.
- No live AI.
- No live payments.
- Service-role keys may be used only by local server/admin scripts, never client code.

## Internal Demo

- Audience: founder/team/investor/stakeholder demo.
- Synthetic data only.
- Demo banners required.
- No real child data.
- No real parent data.
- No real camera parent viewing.
- No live AI conclusions.
- No live payments unless Daniel explicitly approves a controlled provider test.
- Screenshots must use synthetic records only.

## Staging / Pilot

- Limited real kindergarten only after gates pass.
- Limited real users only after legal/RLS signoff.
- Feature flags required.
- Parent camera viewing disabled by default.
- AI shadow mode only by default.
- Payment mode manual/sandbox unless provider/legal approval is complete.
- Support/incident plan required.
- Supabase project must be confirmed as pilot/staging, not demo and not production.

## Production

Production is not approved now.

Requires:

- all pilot gates
- external legal/privacy review
- real Supabase RLS verification
- provider setup
- monitoring
- rollback and kill switches
- support owner

## Absolute Rules

- Never seed demo/test data into production.
- Never import real child/parent data into demo.
- Never use production secrets in local/demo.
- Never enable parent camera viewing by default.
- Never expose raw AI to parents.
- Never store or commit passwords, keystores, certificates, service-role keys or provider secrets.


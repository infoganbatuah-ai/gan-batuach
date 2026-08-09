# DEMO AUTH SETUP 1 - Credentials Handling Plan

Rules:

- Do not commit passwords to git.
- Do not print passwords in QA reports.
- Do not put credentials in public assets or frontend bundles.
- Do not use real user passwords.
- Do not use real parent/child accounts.
- Store local QA credentials only in ignored local files, such as `.env.qa-demo.local`.
- Commit only placeholder examples, such as `.env.qa-demo.example`.
- Daniel may enter credentials manually in the browser.
- QA reports may record "password provided manually" but must not list the value.

## Files

| File | Purpose | Secret values allowed |
|---|---|---|
| `.env.qa-demo.example` | Committed placeholder example | no |
| `.env.qa-demo.local` | Ignored local credential file for Daniel/Codex environment | yes, local only |
| `DEMO_AUTH_SETUP_1_*.md` | QA/setup reports | no |

## Existing Seed Output Fix

`scripts/seed-demo-full.mjs` no longer prints demo passwords in its completion table. It prints only email and "password not printed".

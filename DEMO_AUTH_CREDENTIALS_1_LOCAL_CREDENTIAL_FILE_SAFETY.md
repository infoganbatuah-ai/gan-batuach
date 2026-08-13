# DEMO AUTH CREDENTIALS 1 - Local Credential File Safety

## Status

| Check | Result |
|---|---|
| `.env.qa-demo.example` exists | yes |
| `.env.qa-demo.local` exists | yes |
| `.env.qa-demo.local` ignored by git | yes, covered by `.gitignore` rule `.env.*` |
| `.env.qa-demo.example` tracked/trackable | yes, explicit `.gitignore` exception exists |
| Real credential values printed | never |
| Credential risk found | no committed credential file found |

## Daniel Action Required

Daniel has created the local-only file. It must remain uncommitted.

Only demo/synthetic QA credentials should be kept in `.env.qa-demo.local`.

Do not commit `.env.qa-demo.local`. Do not use real parent, child, staff, inspector, admin or Digital Observer users.

## What Daniel Must Fill

- No role password is currently missing by variable name.
- Supabase URL and service-role key only if Daniel wants Codex to run the optional server-side setup script.
- Optional email overrides if Daniel wants different test emails.

No passwords should be pasted into QA reports.

## Latest Local Completion

After Daniel asked to use the same password for missing QA users, the missing local password variables were completed in `.env.qa-demo.local` without printing values:

- Parent unassigned
- Staff unassigned
- Inspector unassigned
- Digital Observer

The file remains ignored by git.

# DEMO AUTH SETUP 1 - Safe Fixes Applied

| File | Change | Why | Safety note | Production effect | Manual follow-up |
|---|---|---|---|---|---|
| `app/api/auth/logout/route.ts` | Added GET logout that signs out and redirects to `/login`. | Browser-based QA session switching failed when opening `/api/auth/logout`. | Uses normal Supabase `signOut`; no auth bypass, no impersonation, no RLS change. | Safe logout behavior only. | Use between role logins. |
| `scripts/seed-demo-full.mjs` | Completion table no longer prints demo passwords. | Prevent accidental password exposure in terminal/logs. | Does not change seeded credentials, only output. | Safer demo script output. | Daniel should still rotate demo passwords if logs previously captured them externally. |
| `package.json` | Added `qa:create-demo-role-users`. | Provides a single safe command for missing synthetic QA accounts. | Server-side only, requires local env confirmation/passwords. | None unless manually run. | Daniel/Codex can run after credentials are provided. |
| `.gitignore` | Added exception for `.env.qa-demo.example`. | Allows committing a placeholder example while real `.env.*` files stay ignored. | No secrets in example. | None. | Use `.env.qa-demo.local` for local secrets. |
| `.env.qa-demo.example` | Added placeholder-only credential template. | Gives Daniel a safe way to prepare local QA credentials. | Contains no passwords or real secrets. | None. | Copy locally and fill outside git. |
| `scripts/qa/create-demo-role-users.mjs` | Added guarded optional QA setup script. | Creates missing synthetic users safely when local credentials are supplied. | Refuses production, requires confirmation, does not print passwords, does not use client service role. | None unless manually run in safe env. | Needs Daniel/local env values. |

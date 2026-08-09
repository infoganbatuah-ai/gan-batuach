# DEMO AUTH SETUP 1 - Safe Auth Access Strategy

## Chosen Strategy

Use normal Supabase authentication only:

1. Manual login per role with Daniel-provided demo credentials, or credentials stored in an ignored local env file.
2. Use `/api/auth/logout` between role sessions. This route now supports both POST and GET sign-out.
3. Use separate browser profiles/incognito contexts if cookies persist.
4. Use the optional server-side script `npm run qa:create-demo-role-users` only to create synthetic QA accounts in local/demo/staging/pilot environments.

## Why This Strategy

- It does not bypass Supabase auth.
- It does not set arbitrary user IDs in the browser.
- It does not expose service role keys to the client.
- It does not disable or weaken RLS.
- It keeps passwords out of committed files and reports.

## Forbidden Strategies Rejected

- Production backdoor: rejected.
- Client-side service role: rejected.
- Hardcoded passwords in new code/docs: rejected.
- Client impersonation: rejected.
- RLS disabling: rejected.
- Real users or real child/parent data: rejected.

## Readiness

This setup is ready for manual credentials or the safe setup script. It is not a completed all-role login proof until credentials are provided and each role is logged in.

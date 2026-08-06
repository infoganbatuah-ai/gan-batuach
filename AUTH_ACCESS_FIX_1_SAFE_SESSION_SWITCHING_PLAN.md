# AUTH ACCESS FIX 1 - Safe Session Switching Plan

## Decision

Use normal Supabase auth only. Do not implement or use auth bypass.

## Allowed QA 2 Session Switching Methods

1. Manual logout/login per role using the visible dashboard `התנתקות` button.
2. Separate browser profiles, one per role.
3. Separate private/incognito windows, one per role.
4. Playwright/browser contexts only if they enter credentials through the normal login form.
5. Local-only ignored credential file for automation, if Daniel creates it outside git.

## Forbidden Methods

- Production auth bypass.
- Hardcoded passwords in client code.
- Service role in browser/client code.
- Setting arbitrary user id client-side.
- Disabling RLS.
- Hidden impersonation/backdoor route.

## Existing Logout Status

The app already has `LogoutButton`, which posts to `/api/auth/logout` and redirects to `/login`. This is the preferred session reset path for QA 2.

## QA 2 Recommended Flow

For each role:

1. Open `/login`.
2. If already logged in, click `התנתקות`.
3. Log in with that role's demo credentials.
4. Confirm the expected dashboard route.
5. Capture screenshots and test buttons.
6. Log out before the next role.


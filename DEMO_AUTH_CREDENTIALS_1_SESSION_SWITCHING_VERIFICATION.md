# DEMO AUTH CREDENTIALS 1 - Session Switching Verification

## Verified By Code/Build

`/api/auth/logout` supports:

- `POST` logout for app buttons;
- `GET` logout for direct browser navigation.

Opening `/api/auth/logout` should clear the current Supabase session and redirect to `/login`.

## Runtime Test

Not executed in this phase because no local credentials are available to log into multiple roles.

| Check | Result |
|---|---|
| Logout route exists | PASS |
| GET logout implemented | PASS |
| POST logout preserved | PASS |
| User logged out at runtime | MANUAL_REQUIRED |
| Next role login confirmed | BLOCKED_MISSING_CREDENTIALS |
| Previous role data not visible | BLOCKED_MISSING_CREDENTIALS |
| Incognito/profile fallback documented | PASS |

## QA 3 Instruction

Use `/api/auth/logout` between every role. If the browser still keeps the old user, use incognito or a separate browser profile.

# AUTHED UX QA 1 - Authenticated Access Plan

## Access Options Reviewed

| Option | Status | QA decision |
|---|---|---|
| Existing authenticated session | available for Parent only | used |
| Existing demo credentials | found in seed scripts | not printed; not used for all roles due session switching/logout issue |
| Local seeded test users | available as script pattern | not run; can modify Supabase/users |
| Supabase test users | possible | requires controlled credentials/environment confirmation |
| Test-mode bypass | not used | unsafe unless already production-gated and explicitly verified |
| Manual login by Daniel | recommended next step | needed for remaining role dashboard QA |

## Executed During This QA

- Parent dashboard session was already authenticated and was validated across routes/viewports.
- Screenshot evidence was captured under:
  `/Users/danielderi/Desktop/text-web-ai-1-rtl-2/qa-evidence/authed-ux-ui-qa-1`

## Blocked During This QA

The browser automation could not safely switch from the active Parent session to Manager, Staff, Inspector, Admin, or Digital Observer. Logout/session reset was not reliably accessible through the tested UI/API path.

## Required Next Access Plan

Before re-running authenticated dashboard acceptance:

1. Provide safe demo login credentials for each role, or prepare one browser profile/session per role.
2. Confirm a visible and working logout/switch-user control in the app shell.
3. Confirm Digital Observer demo/admin user, if that product is in pilot scope.
4. Do not create auth bypasses or production backdoors.


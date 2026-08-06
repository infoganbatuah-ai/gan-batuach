# AUTH ACCESS FIX 1 - QA Login Helper Decision

## Decision

`NOT_IMPLEMENTED`

## Reason

A QA login helper could be useful, but adding one now risks creating a production backdoor or confusing pilot-safe auth behavior unless it is designed, reviewed, and guarded carefully.

## Existing Safe Alternative

- Normal login form exists.
- `LogoutButton` exists in app shells.
- `/api/auth/logout` exists for POST logout.
- Demo users are defined in seed scripts.
- QA 2 can use isolated browser sessions or manual role login.

## Future Helper Requirements If Needed

If implemented later, it must:

- be gated by explicit QA/demo environment variable;
- never include passwords;
- never bypass Supabase auth/RLS;
- never expose service role;
- never be linked from production UI;
- only prefill/select demo email or open login instructions;
- be disabled in production builds/environments.


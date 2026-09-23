# Gan Batuach Production legacy credential remediation plan

Date: 2026-09-23  
Production inspection mode: read-only  
Secret values selected or printed: **no**

## Release gate

Migration `20260920170000_retire_generated_plaintext_credentials.sql` drops `generated_credentials.temporary_password`. It must not run until every legitimate account below has canonical recovery proof and the release operator records `LEGACY CREDENTIAL REMEDIATION COMPLETE`.

The current Development application has **0 active runtime reads** of `temporary_password` for authentication, invitations, display or delivery. The remaining column references are historical schema/template metadata and the forward-only drop migration.

## Production inventory

- Populated legacy records: **23**.
- Canonical Auth identity present: **23/23**.
- Email present and verified: **23/23**.
- Profile/Auth active: **23/23**.
- Canonical recovery available: **23/23**.
- Password-change proof: **0/23**.
- Prior reset-delivery proof: **0/23**.
- Recent Auth activity present: **6/23**; this does not prove the password differs from the recoverable legacy value.
- Classification: **22 `REQUIRES_USER_RECOVERY`**, **1 `SYNTHETIC_QA`**, 0 orphaned, 0 unknown, 0 safe-to-purge today.

The 22 account roles are 10 manager, 3 owner, 2 inspector, 1 parent and 6 staff. The synthetic record is an Admin QA identity. Garden and relationship checks found canonical manager/owner, Parent, employment and Inspector associations; no row is safe to discard merely because a legacy profile Garden field is empty.

## Redacted record references

The first value is a one-way truncated reference for the credential row; the second is the same form for its account. They are evidence correlation identifiers, not database IDs and cannot be used to authenticate.

| Credential ref | Account ref | Classification |
|---|---|---|
| `ffb177a30170` | `6c00ff8406da` | REQUIRES_USER_RECOVERY |
| `a66c334a0b2e` | `5cdf5cdd91e1` | REQUIRES_USER_RECOVERY |
| `4f9a68ed3867` | `d836b85be4a8` | REQUIRES_USER_RECOVERY |
| `67e228b05a43` | `05961264b6e7` | REQUIRES_USER_RECOVERY |
| `5b398c7ad910` | `8ce39fa8e592` | REQUIRES_USER_RECOVERY |
| `63fcb5172df7` | `72e893d41182` | REQUIRES_USER_RECOVERY |
| `09842a27be89` | `af286dc9dbf9` | SYNTHETIC_QA |
| `e4ff2c35998a` | `e7b9749673e8` | REQUIRES_USER_RECOVERY |
| `ddeb09577815` | `0bc1502c97f5` | REQUIRES_USER_RECOVERY |
| `adb2508f260c` | `fcbd331be7dd` | REQUIRES_USER_RECOVERY |
| `c4343475fcc4` | `de996595d75c` | REQUIRES_USER_RECOVERY |
| `5408d3d033bc` | `6c825111dd0e` | REQUIRES_USER_RECOVERY |
| `111e2ddabc62` | `01fbda421ea1` | REQUIRES_USER_RECOVERY |
| `980e3fb5356d` | `52ce105ec260` | REQUIRES_USER_RECOVERY |
| `a06b91b98117` | `e3817eb9128d` | REQUIRES_USER_RECOVERY |
| `f2cb2f1a3c26` | `6f316447ec84` | REQUIRES_USER_RECOVERY |
| `a9457cd56016` | `7a8d8c5fb398` | REQUIRES_USER_RECOVERY |
| `3126c025e771` | `b060db55c11c` | REQUIRES_USER_RECOVERY |
| `d74bcccab1c7` | `765545b583b9` | REQUIRES_USER_RECOVERY |
| `d0fa6b74565d` | `383edc6d66f8` | REQUIRES_USER_RECOVERY |
| `75c8ca2c2bb9` | `9615edc21779` | REQUIRES_USER_RECOVERY |
| `41041325d1c0` | `4da34aafbe0b` | REQUIRES_USER_RECOVERY |
| `656e36cca85b` | `30680d451bf4` | REQUIRES_USER_RECOVERY |

## Required pre-release action

1. Owner approves the recovery/customer-communication plan for the 22 legitimate accounts and the separate cleanup treatment for the one synthetic QA account.
2. In a later explicitly authorized Production operation, issue canonical Supabase Auth recovery links to controlled recipients. Never send or reveal the old password.
3. Require successful recovery or another independently verified canonical credential for each legitimate account. An Email address or historical login alone is insufficient evidence.
4. Record only recovery completion time/result and the redacted correlation reference. Do not store reset links, tokens or new passwords.
5. Re-run the read-only inventory. The eligible state is: 0 legitimate rows without recovery proof, no active plaintext runtime dependency, and all 23 rows classified as recovered, approved synthetic cleanup, or owner-approved orphan handling.
6. Take and verify the release backup. Then authorize migration phase 2.

## Release action

After migrations 1–11 and the new application deployment, assert `LEGACY CREDENTIAL REMEDIATION COMPLETE`. Apply migration 12 once, verify the column is absent and the new application can authenticate the controlled smoke identities, then continue migrations 13–16. Do not roll the old application back after this boundary.

## Post-release verification

- Recovery/login works for controlled Owner, Parent, Staff and Inspector identities.
- No API, UI, log or template returns a password.
- `temporary_password` is absent; no compatibility view recreates it.
- Invitation issuance remains signed, recipient-bound, expiring and replay-controlled.

## Rehearsal

`npm run qa:management-credential-remediation` covered active/inactive, verified/unverified, orphaned, synthetic and already-recovered fixtures. It proved that unresolved legitimate accounts block phase 2 and that all-legitimate recovery proof unlocks the irreversible drop. The canonical credential-retirement regression also passed.

## Recovery considerations

Before migration 12, abort and keep the old application/schema if recovery is incomplete. After migration 12, use the new application and a forward fix; restore the database only for demonstrated corruption under the release incident procedure. Restoring the database also requires reconciling Auth and Storage state at the same recovery point.

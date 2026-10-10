# GB-M35 temporary credential P1 — scoped security repair

## Finding

Legacy Admin/Garden creation and reset routes generated reusable temporary passwords, stored them in `public.generated_credentials.temporary_password`, and returned or displayed them later. Historical credential metadata is retained; the recoverable secret is not needed for audit.

## Repair

- New legacy-route accounts receive a Supabase Auth Email invitation. Email is required. The recipient verifies the address by following the signed Auth link. The API returns only the account address.
- Manual password regeneration/reset through the Admin route is retired. Existing users use Supabase Auth recovery Email. Existing Auth accounts and password hashes are not changed by this repair.
- Admin and Garden pages no longer query, render, or copy temporary passwords. Mock notification payloads no longer carry password fields.
- The demo seeder no longer writes `generated_credentials` secrets. Both legacy seeders require an explicit QA flag and a loopback database endpoint.
- Forward-only migration `20260920170000_retire_generated_plaintext_credentials.sql` removes the plaintext column and restricts ordinary access to non-secret history. It does not touch Production in GB-M35. Production backups containing the old column require a separate retention/security review at owner-authorized release.

## Isolated QA evidence

The migration applied to the disposable Supabase/Auth QA clone. Column existence after migration: 0. Historical credential rows in that synthetic clone: 0. A synthetic Admin created an Inspector through the Product API; Mailpit captured the Auth invitation; Auth showed Email unverified before following the link and verified afterward. The response contained no password. The synthetic user was deleted after the test. An unauthenticated creation request returned 401.

Focused credential-retirement test, six Auth/invitation/hiring suites (39 tests), manager/parent contract (20 tests), security gate (7 suites), migration audit, typecheck, lint regression, and release-contract preflight passed. The separate PR's exact-head CI must still finish before this P1 is declared closed. No real Email provider, customer account, or Production database was used.

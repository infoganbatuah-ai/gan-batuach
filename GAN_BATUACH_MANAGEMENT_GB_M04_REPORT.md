# GB-M04 — Email, mobile verification and account recovery

## Status and sequence

Implementation complete on the branch derived from GB-M03. The repository's canonical post-audit roadmap remains authoritative: GB-M04 is contact verification and recovery; signed invitations are GB-M05–06 and canonical parent-child linking is GB-M07. Sol was selected for this identity-sensitive Management change.

## Result

New self-service accounts now enter an explicit contact-verification contract. Registration uses Supabase signup with a confirmation callback instead of silently creating an unconfirmed Admin user without sending a link. The account is marked `contact_verification_required`, remains inactive, and continues to `/app/verify-contact`.

The verification journey provides:

- non-enumerating email confirmation resend;
- authenticated Israeli mobile normalization and OTP request;
- server-side `phone_change` OTP confirmation;
- masked email and phone status;
- routing from signup confirmation and login to the incomplete verification step;
- the existing non-enumerating, single-use Supabase password recovery flow.

Supabase Auth confirmation timestamps are the source of truth. An additive database trigger mirrors email and phone timestamps to the Management profile and self-service verification status for authorization and operational reporting. OTP values are never stored in Management tables.

## Authorization and activation

Accounts enrolled in GB-M04 require both verified email and verified mobile before operational access. The common operational-role guard fails closed before role lifecycle or tenant work. The same rule protects the activation boundaries for:

- kindergarten trial activation;
- parent enrollment request and enrollment activation;
- staff application approval and direct staff approval;
- inspector application approval.

Existing accounts are preserved through `contact_verification_required = false` by default. Only new self-service registration opts in. Manager/admin-created legacy invitation accounts keep their current behavior until the signed invitation lifecycle in GB-M05–06 replaces temporary credential flows.

## Data migration

`20260908010000_management_contact_verification.sql` adds three profile fields, backfills existing Auth confirmation timestamps, and installs a narrowly scoped Auth update trigger. It does not guess verification, enroll legacy users, activate accounts, or alter family/garden relationships. The trigger function cannot be called by public, anonymous or authenticated clients.

## Boundaries preserved

No Digital Observer core, camera, AI, billing, parent-child linking or shared Supabase client implementation was changed. No live provider was activated. Parent-child requirements received from the companion planning chat remain scheduled for GB-M07 after signed invitations.

## Validation

Validated with the unchanged committed dependency lock on Next.js 16.3.2.

| Check | Result |
|---|---|
| Management authorization and verification suites | PASS, 74/74 combined tests |
| GB-M04 verification and recovery contract | PASS, 8/8 tests |
| Typecheck | PASS |
| Lint baseline | PASS, 5,363 existing errors / 213 warnings, 0 regressions, canonical scope 0/0 |
| Management contract QA | PASS, 20/20 |
| Domain regression | PASS, 18/18 suites |
| Security regression | PASS, 7/7 suites |
| Migration health | PASS, 191 migrations, no duplicate timestamp; known allowed descriptive-name warning |
| Production build | PASS, 494 pages generated; live activation disabled |
| Patch/protected paths | PASS, no Digital Observer core or dependency changes |

The first sandboxed production build was blocked when Turbopack attempted to bind a local process port. The same unchanged build passed outside that sandbox restriction.

## External verification still required

No live Supabase Auth tenant or configured SMS provider was available in this checkout. Production evidence is still required for delivered email, delivered SMS, expired/reused OTP behavior, provider rate limits and end-to-end password recovery. The implementation reports provider failure as unavailable and does not claim successful delivery without provider acceptance.

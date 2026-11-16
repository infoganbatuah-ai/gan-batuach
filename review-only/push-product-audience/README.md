# PUSH 44 — offline product-audience boundary

The disconnected `lib/domain/push-registration-challenge.ts` module only
provides canonical challenge bytes and an **in-process test fixture** for
one-use nonce behavior. Its `verifiedVerdict` parameter is a synthetic test
assumption, not Apple App Attest, Google Play Integrity, APNs/FCM token
ownership, or durable cross-worker replay protection. The module is not called
by the live registration or sender paths. Run its focused tests with
`node --experimental-strip-types --test scripts/qa/check-push-registration-challenge.mjs`.
Real activation requires provider verification and atomic persistent nonce
consumption before any binding writer is connected.

This package is not activated. `schema-proposal.sql` is review-only and is **not**
in `supabase/migrations/`; it must not be applied by migration tooling. It proposes
a private, service-only binding table. Existing tokens are intentionally not
backfilled: `app_channel` records form factor, not the owning product.

`selectVerifiedPushTargets` accepts only an unexpired, unrevoked server-verified
binding to a supported native app ID and a matching product destination. Gan
Management's existing `camera_alert` → `camera` → `/dashboard/garden/cameras`
and `observer_alert` → `observer_event` → `/dashboard/garden/ai-events` templates
stay eligible for Gan subscribers. Standalone Observer alerts require an Observer
app destination. The exact category, deep-link type and relative destination must
all match; absent or cross-app destinations fail closed. It rejects
legacy/unqualified tokens, cross-profile bindings and cross-app links.
The focused test is `node scripts/qa/check-push-product-audience.mjs`.

## Concrete blocker before active routing

`app/api/push/register/route.ts` accepts caller metadata, and both native
products share it. That metadata cannot prove the package/bundle that owns an
FCM/APNs token. The Observer PersonalTeamQA shell has also used a Gan QA bundle
ID, so a name-based inference is specifically unsafe. The binding table has no
writer until a trusted native/app-provider proof is designed and verified.
`lib/domain/push-service.ts` and `lib/management/external-delivery.ts` still
select tokens without this boundary; they must not be treated as qualified
product-specific delivery. Do not enable real provider sends on this basis.

## Next scoped implementation

Establish a server-verifiable native app identity (and provider token ownership)
for each supported build, bind it to the authenticated profile and token in a
service-only transaction, then make *both* send paths require the binding and
destination policy before provider dispatch. Qualify the actual release bundle
IDs, provider credentials/topics, logout and revocation behavior before rollout.
No client-supplied app label, user metadata, or matching email is an authority.

Turning the proposal into a migration requires a separate authorized Development
database qualification, trusted binding writer, and token deletion/retention
review. No Production or live Push change is part of this work.

## SQL privilege and repeatability review

The existing token table is in `public` (`20260602005000_push_notifications_foundation.sql`);
the later `app_channel` field is platform/form factor
(`20260612013700_mobile_apps_push_app_store_readiness.sql`). The proposed
`push_private` schema is new in the inspected migration inventory. Schema and
table grants are explicitly revoked from `PUBLIC`, `anon`, and `authenticated`;
only `service_role` gets schema USAGE and table SELECT/INSERT/UPDATE. RLS is on,
with no client policy. This is source review, not deployed-catalog proof. A future
preflight must verify actual schema exposure and inherited/default privileges.

The proposal deliberately uses plain `CREATE` instead of `IF NOT EXISTS`, so a
preexisting incompatible object fails rather than silently masquerading as the
contract. It is not a repeatable bootstrap script or a deployable migration.
The token FK uses `ON DELETE RESTRICT` to avoid silently erasing binding evidence;
future token-retention/archival behavior needs qualification before application.
The primary key permits one binding per token but does not itself prove app
identity or make a future write API safe. No binding writer is implemented here.

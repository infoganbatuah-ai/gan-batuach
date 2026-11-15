# PUSH 44 — offline product-audience boundary

This package is not activated. The migration is additive, un-applied, and creates
a private, service-only binding table. Existing tokens are intentionally not
backfilled: `app_channel` records form factor, not the owning product.

`selectVerifiedPushTargets` accepts only an unexpired, unrevoked server-verified
binding to a supported native app ID and a matching product destination. It
rejects legacy/unqualified tokens, cross-profile bindings and cross-app links.
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

The migration requires a separate authorized Development application and
database qualification. No Production or live Push change is part of this work.

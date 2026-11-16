# Active Push sender binding gap — source-only receipt

Scope: local source and migration text only, 2026-11-16. No database query,
provider send, device change, schema mutation, remote publication or activation.

Two live code paths currently read active `public.push_device_tokens` by
`profile_id` and submit the returned token to a provider:

1. `lib/domain/push-service.ts` (`preparePushForNotification`) selects
   `id, platform, device_token, is_active` and sends each active token.
2. `lib/management/external-delivery.ts` (`decideDelivery`) selects
   `id, platform, device_token` and sends each active token when the provider
   is ready.

The registration entry point `app/api/push/register/route.ts` authenticates a
profile but accepts the platform, token, `device_id`, app version and arbitrary
metadata from the caller. `registerPushDevice` upserts them to the shared
table. The source-defined migrations provide `profile_id`, `platform`,
`app_channel`, `device_trust_status` and metadata, but no server-verified
product-audience binding. `app_channel` is a form factor, not an app identity.
The distinct Observer QA package is Push-disabled; that fact does not prove
that every preexisting token in the shared table belongs to Gan.

**No safe active-sender filter can be added on these facts alone.** Filtering
on metadata, email, profile, device ID, platform, token text, app channel or
trust status would treat caller-supplied or non-product data as authority.
Requiring the review-only binding proposal today would deny all legacy Gan
tokens because `push_private.device_product_bindings` has neither a deployed
migration nor a trusted writer. The offline `selectVerifiedPushTargets` cannot
be wired into either sender until trusted binding records exist.

The exact prerequisite is a server-verified, durable binding between the
authenticated profile, exact provider token hash, intended product audience,
allowlisted signed app identity, installation identity and bounded evidence.
Its creation must verify provider/app identity and exact token ownership,
consume a one-time challenge atomically, and support expiry, revocation,
refresh and logout. Only after an authorized Development schema qualification
and a trusted writer exist may both sender paths enforce that binding and
destination policy at dispatch time. Existing Gan tokens require an explicit
compatibility/reenrollment decision; they must not be silently reclassified.

Independent disconnected verification: 6 attestation/challenge tests and 5
product-audience tests passed on this checkout. These are synthetic policy
tests, not Apple/Google attestation, PostgreSQL durability or provider delivery.
No active sender code was changed because that would risk Gan delivery without
establishing a trustworthy Observer/Gan distinction.

# Home revocation fence for Risk persistence — review only

Status: **isolated PostgreSQL proof only; NOT APPLIED / NOT LIVE READY**.
This unit starts at `5234bf0e55019581b0f56cd6491a1f5c59c41f9e` and
adapts only the guarded Risk persist body from PR #258 at
`364672482f0f314fb672fbc0cd9549be9737fb74`. The pinned source hash is
checked by `adapt-home-risk-persist-fence.mjs`; a changed source fails closed.
The separate Home writer, frozen Incident binding and Risk claim remain the
ones already reviewed. No migration, route or live caller is added.

The original persist body checks the claim's nonce, epoch and lease after
locking Signal/Site/Incident/claim but does **not** recheck the registration
that permitted the claim. A revocation after claim acquisition could therefore
be missed. The candidate first reads acceptance to locate the registration,
locks `registration_identities FOR SHARE`, then re-reads immutable acceptance
and checks `revoked=false`, identical owner epoch and Tenant/Site/Source/owner.
It validates the qualified version, frozen binding and mandatory ACCEPTED/BOUND
audit receipts before the existing Signal→Site→organization→link→Incident→claim
sequence. After those locks, it compares claim and canonical Signal/Incident to
the same acceptance/binding and Model A owner. Full accepted Signal metadata
is compared to its frozen observation snapshot. No recipient/settings owner
is inferred here.

Lock order for the tested functions is:

1. Home acceptance/revocation: registration identity first; acceptance then
   Signal/Incident or revocation's current-scope rows.
2. Risk claim: registration identity, then Signal, Site, organization, Source,
   link, Incident and claim.
3. Adapted Risk persist: registration identity, then Signal, Site,
   organization, link, Incident and claim. Its early receipt reads acquire no
   row locks. A revocation of that registration cannot acquire its `FOR UPDATE`
   lock while persist holds `FOR SHARE`. Conversely, persist waits if
   revocation holds the identity. The disposable two-order race tests pass;
   this is not a proof against unknown live writers or lock-order drift.

The existing network-disabled, no-host-mount PostgreSQL runner now installs
the complete canonical Home acceptance candidate, frozen binding writer, real
guarded Risk claim body, source-shaped Risk table and adapted persist body in
one disposable schema. No Risk row is seeded manually. It tests a claim made
before revocation: revocation-first denies persist with zero Risk evaluation,
receipt or persistence audit; persist-first commits one of each, then
revocation blocks replay. A revoked but otherwise valid claim cannot create
a late Risk row. With a still-valid claim, missing/conflicting binding,
missing link, conflicting Incident membership and missing ACCEPTED/BOUND audit
all deny with no partial Risk result. Synthetic fixture roles and corruption
injections are not live permissions or evidence of a deployed schema.

Remaining gates: authoritative live Home owner/Auth/Gateway provenance and
caller ACL; deployed catalog/RLS and exact migration order; legacy receipt
reconciliation; actual immutable audit integrity and retention; effect writer
revocation fence; real crash/recovery and broader lock-graph proof. The effect
writer remains **BLOCKED**. Model A, Guard and active ingestion are unchanged.
This local-only candidate is not remotely preserved or eligible to apply.

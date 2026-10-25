# PUSH 43 delegated usage — future isolated PostgreSQL qualification

Status: **not run**. The forward-only source migration is
`supabase/migrations/20261025224109_digital_observer_push43_delegated_usage_scope.sql`.
The earlier `20261019041000` migration is already recorded as applied in
Development and must remain byte-for-byte unchanged. Neither this document nor
the local Node test proves PostgreSQL, RLS, concurrency, or deployed behavior.

Run only after separate authorization for the canonical isolated Development
database. Never run against Production or Home. First verify database identity,
the actual applied-migration history, current function definition/owner/ACL,
backup and restore path, and the exact pending migration order. Apply the
reviewed forward migration only in that future authorized sequence. Preserve
existing usage buckets; no truncation, reset, or history repair.

Use disposable synthetic partner and customer organizations, a separate direct
owner organization, one commercial Site, and isolated service accounts. Prepare
fixtures through a reviewed transaction or canonical Development provisioning
path; account for every foreign key and leave no fixture behind. Invoke the
actual RPC under the real server-side `service_role` context; verify `anon` and
`authenticated` cannot execute it. For each denied call verify the usage bucket
is unchanged, not merely that the RPC returned an error.

Required cases:

1. Active direct owner + its Site increments exactly one hourly bucket.
2. Direct owner + another organization's Site is denied.
3. Active sandbox partner + active partner/customer organizations + exact
   customer-owned, explicitly linked commercial Site increments one bucket.
4. Linked Site whose organization differs from the customer's is denied.
5. Suspended, revoked, or expired service account is denied.
6. Suspended partner or inactive partner organization is denied.
7. Suspended customer or inactive customer organization is denied.
8. Cross-partner customer, wrong service-account organization, wrong mapping
   access kind, missing Site link, or self-delegation is denied.
9. Kindergarten Site and any Site linked to a garden are denied on the delegated
   path, even if a stale customer-Site link exists.
10. A second valid call to the same hour increments the existing bucket without
    creating a second row; a denied call changes no count.

Afterward check the actual function signature, pinned search path, `service_role`
EXECUTE grant and absence of `PUBLIC`/`anon`/`authenticated` EXECUTE. Compare
remaining fixtures, buckets, audit evidence, and migration history to the
recorded baseline. Do not label the source-only checks as this database proof.

Rollback is compatibility-first: keep external API activation off. If the new
function fails before processing, use a reviewed forward correction or restore
the isolated backup. If delegated usage has begun, never restore the older
permissive body while that route remains enabled; disable the adapter first,
retain all existing buckets/receipts, then deploy a separately reviewed
corrective function. No automatic data deletion or privilege broadening.

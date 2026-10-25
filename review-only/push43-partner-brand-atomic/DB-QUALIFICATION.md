# PUSH 43 partner-brand atomic write — future PostgreSQL gate

Status: **source only, not applied, not qualified**. `forward.sql` begins with a
transaction-aborting review guard and is deliberately outside
`supabase/migrations/`. It must never be run against Production or Home. The
active `savePartnerBrand` service still uses separate reads, a brand write and
an audit insert; its synthetic tests do not close the ownership/write race.

## Existing contract and intended change

- Source schema: `20261019040000_digital_observer_push43_oem_sdk.sql` defines
  `digital_observer_partners.organization_id`, `partner_status`, and the
  `digital_observer_partner_brand_profiles.partner_id` primary/foreign key.
  The brand row has no organization column. The audit table is defined in
  `20261019020000_digital_observer_push41_enterprise_identity.sql`.
- No pre-existing atomic brand RPC was found in local source/migrations.
- Business need: a sandbox partner's authorized owner/admin may edit only its
  own public brand; domain verification must reset only when the domain
  changes. The data owner is the partner organization. Brand and audit are
  bounded transactional metadata, not media or customer data; existing
  retention applies. One indexed partner lookup, one brand primary-key lookup,
  one membership lookup where needed, one write, and one audit insert per edit.
- `forward.sql` is a proposed one-call transaction: lock active organization,
  lock its sandbox partner, lock an authorized membership when needed, lock the
  existing brand, compare `updated_at`, insert/update permitted fields, insert
  mandatory audit, return the row. Any error rolls back both writes. No
  platform-wide administrator authority is inferred from a supplied profile.
- The proposed public-schema function is `SECURITY INVOKER`, has an empty
  `search_path`, requires `auth.role() = service_role`, and explicitly revokes
  `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`. This is defense in depth;
  actual owner, grants, role inheritance, Data API exposure, and RLS behavior
  require catalog and role testing in the isolated Development database.
- The current `publicBrandProfile` response sanitizer remains in the service.
  Never return the raw RPC record to an untrusted client.

## Exact future sequence — not authorized by this task

1. Verify canonical isolated database identity, backup/restore readiness,
   applied migration order and actual table/function catalog. Confirm no
   conflicting RPC name/signature, triggers, unexpected grants or schema drift.
2. Convert the guarded candidate to a new ordered forward migration through
   the approved CLI workflow. Do not edit either already-applied PUSH 41/43
   migration. Review syntax, lock order, URL validation parity and RLS/ACL.
3. In a disposable isolated transaction, test real `service_role` invocation;
   verify `anon` and `authenticated` cannot execute, and a forged request role
   fails. Test direct owner/admin vs parent/foreign org and a suspended partner.
4. Test create, update, unchanged/changed/null customer domain, stale
   `expected_updated_at`, unknown system fields, empty/invalid notices and
   required URL values. Check persisted row and `publicBrandProfile` output.
5. Force audit insertion to fail in isolated QA and verify the brand row and
   timestamp are unchanged after rollback. Do not use Production triggers.
6. Race one connection changing `organization_id` or `partner_status` against
   another calling the RPC; confirm the row lock serializes them and a denied
   call leaves zero brand/audit writes. Also race brand CAS updates.
7. Verify no new billing, deployment, media or provider effect. Record actual
   query plans/locks and migration evidence. Only after these gates pass may a
   separately reviewed server-only adapter replace the direct write path and
   keep application-level schema validation plus response sanitization.

Rollback is compatibility-first: while the RPC is unused, remove only the new
function through a reviewed forward correction if necessary; keep brand/audit
history. After adapter activation, disable the adapter first and preserve all
records. Never delete existing brands or audit events to simplify rollback.

## Still unverified

- PostgreSQL syntax, transaction rollback, lock behavior and concurrent races.
- Actual `service_role`/`anon`/`authenticated` grants, RLS and Data API exposure.
- Deployed schema drift and migration status; `qa:migrations` is source-only.
- Full application route/adaptor qualification and exact-head remote CI.

No database connection, SQL execution, migration application or remote
publication occurred in this package.

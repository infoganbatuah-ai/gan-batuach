# PUSH 43 partner-brand atomic write — future PostgreSQL gate

Status: **qualified only against a disposable, network-isolated PostgreSQL
fixture; not applied to Development or Production**. `forward.sql` still begins
with a transaction-aborting review guard and remains outside
`supabase/migrations/`. The QA runner removes the guard **in memory only** for
the disposable database. The active `savePartnerBrand` service still uses
separate reads, a brand write and an audit insert; no adapter was activated.

## 2026-10-26 disposable PostgreSQL result

- Container: pre-existing `digital-observer-pgqa-20261026`, PostgreSQL 17.6.
  Before execution, Docker inspection confirmed `NetworkMode=none`, no mounts,
  no bound ports and a running container. The runner refuses any other target.
- Scope: one randomized `do_p43_brand_qa_*` database created from `template0`
  in that container, with only source-shaped synthetic PUSH 41/43 tables and
  five synthetic profiles. No canonical data was copied or queried. Standard
  `service_role`, `authenticated` and `anon` roles already existed; none were
  created or changed cluster-wide. The fixture deliberately simplifies
  unrelated columns and emulates `auth.role()` via a session claim.
- Command: `node review-only/push43-partner-brand-atomic/run-isolated-postgres-qa.mjs --execute-disposable-qa`.
  All thirteen reported stages passed, including the unchanged review guard
  aborting before installation, candidate installation in the fixture only,
  signature-specific EXECUTE privileges, service-role/forged-claim denial,
  authorized owner create and membership-admin update, foreign/parent/global
  denial, cross-organization/partner denial, malformed field/URL/notices,
  revoked membership, domain-status preservation/reset/null, mandatory-audit
  rollback, suspended partner/organization denial, concurrent status and
  ownership changes, and two concurrent updates with one CAS winner.
- An initial negative case found that the candidate accepted `https://%`,
  which the application Zod URL parser rejects. The **review-only candidate**
  was tightened to require a DNS-like HTTPS authority; the full runner then
  passed. This SQL check is intentionally conservative and is not a complete
  URL parser. Before any adapter activation, compare all accepted production
  brand URL forms against the application parser; credentialed/other unusual
  URLs may be accepted by the current app schema but denied by the proposal.
- The runner's `finally` block dropped only its own randomized database after
  success and failure. A separate catalog query returned zero
  `do_p43_brand_qa_%` databases after the final run. No migration, service,
  provider, or external route was activated.

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

- The test proves PostgreSQL behavior only for the disposable simplified
  fixture, not the canonical Development schema, actual RLS/role inheritance,
  current grants, PostgREST/Data API exposure, or trusted server-side actor
  binding. Direct SQL can set fixture request claims and cannot prove a real
  authenticated HTTP request cannot forge them.
- Deployed schema drift and migration status remain unverified. The guarded
  SQL is **not ready to apply**. No canonical Development or Production SQL was
  executed.
- Full application route/adapter compatibility, URL-policy parity for all
  existing brand data, remote CI, and any external provider behavior remain
  unverified. The current service still sanitizes responses with
  `publicBrandProfile`; the proposed RPC returns an internal row and must not
  be returned raw to clients.
- The synthetic race demonstrates one observed lock/CAS interleaving, not an
  exhaustive concurrency or production durability guarantee.

# PUSH 40 — atomic refund authorization and mandatory audit

Status: **review-only PostgreSQL proposal, qualified only in a disposable
synthetic fixture; not applied or activated**. `forward.sql` begins with a
transaction-aborting guard and is outside `supabase/migrations/`.

## Verified source gap

The already-written migration
`20261019010000_digital_observer_push40_commercial_billing.sql` defines
`authorize_digital_observer_refund` to insert an `authorized` refund and return.
`requestRefund` in `commercial-billing-service.ts` calls that RPC and then
inserts `refund_authorized` into `digital_observer_financial_audit` in a second
request. If the second insert fails, it cannot roll back the prior RPC's
committed refund. Exact replay returns the existing refund without restoring
the missing audit. This is an internal ledger integrity gap, **not proof of a
real provider refund**. No provider action was invoked here.

The previous active route permitted Site owner, owner/admin membership, and
global admin through a generic role shortcut. The subsequent local route
hardening requires a fresh exact-Site read with `active=true`, non-Garden
classification and direct owner or active owner/admin membership before
`requestRefund`; global admin, organization-only and billing-history access
alone do not authorize a refund. Other billing actions are unchanged. Focused
route tests use synthetic session and database boundaries, not live RLS or a
real refund. The active RPC still lacks its own actor/Site authority fence, so
revocation between the route check and RPC call remains a future activation
gate. The proposed RPC independently requires the same direct relationship.

## Proposed guarded change

`forward.sql` creates a **new** `authorize_digital_observer_refund_atomic`
signature, not an in-place replacement. Replacing the old RPC while the
service still writes a separate audit would double-audit successful refunds.
The additive candidate checks exact Site, active actor, direct billing authority,
confirmed signed payment, positive amount and currency, one exact paid invoice
bound to the payment and checkout, semantic idempotency, existing audit on
replay, and cumulative reserved refunds. Locking the payment row serializes
concurrent refund reservations for that payment. It inserts the authorized
refund and financial audit in the same PostgreSQL transaction; audit failure
rolls the refund back. It returns an internal refund row, not a client-ready
sanitized response. The function is `SECURITY INVOKER`, pins an empty
`search_path`, and revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`,
granting only `service_role`. This proposal changes no active code or schema.

The business owner is the exact paying Site. Refund and audit rows are
sensitive financial metadata; existing retention applies. A normal request
reads one Site/profile/membership, locks one payment, checks at most two
matching invoice IDs, reads one refund and a bounded sum for that payment,
then inserts one refund and one audit. No media, payment provider call or
new recurring service is involved.

## 2026-10-26 disposable PostgreSQL qualification

- Before execution, the existing container `digital-observer-pgqa-20261026`
  was verified running with `NetworkMode=none`, no mounts and no bound ports.
  Standard `service_role`, `authenticated` and `anon` roles were pre-existing.
- Command: `node review-only/push40-refund-atomic/run-isolated-postgres-qa.mjs --execute-disposable-qa`.
  It creates a randomized database from `template0` only in that container,
  applies a minimal source-shaped synthetic fixture, proves the unchanged
  review guard aborts, then omits the guard **in memory** for candidate tests.
- All 11 stages passed: narrow function ACL and forged/missing request-role
  denial; authorized owner insert with one audit; equivalent replay without
  extra audit; semantic replay conflict; foreign/global/viewer/Garden/wrong
  Site/revoked membership denial; amount/currency/cumulative ceiling;
  unsigned payment and missing/cross-Site/duplicate invoice denial; mandatory
  audit failure rolling the refund back; admin authorization; legacy refund
  without audit blocked for repair; and two different-key 6,000-minor-unit
  refund requests racing against one 10,000-minor-unit payment, with exactly
  one committed winner.
- The runner drops only its own disposable database in `finally`. A separate
  final catalog query confirmed **zero** `do_p40_refund_qa_%` databases.
- Focused PUSH 40 source tests passed **15/15**; focused ESLint, JavaScript
  syntax and Git diff checks passed. No real payment, invoice, refund, provider, customer or
  canonical Development/Production data was used.

## Subsequent route-only authority qualification

The local route change adds an exact Site/membership check before creating the
privileged billing client for a refund. **21/21** focused source/route tests and
the canonical PUSH 40 deterministic QA passed; focused ESLint and Git diff
integrity checks passed. The tests exercise the real route module with synthetic I/O
boundaries, including owner and owner/admin membership success, global admin
without direct Site authority, organization-only, viewer, billing-only,
revoked, wrong-Site, Garden, inactive Site and database failures. Cancel and
reconcile branches remain outside this new check. No actual refund or database
read/write occurred. Full repository `npm run typecheck` is not green because
the untouched mobile runtime has unresolved `@capacitor/*` modules and their
dependent implicit-any diagnostics; it reported no error in the changed route.

## Mandatory gates before any Development integration

1. Verify actual canonical migration history, schema/RLS/grants and backup;
   this simplified fixture cannot prove PostgREST/Data API exposure, actor
   binding, real role inheritance or existing data compatibility.
2. Reverify the locally hardened route against the canonical Development
   session/RLS and the future RPC adapter. A route-only check is not an atomic
   refund authority fence; recheck direct Site ownership inside the RPC before
   activating payment/refund handling. Any future global-admin refund power
   requires a separate explicit product and security decision.
3. Preflight existing refunds missing mandatory audit. Replay is intentionally
   blocked with `REFUND_AUDIT_REPAIR_REQUIRED`; do not fabricate an audit or
   silently treat such rows as complete.
4. Verify invoice uniqueness for `source_payment_event_id` and checkout binding
   against canonical data. The fixture rejects duplicates at read time, but a
   concurrent invoice insert is not fully fenced by this function alone. A
   reviewed uniqueness constraint or equivalent canonical invariant is needed.
5. Verify payment/checkout and invoice lifecycle compatibility, including
   signed legacy payment rows, invoices without exact metadata, and the fact
   that `payment.subscription_id` may be null before subscription activation.
   This candidate intentionally fails closed on missing invoice proof.
6. Verify the server derives `p_actor_profile_id` from a fresh authenticated
   session and calculates the HMAC stable refund ID. The database validates
   shape and Site authority but cannot infer that the service-role caller
   obtained the actor from a legitimate request. Direct SQL can set fixture
   request claims and cannot prove a real HTTP caller cannot forge them.
7. Only after review, add a new ordered Development migration for the additive
   RPC. Keep the old RPC until the server adapter is changed in a coordinated
   step to call the atomic RPC **without** a second audit insert. Qualify the
   exact Data API path, replay, role boundaries, invoices, concurrency and
   financial ledger. No Production or provider activation is implied.

Rollback before adapter activation is to leave the additive function unused.
After adapter activation, reverting to the old RPC restores the known audit
gap and is **not** a verified lossless rollback. Preserve all refund, invoice,
payment and audit rows; plan an audited compatibility fallback or a forward
repair instead of deleting financial records.

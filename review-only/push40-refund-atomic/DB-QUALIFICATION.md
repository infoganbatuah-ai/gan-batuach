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

## Invoice source-payment uniqueness proposal — 2026-10-26

Source inventory: `ensureDraftInvoice` in `commercial-billing-service.ts`
creates one internal draft per stable Checkout ID, with
`metadata.checkout_intent_id` but no payment-event ID.
`activateVerifiedCheckout` creates a paid invoice or updates that draft after
payment confirmation and writes both `metadata.checkout_intent_id` and
`metadata.source_payment_event_id`. `confirmRefund` subsequently updates the
invoice's credited state and amount but does not change source metadata.
The repository search found no other active invoice writer. The base invoice
table has a unique `invoice_number`, and PUSH 40 added a partial unique
`immutable_invoice_id` index; neither makes `source_payment_event_id` unique.
These source findings do **not** prove canonical data has no legacy duplicate
or that a future legal tax-document writer will not legitimately reference the
same payment.

`invoice-source-uniqueness.sql` is a **separate guarded, review-only**
candidate. A future reviewed Development migration would take a bounded SHARE
table lock, refuse malformed source metadata and duplicates without modifying
rows, then create a global unique UUID-expression index for every non-null
`metadata.source_payment_event_id` across invoice states, Sites and checkouts.
It is intentionally stronger than an index only on paid invoices: a draft,
credited or cross-Site row cannot later become a second paid match for the
same payment. Draft and legacy rows lacking the key remain permitted but
cannot qualify a refund. The candidate does not use `IF NOT EXISTS` because
an unrelated index with the same name must not count as the expected proof.
Its 5-second lock wait and 30-second statement timeouts are fail-closed QA
bounds, **not** proof of acceptable lock impact on a real invoice table.

The new disposable PostgreSQL runner verified the exact existing
`digital-observer-pgqa-20261026` container had `NetworkMode=none`, no mounts
and no ports, then created a new random database from `template0`. All nine
recorded stages passed: original guard abort; duplicate preflight leaves both
synthetic invoices intact; malformed source metadata abort; missing legacy
metadata remains but cannot qualify; one exact paid invoice succeeds;
cross-Site, checkout and payment mismatches fail; an uncommitted invoice is
invisible to refund and rolls back without erasing the original; a second
connection attempting a different-immutable-ID duplicate while a refund
transaction remains open is rejected by the index; and final matching QA
database catalog count is **zero**. This tested SQL behavior in a simplified
PostgreSQL fixture, not the canonical Development catalog, PostgREST/Data API,
real provider, invoice history or Production. The source/guard contract tests
passed **3/3**. No actual invoice or refund was created or changed.

Compatibility gate: before any real migration, read the canonical
Development invoice catalog and history, classify every row with a source
payment key and every duplicate/invalid/legacy exception, verify that a
single invoice record per payment is the approved commercial and legal
contract, assess index build lock/size and cost, and test the exact adapter
and RLS. If multiple legal invoices for one payment are valid, **do not**
install this index or activate refunds based on this proposal. Keep refund
authorization fail-closed until a separately reviewed unique canonical
payment-to-internal-invoice binding (including all writers) replaces it.
No source row may be deleted, reassigned or silently backfilled to force a
passing preflight.

Rollback: a failed guarded/preflight transaction leaves invoice rows and the
catalog unchanged. After a future successful index installation, leaving the
unused index in place is the safe pre-activation rollback. Dropping it while
refunds are active would reopen the race and is not an approved rollback;
first disable/reconcile the adapter and preserve invoices, refunds and audits.
No lossless canonical rollback has been rehearsed.

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
4. Verify and approve the separate review-only source-payment uniqueness
   proposal against the canonical catalog and legal invoice lifecycle before
   a future migration. The RPC alone still cannot fence a concurrent invoice
   insert; its synthetic concurrency PASS depends on the proposed index being
   installed. If the index is incompatible, retain refund fail-closed and
   design a unique canonical binding before activation.
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

# Dormant QA handoff HTTP gate

`handoff-http-gate.mjs` is a disconnected server-side adapter, not an active
Next.js route. Its default switch is off; a request is denied before any Auth
or storage call. Isolated tests explicitly pass `enabled: true`. In that mode
it accepts only an exact HTTPS POST to the QA control path, no query or
fragment, a maximum 2-KiB JSON body containing only challenge ID,
installation ID and P-256 signature. No account, session, bearer or approval
credential can be supplied in the body or URL. The response has no redirect,
token or body and is marked `no-store`.

The adapter requires trusted server-side `reserveAttempt()` accounting before
URL validation, body reads or Auth. Missing, failed or non-affirmative
accounting fails closed. The dormant server composition binds it to the
existing atomic, service-only `consume_rate_limit` RPC with one server-derived
global QA key and 30 attempts per fixed minute. A 30-minute interval touches
at most 31 buckets, admitting at most 930 application attempts; reconnects
cannot change the key. This is **not** a provider edge limit, contractual
spending cap or live-deployment proof.

The adapter delegates to a **trusted server-side** `authenticate(request)`
and `consume(input)` implementation. The authenticated account and session
are taken only from that verifier. `consume` must invoke the separately
reviewed signature/receipt adapter, whose final database statement checks a
live Auth session, one-use receipt, approved installation, expiry and
revocation. Existing `getDigitalObserverApiUser` verifies the user and calls
`digital_observer_current_session_active()`. The separate
`getQaVerifiedSession` helper derives the `session_id` only after those checks
succeed for the same bearer; it never takes identity from client JSON or a
browser cookie. No active route or real database wiring is included.

`qa-handoff-composition.ts` connects this HTTP gate, the verified-session
helper and the conditional receipt consumer in one server-only module. Its
activation constant is hard-coded `false`; no route imports it and no runtime
option can enable it. The integration test enables only a transpiled in-memory
copy, uses the real signature verifier and consumer against a fake database,
and revalidates Auth identity at consume time. This proves local wiring, not
a live database transaction.

Activation still requires deployed private-store ACL review, PostgreSQL
revocation/consume race proof for the `auth.sessions` row-locking statement,
rate limiting, approved external control transport and physical-device proof.
No SQL was executed; no secret, device, endpoint, provider or external route
was activated.

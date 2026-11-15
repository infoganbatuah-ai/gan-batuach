# Dormant QA handoff HTTP gate

`handoff-http-gate.mjs` is a disconnected server-side adapter, not an active
Next.js route. Its default switch is off; a request is denied before any Auth
or storage call. Isolated tests explicitly pass `enabled: true`. In that mode
it accepts only an exact HTTPS POST to the QA control path, no query or
fragment, a maximum 2-KiB JSON body containing only challenge ID,
installation ID and P-256 signature. No account, session, bearer or approval
credential can be supplied in the body or URL. The response has no redirect,
token or body and is marked `no-store`.

The adapter delegates to a **trusted server-side** `authenticate(request)`
and `consume(input)` implementation. The authenticated account and session
are taken only from that verifier. `consume` must invoke the separately
reviewed signature/receipt adapter, whose final database statement checks a
live Auth session, one-use receipt, approved installation, expiry and
revocation. Existing `getDigitalObserverApiUser` source verifies the user and
calls `digital_observer_current_session_active()`, but it does **not** return
the verified `session_id` needed here. The present unit cannot safely derive
it from client JSON, an unverified JWT parse, or browser cookie. Therefore no
active route or real Auth/database wiring is included.

Activation requires an authoritative server-side session-ID extraction
contract, deployed private-store ACL review, PostgreSQL revocation/consume
race proof, rate limiting, and an approved external control transport. Tests
use injected synthetic Auth/storage and are not real Supabase or PostgreSQL
proof. No SQL was executed; no secret, device, endpoint, provider or external
route was activated.

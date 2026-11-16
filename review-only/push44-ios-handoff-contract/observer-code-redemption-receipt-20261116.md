# Observer QA code redemption — disconnected qualification

On 2026-11-16 the existing review-only QA handoff contract was hardened rather
than replaced. The browser-tab `singleUseAuthCodeExchange` was left unchanged:
its memoized result is not server-side, durable, or a replay fence.

Correction after Root review: the earlier version incorrectly allowed
`qa-iphone-device-proof.ganbatuach.com/qa/device-proof/return` for Observer,
although that host is Gan-only in the native return gates. That authorization
was removed before integration. The disconnected Observer entry point now
always denies, including when a caller supplies an `enabled` flag or the Gan
host; the generic contract also refuses the Observer audience. No Observer
HTTPS/AASA origin is currently approved. The shared Gan review-only
review-only redemption contract checks account, session, installation, exact
code SHA-256, 256-bit nonce, two-minute maximum receipt lifetime, current
session/device-proof flags, revocation and replay. The atomic adapter receives
the hash/nonce and all identity dimensions to compare and mark consumed in a
single transaction; the raw code is not passed to that adapter.

Focused tests use an in-memory fake compare-and-consume store. They cover
20-way Gan synthetic concurrent redemption with one winner, 20-way Observer
denial, second redemption, wrong code/nonce/callback, mixed audience,
other account/installation/session, expiry, revocation and missing storage.
These tests do **not** prove PostgreSQL atomicity, Supabase session validation,
physical iPhone return or an approved Observer external origin. No DNS, API
route or application handler was activated.
The existing Gan browser primitive and QA return contract remain separate.

Before any Observer redemption implementation: establish a separate approved
Observer HTTPS/AASA origin and prove it in the signed native return gate; then
approve and implement a private Development receipt schema
and atomic consume adapter; bind it to a server-verified current Supabase
session and registered installation proof; qualify the exact HTTPS origin and
native return on a signed iPhone build. Do not pass an auth code or bearer in a
URL, and do not infer completion from these synthetic tests.

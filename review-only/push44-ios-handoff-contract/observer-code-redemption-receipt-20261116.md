# Observer QA code redemption — disconnected qualification

On 2026-11-16 the existing review-only QA handoff contract was hardened rather
than replaced. The browser-tab `singleUseAuthCodeExchange` was left unchanged:
its memoized result is not server-side, durable, or a replay fence.

The disconnected Observer entry point is default-off. It enforces the exact
Observer QA bundle audience and proposed HTTPS return callback. The shared
review-only redemption contract checks account, session, installation, exact
code SHA-256, 256-bit nonce, two-minute maximum receipt lifetime, current
session/device-proof flags, revocation and replay. The atomic adapter receives
the hash/nonce and all identity dimensions to compare and mark consumed in a
single transaction; the raw code is not passed to that adapter.

Focused tests use an in-memory fake compare-and-consume store. They cover
concurrent winners, second redemption, wrong code/nonce/callback, Gan audience,
other account/installation/session, expiry, revocation and missing storage.
These tests do **not** prove PostgreSQL atomicity, Supabase session validation,
physical iPhone return or an approved external origin. The callback is only a
proposed exact origin; no DNS, API route or application handler was activated.
The existing Gan browser primitive and QA return contract remain separate.

Before activation: approve and implement a private Development receipt schema
and atomic consume adapter; bind it to a server-verified current Supabase
session and registered installation proof; qualify the exact HTTPS origin and
native return on a signed iPhone build. Do not pass an auth code or bearer in a
URL, and do not infer completion from these synthetic tests.

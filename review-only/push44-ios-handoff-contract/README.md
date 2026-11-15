# PUSH 44 iOS QA handoff — review-only redemption contract

No product endpoint, feature flag, migration, SQL, external service or iPhone
build is changed here. The test uses synthetic identities and a fake atomic
adapter. It specifies required behavior; it does **not** prove PostgreSQL
atomicity, session verification, Secure Enclave proof or iOS callback delivery.

`contract.mjs` rejects missing or mismatched account, installation, session and
callback audience; expired, consumed or revoked receipts; inactive sessions;
invalid device proof; missing storage; and storage errors. Final success
requires `consumeIfCurrent` to return true. That operation must be implemented
as one durable compare-and-update transaction; the preceding read is not a
fence. The concurrency test's fake adapter models that atomic outcome only.

## Hard dependency before product wiring

The currently deployed schema has no reviewed Development-only receipt bound
to all four dimensions. `digital_observer_sso_transactions` belongs to SSO and
does not contain the QA account/session/installation binding. The browser-tab
`singleUseAuthCodeExchange` cache is neither durable nor a server consume.
Existing `getDigitalObserverApiUser` can validate a Development session, but
the current QA proxy does not call it and still accepts a reusable bearer in a
GET query. No approved native callback/exchange exists for PersonalTeamQA.

The next authorized implementation must first review a durable receipt schema
and atomic consume interface, then bind it to server-validated Supabase session
identity and cryptographic installation proof. It must use a precise callback
audience and POST-body exchange, with no bearer in URL, IPA, logs or cookies
copied between Safari and WKWebView. The future endpoint must fail closed on
session revocation, race, restart, expiry and unavailable storage. A feature
flag cannot make an unreviewed schema or incomplete authorization safe.

Do not remove `PUSH44_QA_REMOTE_BUILD_BLOCKED` or expose an external route
based on this review-only contract. A separate schema authorization and native
callback/signing qualification are required before a product implementation.

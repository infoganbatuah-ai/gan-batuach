# PUSH 44 iOS QA handoff — review-only redemption contract

No product endpoint, feature flag, migration, SQL, external service or iPhone
build is changed here. The test uses synthetic identities and a fake atomic
adapter. It specifies required behavior; it does **not** prove PostgreSQL
atomicity, session verification, Secure Enclave proof or iOS callback delivery.

`qa-access-return.mjs` adds a second, dormant local return-validation contract.
The default flag is off. When explicitly enabled in isolated tests it creates
a random one-time state, accepts only the exact HTTPS QA return URL with that
single state query parameter, and binds consumption to the same account,
installation and QA bundle audience within two minutes. It rejects tokens in
the URL, replay, changed identity and malformed origins. It does not log the
return URL and never exchanges a browser or Supabase session.

The current PersonalTeamQA build script removes `CFBundleURLTypes`, has no
Associated Domains entitlement, and delegates Universal Links to Capacitor
without an approved QA return handler. Thus this local primitive is **not**
native iPhone callback proof. A future separately authorized signing and
external-origin qualification must establish a supported iOS callback and
associate the exact host before wiring this contract into the app. The remote
build block and default-off state remain intact.

`contract.mjs` now also requires a 256-bit hexadecimal code and nonce, a
stored SHA-256 code hash, exact callback, and an issued/expires lifetime no
longer than two minutes. It rejects missing or mismatched account,
installation, session, callback audience, code hash and nonce; expired,
consumed or revoked receipts; inactive sessions; invalid device proof; missing
storage; and storage errors. `redeemObserverQaCode` now always denies because
there is no approved Observer HTTPS/AASA origin. The existing
`qa-iphone-device-proof.ganbatuach.com` return belongs to the separate Gan QA
contract and must not be treated as an Observer callback. The generic contract
also refuses the Observer audience. The code itself is not stored in the
receipt or passed to the atomic adapter. Final success
requires `consumeIfCurrent` to return true. That operation must be implemented
as one durable compare-and-update transaction; the preceding read is not a
fence. The 20-way Gan synthetic concurrency test's fake adapter models that
atomic outcome only; 20 concurrent Observer attempts all deny.

## Hard dependency before product wiring

The currently deployed schema has no reviewed Development-only receipt bound
to account, session, installation, Observer audience, callback, code hash and
nonce. `digital_observer_sso_transactions` belongs to SSO and
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

# PUSH 44 iOS QA session handoff — offline feasibility finding

This is a Development-only characterization of the existing QA proxy. It does
not enable a remote build, change the proxy, or claim physical-iPhone proof.

## Existing contract and exact gap

- `prepare-push44-iphone-qa-config.mjs` intentionally rejects a remote IPA
  before packaging the owner bearer token. Keep that guard.
- `push44-owner-qa-proxy.mjs` accepts a GET bootstrap URL containing the bearer
  and sets an HttpOnly cookie in the requester. The same bearer can be replayed
  before the 30-minute deadline, without a Development session, installation
  identity, or one-use server-side receipt.
- The local QA shell has no supported browser-to-WKWebView exchange. A Safari
  cookie is not evidence that the native WebView has a session. Copying the
  cookie would turn it into another transferable bearer.
- The URL itself carries the secret, so browser history, URL-bearing telemetry,
  or intermediary request logs are possible disclosure paths even if this
  proxy's optional diagnostic line classifies only the route.

The local harness `scripts/qa/check-push44-ios-handoff-feasibility.mjs` proves
these current properties with a synthetic token. It does not prove actual
iOS cookie behavior, provider behavior, or a secure handoff implementation.

## Minimum safe future contract

A remote QA flow needs an authenticated server-side handoff record and a
supported app-return mechanism. The record must bind an existing Development
session, intended owner/device or installation, exact callback audience and
one-time nonce. It must expire quickly, be atomically consumed once, reject
replay/cross-account/cross-device use, and leave no bearer in the IPA, URL,
logs, or client-visible callback. The app must establish its own authorized
session in its own WebView context; neither a Safari cookie nor an Access login
alone may substitute for the canonical Development session. Cancellation,
revocation, and key loss must fail closed.

That requires a new server-side store/exchange or callback implementation and
physical-device verification. Neither is authorized by this offline task.
Until separately scoped and tested, remote IPA preparation remains blocked.

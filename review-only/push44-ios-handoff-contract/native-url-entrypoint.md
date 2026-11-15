# Dormant PersonalTeamQA Universal Link entrypoint

`AppDelegate` now has a QA-only entrypoint before the existing Capacitor
delegate. Its compile-time runtime flag is `false`; therefore the existing
behavior is unchanged. The parser requires the exact HTTPS host and path, a
single 64-hex-character state parameter, no URL fragment or credentials, a
pending locally generated one-use state, a two-minute expiry, and matching QA
account, installation and bundle audience. No URL, state, token or credential
is posted in the sanitized notification.

The entrypoint is **not operational**: PersonalTeamQA has no Associated Domains
entitlement; no trusted QA-flow producer or subscriber is wired; and the
current callback invocation deliberately supplies no authenticated account or
installation, so validation fails closed even if the flag is changed alone.
This prevents a browser callback from asserting its own identity. A future
authorized implementation must retrieve the current authenticated Development
account and installation from a trusted native/session boundary, establish
the exact domain association and signed build, and prove return behavior on
the physical iPhone. No session exchange, route, device enrollment, SQL,
external access or signing was performed here.

The QA target now also contains `QaAsWebAuthReturn`, a separate iOS 15
`ASWebAuthenticationSession` adapter using an exact start URL and a custom
scheme callback with an opaque random state only. It preserves the dormant
Universal Link gate above. Its flag is `false`, its trusted account and
installation provider is deliberately `nil`, and no caller invokes `start()`.
The callback rechecks the provider against the identity captured at
preparation, burns the state on the first return attempt, and emits a clean
signal with no URL or credential. Therefore it fails closed in the current
build even if the flag were flipped alone. This code does not establish a
Development session, issue an approval, or exchange a browser credential.
It requires a future trusted identity bridge and physical-device qualification
before activation.

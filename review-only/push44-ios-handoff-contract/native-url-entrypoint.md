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

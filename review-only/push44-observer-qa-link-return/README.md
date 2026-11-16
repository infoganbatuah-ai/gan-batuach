# PUSH 44 — native QA link return boundary

Source gap: iOS Observer QA registers `observerqaapp`, and the built Android
Observer QA APK registers `observerqaandroid`, but the canonical parser and
pending-link replay accepted/canonicalized only `digitalobserver`. A cold-start
or post-login QA link could therefore be denied or rewritten as a Gan link.

The parser now accepts those exact QA schemes as Observer resource links. The
native app checks its actual bundle/package ID and platform before posting a
captured URL to the server: Observer iOS QA accepts only `observerqaapp`,
Observer Android QA only `observerqaandroid`, and existing Gan release/QA shells
only `digitalobserver`. Unknown IDs fail closed. Native HTTPS links must use the
current exact origin and `/digital-observer/open/` product path. Pending replay
keeps the original scheme and remains one-use/time-bounded. The server still
requires the independent Observer session, Site membership and resource-Site
lookup before returning a relative Observer destination.

This is local routing isolation, **not** server-side app attestation: a caller
with a valid session could submit a QA-formatted URL over HTTP, but it cannot
gain another Site or resource through that syntax. A future trusted app-bound
server claim requires separate implementation and qualification.

The current login uses in-app password/Supabase session handling; no native
system-browser OAuth/ASWebAuthenticationSession exchange is implemented. The
registered QA schemes are not proof that a native Auth token callback works.
An `auth/callback` custom link remains rejected by the resource-link parser;
no token is accepted from a deep link. Real physical-device return was not run.

Focused synthetic tests cover parser, launch replay, app/package mismatch,
wrong origin/product path, and retained server authorization. The existing
Observer Android QA APK was inspected with `aapt` for its `observerqaandroid`
scheme; iOS QA callback identity was verified from its dedicated `Info.plist`
and source QA check. No new native binary was built or installed in this unit.

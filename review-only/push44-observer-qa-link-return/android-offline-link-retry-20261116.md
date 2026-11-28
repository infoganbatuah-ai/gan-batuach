# Android Observer QA offline resource-link retry

Local source qualification, 2026-11-16; no device, provider, SQL, live network
or Production operation.

The Android manifest uses a single-task Capacitor activity. The Gan flavor
declares `com.ganbatuach.app` and `digitalobserver`; the Observer QA variant
uses `com.digitalobserver.app.qa` and `observerqaandroid`. The native runtime
checks the actual package identity before sending a link to the server. The
server still validates the Development session and Site/resource scope.

Concrete gap: a valid Observer QA resource link opened while the network
request threw was discarded. On a cold start, the first-launch marker could
then suppress the same URL for five minutes, so reconnect did not recover the
intended navigation. The runtime now stores only a canonical resource link in
session storage on transport failure. On reconnect it rechecks the session and
submits the pending link for server authorization. The existing five-minute,
one-use queue contract applies; Auth callback links with codes are not queued.
No authorization decision is made from the stored link itself.

Focused tests exercise Android Observer QA package/scheme matching, Gan
separation, cold-start/pending-link behavior, a thrown request followed by
reconnect and authorized destination, plus callback non-queueing. This is a
local synthetic runtime test, not a physical Android or external-origin proof.

An offline Gradle manifest build was attempted. It stopped at the existing
`verifyObserverQaMobileConfig` gate with `CAPACITOR_SERVER_URL_MISMATCH` because
this worktree's packed Android assets still target the Gan localhost
Development variant. No approved Observer QA HTTPS origin is available for
regenerating a signed remote Android package; the guard was not weakened and
the packed assets were not overwritten. Full Android artifact qualification
remains blocked on a separately approved origin/build configuration.

# Live Stability Repair

## Observed, 2026-08-31

- Signed-in Chrome cameras page: nine actual players initially paused at time zero, then all nine advanced in a subsequent sample. Sustained stability was NOT established; a later browser inspection timed out.
- Local Gateway health responded in 13 ms. Its Node process had been running for approximately 19 hours, so this incident cannot be described as a confirmed process crash.
- The installed runtime differs from current source. Do not install the whole working branch or runner as part of this repair.
- Historical logs contain pipe/identity failures, but those entries alone do not establish the cause of this incident.

## Reproducible Failure Paths And Fixes

1. Local media tokens expire after five minutes. Previously the player renewed only after failure. A minute heartbeat now obtains a fresh site/source-authorized cloud grant before expiry. The local Gateway can renew the matching unexpired lease in place, preserving the URL and decoder buffer. Revocation still takes effect at the bounded lease deadline if reauthorization fails.
2. Relay restarts deleted the playlist and reused segment numbers starting at zero. The follow-up preserves the bounded window and appends consecutive sequence numbers with FFmpeg's discontinuity handling and atomic publication. A time-based sequence alone proved insufficient in live testing. The FFmpeg HLS option semantics are documented at https://ffmpeg.org/ffmpeg-formats.html#hls-2 .
3. An upstream channel that never returned headers could leave a shared relay-start promise pending indefinitely. Bound response-header waiting and cancel rejected bodies without imposing a timeout on healthy live media.

These are verified code-level failure paths, not proof that every outage had the same cause.

4. A fully consumed IncomingMessage could prematurely destroy the outgoing media reader. The response now owns reader cancellation, includes Content-Length, and destroys incomplete responses rather than reporting clean EOF. A real synthetic HTTP test failed before the fix and passes afterward. Node documents the distinct request-completion semantics at https://nodejs.org/api/http.html#class-httpincomingmessage .
5. Upstream EOF now reopens only the affected relay while an unexpired authorized viewing lease exists. Startup alone is no longer reported as progressing media. Aggregate lifecycle counters distinguish EOF/failure/stale input/stale playlist without returning source identifiers.

## Verification

- `node scripts/qa/check-live-lease-renewal.mjs`: authorization renewal, expiry, revocation, per-source isolation, cloud/local token boundary, stalled-header cancellation and real synthetic FFmpeg HLS restart.
- `node scripts/qa/check-dvr-shared-session-and-offline.mjs`: existing isolation and actual component lifecycle/renewal/cleanup regressions.
- `node scripts/qa/check-local-playback-grant.mjs`: playback handoff/security checks.
- `node scripts/qa/check-hls-response-lifetime.mjs`: real HTTP response completeness and ten-viewer isolation when another viewer aborts.
- `node scripts/qa/check-relay-lease-recovery.mjs`: startup truthfulness, single-flight, lease-scoped EOF recovery and per-source stale isolation.
- Focused TypeScript check covering the player, session client and imported dependency graph; syntax and whitespace checks.
- No DVR configuration changes, physical commands, real model/biometric activation, or secret-file writes.

## Release And Acceptance Gate

Initial repair `0b21625c` is Production READY and was installed locally. Startup diagnostic capture was removed without installing the newer AI runner. No schema migration was needed. Live verification in the user's signed-in Codex browser showed ten advancing players, then nine decoder resets within about two minutes. That verification FAILED; do not call the initial repair stable. The response-lifetime/window/EOF follow-up still needs rollout and repeat verification.

Prepare an exact release from the current production baseline, excluding unrelated telemetry/model/runner changes. Obtain production/local restart approval, preserve Keychain identity and mappings, and verify rollback before restart. Check that startup does not introduce diagnostic event capture or broaden monitoring consent.

After release, observe each authorized player for at least two five-minute lease windows, fullscreen and grid, including paused/background recovery. Verify currentTime progression, no periodic lease reconnects, bounded offline-source retries, and event evidence separately. Do not mark camera stability or Observer continuous analysis accepted until those checks pass. Power loss, a sleeping host, recorder/network failure and cross-device loopback limitations remain distinct availability constraints.

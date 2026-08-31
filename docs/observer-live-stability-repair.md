# Live Stability Repair

## Observed, 2026-08-31

- Signed-in Chrome cameras page: nine actual players initially paused at time zero, then all nine advanced in a subsequent sample. Sustained stability was NOT established; a later browser inspection timed out.
- Local Gateway health responded in 13 ms. Its Node process had been running for approximately 19 hours, so this incident cannot be described as a confirmed process crash.
- The installed runtime differs from current source. Do not install the whole working branch or runner as part of this repair.
- Historical logs contain pipe/identity failures, but those entries alone do not establish the cause of this incident.

## Reproducible Failure Paths And Fixes

1. Local media tokens expire after five minutes. Previously the player renewed only after failure. A minute heartbeat now obtains a fresh site/source-authorized cloud grant before expiry. The local Gateway can renew the matching unexpired lease in place, preserving the URL and decoder buffer. Revocation still takes effect at the bounded lease deadline if reauthorization fails.
2. Relay restarts deleted the playlist and reused segment numbers starting at zero. Use monotonically time-based sequence numbers, a discontinuity marker and atomic segment/playlist publication instead. The FFmpeg HLS option semantics are documented at https://ffmpeg.org/ffmpeg-formats.html#hls-2 .
3. An upstream channel that never returned headers could leave a shared relay-start promise pending indefinitely. Bound response-header waiting and cancel rejected bodies without imposing a timeout on healthy live media.

These are verified code-level failure paths, not proof that every outage had the same cause.

## Verification

- `node scripts/qa/check-live-lease-renewal.mjs`: authorization renewal, expiry, revocation, per-source isolation, cloud/local token boundary, stalled-header cancellation and real synthetic FFmpeg HLS restart.
- `node scripts/qa/check-dvr-shared-session-and-offline.mjs`: existing isolation and actual component lifecycle/renewal/cleanup regressions.
- `node scripts/qa/check-local-playback-grant.mjs`: playback handoff/security checks.
- Focused TypeScript check covering the player, session client and imported dependency graph; syntax and whitespace checks.
- No DVR configuration changes, physical commands, real model/biometric activation, or secret-file writes.

## Release And Acceptance Gate

Not yet installed or deployed. No schema migration is required. Web and local Gateway changes must ship together; an older Gateway returns a new URL instead of renewing in place and therefore still causes a decoder reconnect.

Prepare an exact release from the current production baseline, excluding unrelated telemetry/model/runner changes. Obtain production/local restart approval, preserve Keychain identity and mappings, and verify rollback before restart. Check that startup does not introduce diagnostic event capture or broaden monitoring consent.

After release, observe each authorized player for at least two five-minute lease windows, fullscreen and grid, including paused/background recovery. Verify currentTime progression, no periodic lease reconnects, bounded offline-source retries, and event evidence separately. Do not mark camera stability or Observer continuous analysis accepted until those checks pass. Power loss, a sleeping host, recorder/network failure and cross-device loopback limitations remain distinct availability constraints.

# Live Stability: 2026-08-31

## Verified Findings

- Expired device refresh identity rejected playback claims although site sources remained present. A user-approved enrollment succeeded through the authenticated dashboard; device material stayed in Keychain.
- The local main thread was sampled blocking in synchronous child-process calls. Cloud playback/manifest requests returned 200 while local health/manifest requests timed out. Keychain reads and writes now use asynchronous bounded processes with per-item in-flight read sharing.
- Recorder transport/decoder errors previously triggered shared re-authentication. They now preserve healthy sibling channels; explicit authentication rejection remains eligible for recovery, with a 30-second login backoff.
- Native WebKit pauses off-screen muted videos. Hidden preview timeouts previously caused repeated destructive reconnects. Visibility suspension is now distinct from unavailable media; returning to view requires new buffered-media progress. See [WebKit autoplay policy](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/).
- Video intrinsic dimensions changed tile height between loading and playing. Player geometry now uses a stable aspect ratio and absolutely positioned video.
- A later sustained ten-player run exposed a real process crash: a timed-out Keychain read occurred outside the background poll's error boundary. LaunchAgent reported exit 1 and restarted the Gateway. A strict Node subprocess reproduces exit 1 with the installed old code and exit 0 with the fix; polling now contains both expected and unexpected promise failures.
- Recurring discovery also authenticated again and refreshed the shared recorder session even while sibling relays delivered live media. The corrected discovery reuses only a matching profile with fresh relay evidence, probes unavailable channels separately, and does not rotate a healthy shared session. Changed credentials still require authentication.
- The recorder's public web-client code explicitly schedules `Login/Heartbeat` at 10,000 ms using API version 1.0 and empty data. The Gateway had no equivalent session maintenance. A bounded, single-flight heartbeat now uses only the existing authenticated session; it does not log in or control/configure cameras. Only aggregate acknowledgement counters are exposed.

## Validation

- Synthetic HTTP health responds while Keychain remains unresolved; ten concurrent reads share one operation. Timeout errors are redacted and refresh recovery is persisted before network rotation.
- Lost-response/restart device recovery, site scope, revocation, legacy compatibility and hash-only cloud writes pass.
- Recorder sibling isolation, explicit-auth recovery, single-flight and login backoff pass.
- HLS response lifetime, lease renewal, relay recovery, source isolation and real component lifecycle tests pass.
- Targeted TypeScript check and diff whitespace check pass.
- Live re-enrollment and guarded local update preserved the six installed journal/runner files and all ten active camera source IDs. Discovery found 16 channels, ten connected.
- After local session isolation, health measured 97 ms, ten local playlists progressed with none stalled, and the local model reported loaded. These are point-in-time observations, not an uptime guarantee.
- Authenticated large-view video was visually inspected. The sustained ten-player browser acceptance run has NOT passed yet.
- The single-camera view progressed beyond 20 minutes. After the UI deployment, all ten players received media and advanced for the initial 235-second observation window; a longer run then failed with six visible-player resets and local claim timeouts, exposing the background poll crash. This is a failed acceptance run, not a success claim.
- The two UI files were deployed to production as `dpl_23RyUyAVpa5QG4v78vvVk4QFTTkQ`, after full TypeScript validation, a Ready build, and verification of all 1,175 uploaded source hashes against the exact production baseline. The separate approved journal deployment subsequently preserved both UI hashes.
- Background-poll crash and non-disruptive discovery tests exercise actual server functions, not just source matching. A fresh browser acceptance window is required after the guarded local updates.
- After the discovery fix, process uptime remained continuous and all ten sources were visually inspected across the grid. However, local playlists produced only about 16-22 seconds of media over a 59-second wall-clock window, so smooth real-time acceptance still failed. The session-heartbeat fix is being evaluated against this measured shortfall.
- The first live session-heartbeat verification returned six successful acknowledgements out of six attempts, with zero authentication rejections. This proves the recorder accepts the session-maintenance request, not that video continuity is solved.
- Privacy-bounded ingress diagnostics now classify only the first 16 bytes, discard that prefix, and expose format/counters plus encoder backpressure. They never return source bytes, URLs or identity. All ten live inputs were identified as ISO BMFF; the raw Annex-B/default-frame-rate hypothesis is therefore not supported.
- A planned metrics-only restart preserved all six journal files. In its first measured 60.06-second window, the four initially active relays produced 55.2-57.6 seconds of media without restarting; six additional relays joined during that window. The full ten-channel sustained acceptance remains in progress. `input_idle_ms` measures bytes consumed by the encoder pipe, not necessarily network arrival, so backpressure must be considered before attributing silence to the recorder.
- The next full ten-channel window produced 52.8-58.8 seconds of media in 60.15 wall-clock seconds with no relay restart and 26/26 heartbeat acknowledgements. In a later window all ten upstream sockets reset and recovered; playlist output continued, but browser continuity was not observed because the test tabs had closed. This is not end-to-end acceptance.
- Actual running relay commands used `libx264`, not H.264 stream-copy, with automatic thread counts. The Mac has eight logical CPUs and was heavily loaded. Decoder/filter pools are now bounded to one thread each and x264 to two per channel; real FFmpeg tests exercise both copy and transcode paths with synthetic fragmented MP4. No frame-rate/timestamp rewriting or recorder setting change is used. Resource budgeting is a mitigation; it does not prove the cause of upstream socket resets.

## Remaining Acceptance Gates

- The UI-only deployment is complete. Do not overwrite a later approved journal deployment or include unapproved local runtime changes in Vercel.
- Verify visible native players, scroll/resume, full screen, mobile geometry, six offline sources, and media progress across at least two five-minute lease windows.
- Verify event thumbnail/clip and fresh consent-gated model contract separately with the journal owner. Model loaded is not proof of active event detection.
- Do not overwrite journal code, alter recorder settings, trigger physical controls, or store secrets outside Keychain.

# PUSH 44 — isolated CH1 private media gateway, 2026-10-23

Baseline: `a33e9e109ce98f599e6417449231db35d7c9fe94`.
Branch: `codex/push44-ch1-private-gateway-20261023`.
Scope: isolated implementation and qualification, **not live activation or PUSH 46**.

## Implemented and qualified

- `services/video-gateway/push44-ch1-private-media.mjs`: private TLS server factory and one-shot media gate. Reuses `verifyGatewayPlaybackGrant` from the existing enrollment/playback core; no parallel token format or device identity system.
- Exact source `6fddc732-13df-4268-9f32-3357262ea997`, Site/tenant `cc1673b8-3eb0-4785-a12c-1fb88f425a41`, Home QA enrollment `1c450dca-38a8-4e49-853f-c613ca498c27`, Gateway `62df97e2-3c0b-427f-9108-bde029bc10e7`, stream `dvr_3a2d4e23f178cefa8f_1`.
- Exact Development viewer `00000000-0000-4000-8000-000000000f44`, `LOCAL_SUPABASE`; source environment remains `HOME_PUSH38T_QA`. These are separate authorization domains, not assumed common ownership.
- Delegation contract requires trusted administrator and source-owner verification, purpose, exact full scope, short expiry and current revocation check. No database enrollment/membership/source is created or copied.
- One atomically claimed session/device lease. A durable consumed-approval record is required across process restarts; reconnect and grant renewal never reset the deadline, request count or byte budget.
- Non-resettable maximum 300 seconds, 104,857,600 **media payload bytes including playlists**, 600 media requests, one source/viewer/logical stream. Maximum four simultaneous object requests support an HLS client without creating a second logical stream. TCP/TLS/header overhead is not included in the media-payload metric.
- Before delivery, synchronous reserve covers the complete bounded object; interrupted deliveries are not refunded. Accounting/audit/adapter errors fail closed. Deadline aborts in-flight reads/responses. Per-object maximum 3 MiB; no Range support, redirect, query token, CORS or arbitrary upstream routes.
- Existing 45-second grant semantics preserved. Renewal is bounded to the original lease and consumes distinct nonces; replay, expiry and explicit grant revocation deny further access. Session/delegation is checked before and again after reading each object.
- HLS contract: ordered advertised segments only, non-regressing media sequence, local credential-free URLs, maximum 12 segments/64 KiB playlist, 15-second freshness, no remote URI/key/map/VOD ENDLIST. This is not proof that the existing Home output already satisfies that contract.
- `push44-ch1-operator-journal.mjs`: owner-protected metadata-only journal, fsync, exclusive approval consumption, hash-linked audit entries and refusal to reopen an existing run journal. macOS volume ownership enforcement is checked read-only; `noowners` is not bypassed. No Keychain access or secret files. Hash-linking is integrity evidence, **not independently immutable storage against the host owner**.
- `push44-ch1-development-session.mjs`: pins canonical loopback Development origin, exact approved runtime SHA and LOCAL_SUPABASE identity; requires canonical strict session validation before decoding and matching the approved owner session. No service-role credentials. Native cookie/token custody remains a separately qualified integration boundary.
- `push44-ch1-passive-reader.mjs`: bounded, read-only, generation-pinned file adapter; rejects symlinks, traversal, changing/oversized files, wrong source and aborted reads. Reuses the existing HLS inspection contract and supports actual padded segment names. It never invokes installed playback routes that could call `ensureRelay`.
- `scripts/qa/check-push44-ch1-private-media.mjs`: 22 isolated deterministic security/media/TLS tests, added to the existing mandatory security CI gate. TLS fixtures bind only `127.0.0.1` and are removed afterward. No real media/provider requests.

## Fresh source and database evidence

Read-only Gateway health at `2026-10-23T17:51:10.841Z`: CH1 CURRENT canonical owner, progressing, 63,682,125 input bytes / 33,048 chunks, output idle 331 ms, encoder `libx264`; 10 canonical relays, zero candidate handoffs. Earlier same-task health also progressed. These are **relay input/health counters, not decoded or transferred iPhone footage**.
Exact-source read-only Home QA metadata confirmed CH1 ID/Site above and `connected`; no credential/verifier/media URL read. An initial query referenced a non-existent stream column, failed read-only, then was reduced to the actual permitted metadata columns; no mutation occurred.

Actual canonical isolated Development history/schema check at `2026-10-23T17:51:10.672Z`: PASS, 257 expected = 227 baseline-covered + 30 applied post-baseline, missing/errors none. No migration required or created; RLS/grants unchanged. Home Site/CH1 are not silently added to Development. Earlier canonical 403 Home-source denial remains correct.

## Required activation adapters — NOT satisfied by synthetic tests

Factories intentionally have no runnable live entry point. They require trusted adapters; there is no default permissive implementation:

1. `authenticate`: canonical server-validated Development session (strict expiry/revocation), exact owner profile and operator-approved owner device binding. A client-supplied device/session ID or JWT claims alone is insufficient. Native HLS cookie/header transport and renewal require bounded end-to-end qualification; possession of a bearer URL alone is insufficient.
2. `readDelegation`: protected operator record issued only after separately recorded owner approval and verification of the actual source-domain owner/admin authority. The booleans in the contract are **trusted adapter outputs, not acceptable client assertions**. The draft below is not an active delegation.
3. `consumeApproval` and `audit`: protected run journal on an ownership-enforcing filesystem; exact approved run directory pinned by the operator. Kingston source/builds remain unchanged. The current development volume is not automatically considered suitable for sensitive authorization records. Audit receipts must be preserved independently before claiming immutability.
4. `readMedia`: bounded passive access to the existing sole CH1 relay's output, exact generation/continuity binding and advertised segments. Must honor abort/maxBytes, never start/restart/own a relay, never return another source, and never expose the existing Gateway playback token. Actual output generation/format compatibility is a remaining hardware integration gate. No Home configuration change is authorized here.
5. Reachable trusted HTTPS media origin with correct TLS identity, owner-only ingress and verified provider permission. No ordinary application Tunnel/CDN is approved for video. The TLS test certificate is local-only, not an iPhone-trusted external endpoint.

**Result:** isolated limiter/security implementation qualified; real Home delegation, trusted live adapter wiring and public trusted-TLS media delivery remain BLOCKED. No activation-ready claim from synthetic proof.

## Exact permitted bridge / approval handoff

Do not duplicate the Home source into Development or reuse Production credentials. The permitted mechanism is a **view-only, time-limited delegation** from the existing Home QA source authorization domain to the one Development viewer, enforced solely by this private gate. It grants no Product membership, camera command, telemetry reporting, recording, export or ownership capability.

After the five adapter prerequisites above are verified, request approval to issue **one** delegation for the exact IDs above, one owner iPhone session/device, one CH1 stream, at most 300 seconds / 100 MiB / 600 media requests, with bounded grant renewal. Approval must pin the trusted origin, source-owner authority, run directory, generation, start/expiry, cost ceiling and shutdown operator. There is no active `delegation.json`, real grant, listener, bucket/CORS change or enrollment created by this task.

This is a precise **future** activation request template, not a request to override the remaining technical gates. Next executable independent work: qualify the canonical Development session/native HLS transport and passive CH1 generation reader against isolated fixtures, then verify a permitted trusted-TLS external path before asking for live activation.

## Provider/cost and retention

Existing authenticated-account preflight on this date: Workers Free / R2 Paid; R2 cycle observed/projected $0, 5.29 GB-month, 115 Class A / 17 Class B. No paid activation or new resource. Official [R2 Standard storage classes](https://developers.cloudflare.com/r2/buckets/storage-classes/) allow media/video; [pricing](https://developers.cloudflare.com/r2/pricing/) lists free egress and Standard $0.015/GB-month, $4.50/million Class A and $0.36/million Class B. This does not approve ordinary Tunnel/CDN video delivery.

No R2 data adapter/upload/public bucket/presigned URL is activated or claimed ready. Cost of this task's real media usage: zero media bytes, no new fixed commitment. A later R2-backed variant could be $0 incremental within remaining free quotas, but must separately cap publisher storage/requests and verify private-prefix IAM/retention (do not reuse the release bucket blindly). The consumer cap alone is not a publisher-storage cost limit. Global billing-unit rounding, other account usage, host delivery, taxes and all-in paying-user economics remain activation preflight items; no $0 end-to-end promise is made.

For any later approved window: stop/revoke gate, abort responses, close only its listener/ingress, remove only exact approved temporary media objects, retain sanitized audit receipts according to the approved evidence schedule, and verify anonymous/expired/revoked denial. Never stop the Home Gateway/Connector. Current task retained **no real camera media**.

## Preservation and qualification boundary

No Product route, installed runtime, APNs entitlement, Home service, source identity, Production record or key changed. PR #235 remains separate Draft. Existing 197 North-Star identities and 52 PUSHes unchanged; no capability promoted. PUSH 44 remains PARTIAL / NOT DONE: real cellular video, APNs, native release/store and Android proof remain open. PUSH 45 legal gates remain closed. PUSH 46 not started.

Required exact-head CI must pass before Development integration. Passing it qualifies this isolated code, not live viewing permission or Production activation.

## Final pre-activation follow-up — baseline 4c0d70555cf96c4f5e5d815df7720e5f29c9ea13

Branch: `codex/push44-ch1-final-preactivation`. Existing grant/ledger/lease/deadline/byte controls reused, not rebuilt.

### Fresh actual evidence (2026-10-23 UTC)

- 18:04:59.706 Gateway read-only health: CH1 CURRENT/progressing, 10 canonical relays, no candidate handoffs. Exact Home QA source ID/Site still connected.
- 18:05:36.250 inspected one existing CH1 local segment, generation `0d82ee48-9c55-4069-a5d2-b0db6c84eba6`, `segment-004818.ts`, 171,268 bytes, mtime 18:05:34.028. MPEG-TS, H.264 High Level3.0, yuv420p, 640×480, 25fps, duration1.2s. Local decode:25 frames/25 distinct frame hashes. Only counts retained; no pixels, frame hashes or media saved/uploaded. No playback/HLS route invoked (those can call ensureRelay), no RTSP, grant redemption or new relay. An empty transient generation directory was excluded after the first read-only scan; no Home recovery action.
- Actual playlist: version6, target duration1, 12 sequential padded TS names, EXTINF1.200000, independent segments, no ENDLIST. Apple permits H.264/MPEG-TS and this profile/level; no extra transcoding/repackaging indicated by the sample. Decoder proof is NOT AVPlayer, full continuity or cellular proof. Generation changes must fail closed.
- Exact Home QA Site: owner profile absent, organization absent, zero active Site memberships. Boolean-only exact-owner lookup: no matching owner account/administrator in that QA domain. This does not describe Production ownership. No users, memberships or Site fields were created/changed.
- Candidate `gateway-media-homeqa.ganbatuach.com`: NXDOMAIN; no18443 listener. No DNS/TLS/firewall/public route change.

### Incremental isolated qualification

Added only missing host-memory cookie transport, `push44-ch1-cookie-custody.mjs`: one already approved canonical Development session, opaque __Host cookie, Secure/HttpOnly/SameSite=Strict, 300-second lifetime and timed memory cleanup, fresh session checks, duplicate-cookie denial, no rebind/reset, no raw token in URL/file/client bundle. This is not hardware attestation. Real WKWebView cookie installation and first-party/same-site delivery still require approved integration; an isolated HTTP client does not prove browser cookie policy.

One composed synthetic E2E now exercises canonical session adapter → protected approval journal/delegation → cookie → existing TLS gate → generation-pinned passive reader → generated blue-color H.264/MPEG-TS fixture. It verifies authorized delivery, denial, server revocation, delegation revocation, expiry, reconnect debit, sanitized audit and cleanup. Fixture is NOT camera footage.

Apple's delivery guidance identified missing gzip playlists. Added negotiated gzip in the EXISTING adapter with debit of the actual encoded payload BEFORE delivery. The first composed short-playlist test exposed gzip overhead exceeding the original raw reservation; corrected encoded-byte accounting passes. No cap increase, reset, alternate grant core or bypass.

**23/23 isolated cases PASS**, including original exact300-second/100-MiB/one-viewer boundaries. Registered existing mandatory security suite includes the new composed case. Full exact-head CI required before integration; unrelated completed backup/hardware tests not rerun locally.

### Provider and cost — actual account reads

Existing Workers Free Active / R2 Paid, no upgrade. One R2 bucket `digital-observer-releases`, Standard, Public Access Disabled. Overview:16GB,2.33k ClassA,615 ClassB in its displayed aggregate period. Separate current-cycle billing:5.29GB-month,115 ClassA,17 ClassB,$0 observed/projected; Oct13–Oct23 observed, Oct13–Nov12 cycle. Instantaneous storage and billing-window usage are not interchangeable or final invoices. Existing release bucket is NOT an approved CH1 media destination; no prefix IAM/CORS/publisher/Worker/bucket change.

A. Access: control plane only. B. Ordinary Tunnel/CDN video permission: NOT assumed. C. R2 Standard private objects: media-compatible, but no complete bounded publisher/private authenticated delivery integration verified. D. Existing direct-TLS candidate: DNS absent. Therefore complete permitted HTTPS media path BLOCKED.

No new fixed commitment or remote media traffic. Hypothetical100MiB retained300s in R2 uses about0.00001214GB-month: unrounded storage component about$0.000000182 before tax at$0.015/GB-month. This excludes requests, billing-unit rounding, other usage, publisher/storage bounds, host delivery and taxes. Included quotas could yield$0 marginal R2 charge, NOT a verified end-to-end budget. Existing consumer cap is not a publisher cap. **Complete live-test cost UNKNOWN; activation ineligible until bounded.**

References: [Apple HLS](https://developer.apple.com/streaming/hls-authoring-specification-for-apple-devices.html), [R2 storage](https://developers.cloudflare.com/r2/buckets/storage-classes/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Cloudflare terms](https://www.cloudflare.com/service-specific-terms-application-services/).

### Exact owner handoff, not live activation approval

Required: recorded source-owner attestation and explicit approval to issue ONE view-only QA delegation for the exact pinned CH1/Site/tenant/enrollment/Gateway → pinned Development viewer → one approved owner-iPhone session/device. Purpose:PUSH44 cellular qualification; maximum300seconds from issuance,104857600 cumulative payload bytes,one source/viewer/lease,revocation,sanitized audit,immediate shutdown. No Site membership/ownership change, Production impersonation or credential copying. Trusted operator must verify/issue authority after approval; client booleans are not evidence. No actual delegation was written.

That approval alone MUST NOT open a route. Live test still requires exact trusted hostname/TLS and owner-only ingress, first-party native cookie transport, verified R2 publisher/private scope if selected, bounded full cost and fresh source generation. Then request one exact infrastructure/cost/300s/100MiB activation. Rollback: revoke delegation/cookie/grant, abort transfers, close only dedicated ingress; remove only approved temporary objects and preserve sanitized receipts. Never restart/reconfigure Home services.

**Live readiness NO; real owner authorization PENDING; iPhone/cellular media NOT RUN.** No migration, Production write, paid activation, public ingress, camera/telemetry change or PUSH46. Prior197 capabilities/migrations/session/backup proof and DraftPR235 preserved.

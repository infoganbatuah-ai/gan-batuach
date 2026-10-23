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

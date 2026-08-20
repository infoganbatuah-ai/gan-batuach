# Gan Batuach - Remaining Work To Live Operation

Date: 2026-08-20

The local code-completable critical work identified in this round is complete. The items below require remote environment access, selected providers, hardware, legal review, operations ownership or native SDKs.

The continuous manager registration, 14-day zero-charge trial readiness, mutual parent/kindergarten approval flow, in-app dashboard navigation and assigned/unassigned inspector routing are complete and are therefore not part of the remaining list.

## P0 before any real data

1. Create a separate Pilot Supabase/Vercel environment; do not convert the current Demo database in place for real child data.
2. Apply and verify all migrations there, including `20260820000100_camera_snapshot_storage_privacy_hardening.sql`; repeat the 9/9 sentinel probe before any frame ingestion.
3. Confirm Storage buckets, secrets, callbacks and environment labels in Pilot.
4. Assign named pilot, support, privacy/security, rollback, camera, AI and payment owners.
5. Complete external legal/privacy review or a written, scope-limited risk decision; camera and AI need separate approval.

## P1 live provider work

| Workstream | Current state | External input required | Completion test |
|---|---|---|---|
| Gan Batuach subscription | manual/readiness | payment provider + merchant sandbox | signed checkout, idempotent webhook, no card storage |
| Invoice/receipt | mock/readiness | Israeli invoice provider + accounting decision | one sandbox document, correct revenue stream |
| Email | mock/test | Resend/SendGrid account | allow-listed delivery + callback + unsubscribe |
| SMS | disabled/mock | provider + sender ID + consent | test recipient, callback, rate limit, kill switch |
| WhatsApp | disabled/mock | Meta Business, number and approved templates | opt-in, approved template, delivery/read callback |
| Push | readiness | FCM/APNs credentials and devices | token lifecycle and foreground/background delivery |

## P1 camera and observer technology inside Gan Batuach

1. Deploy an isolated Video Gateway with TLS, signing secret, rotation and monitoring.
2. Connect a non-child Test DVR/NVR/camera and verify ONVIF/RTSP ingest server-side.
3. Move/retrieve credentials through a managed vault and prove no browser/log exposure.
4. Verify HLS/WebRTC token expiry, watermark, view audit and reconnect behavior.
5. Define recording/snapshot retention and deletion jobs.
6. Run a seven-day Test-camera soak before considering a real kindergarten.

## P1 AI Shadow

1. Connect a temporary frame source only after the already-passing Storage gate is repeated in Pilot and Gateway passes.
2. Select/version an inference provider or local model; keep face and audio disabled.
3. Run synthetic Shadow candidates through Human Review.
4. Measure false positives/negatives and approve thresholds.
5. Implement retention, deletion and incident ownership.
6. No raw AI to parents and no automatic accusation/decision.

## P2 platform reliability

1. Add write-path cross-tenant tests to protected CI.
2. Add screenshot regression and accessibility checks.
3. Configure monitoring, redaction/retention, alerting and issue ownership.
4. Prove backup/restore and disaster recovery.
5. Run load/concurrency/soak tests for messages, providers and camera sessions.
6. Commission an external security review after provider/gateway integration.

## P2 native apps

1. Install Android Studio/SDK and set `ANDROID_HOME`; rerun `assembleDebug`.
2. Install/select full Xcode, provisioning and simulator; run iOS debug build.
3. Decide Remote WebView/offline behavior and network failure UX.
4. Test safe areas, keyboard, uploads, deep links and push on real devices.
5. Complete privacy manifests, signing and internal beta; do not submit yet.

## Exit criteria for Gan Batuach completion

- 0 critical/high security blockers.
- Separate Pilot environment and named owners.
- Legal/privacy scope accepted.
- Included provider channels pass Sandbox E2E.
- Camera Gateway passes Test hardware and retention gates if cameras are in scope.
- AI Shadow passes metrics and Human Review if AI is in scope.
- Web role/write QA passes; native passes only if included.
- Final Go/No-Go explicitly approves the limited scope.

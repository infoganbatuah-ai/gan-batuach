# PUSH 38U — live-staging gate result (2026-09-19 UTC)

**NOT READY FOR LIVE RUNTIME TRANSITION.** Candidate code remains frozen at `d39cace17df05b9bb4dfee2a0a026e3f7723238e` on `codex/push-38t-qualification`. This report contains read-only findings only; it does not authorize a runtime transition, trust installation, ingress exposure, Production release, canary, pre-soak or V8.

## Migration reconciliation

The isolated PUSH 38T QA database still has zero `auth.users`, managed-device enrollments and release-download authorization records. Its pinned schema-only Development baseline and three applied PUSH 38 migrations passed the earlier representative schema/RLS checks. However the baseline provenance itself is marked `DERIVED_NOT_YET_CANONICALLY_VERIFIED`, and the three migrations were applied directly to this disposable QA database rather than recorded in canonical Supabase migration history. A full independent schema fingerprint plus source/history reconciliation was not obtained. **MIGRATION DRIFT = NOT PASS**; no Production database access or write was used.

## Real installed identity boundary

Read-only inspection of the existing Connector's configured secret-directory **names** found the legacy refresh credential but not the Ed25519 private-key item expected by the installed identity client. The Gateway LaunchAgent is configured for Keychain storage. Metadata-only lookup of its exact expected Ed25519 item returned absent or inaccessible, while legacy refresh/device identifiers were present. No secret value or private key was read, copied or logged.

This does not prove the Product database's identity scheme by itself, but it **does not establish device-held Ed25519 possession** for either installed legacy component. The required real-device challenge signatures and owner-verified public-key binding cannot be honestly asserted. No QA enrollment record was created and no exact-device release was signed. The existing QA importer remains fail-closed pending independently authenticated Product/device evidence. A different device proof or controlled credential bootstrap would require an explicit reviewed contract; it must not be improvised from a caller-supplied device ID or copied Production HMAC secret.

## Fresh read-only Home checkpoints

- Gateway: one current checkpoint reported `healthy`, 10 streams, 0 failed, 10 progressing and 0 stalled. The most recent discovery recorded 16 physical DVR positions: 10 assigned/connected, 6 unassigned. Two preceding `/health` probes timed out at 4 and 8 seconds before a subsequent recovery; therefore response reliability is not qualified.
- Connector/Tapo: the first checkpoint reported 1 stream and 1 progressing relay while also reporting `failedStreamCount=1`. A later checkpoint at 2026-09-19 21:31:44 UTC reported 1 stream, `failedStreamCount=1`, **0 progressing relays**, and top-level `healthy`. The legacy response did not supply enough structured attribution to identify source versus transport versus relay. Tapo health and playback readiness are **not PASS**.
- No current Product video playback or AI result was observed. Live Gateway/Connector artifact baseline hashes were not recomputed in this step; earlier matches must not be reused as a fresh gate.

## Remote phone playback — source-level root cause

The current `origin/main` and frozen candidate both include `app/api/digital-observer/dvr-gateway/route.ts`, which issues a browser `claim_url` at `http://127.0.0.1:18082` or `:18083`. `components/digital-observer/observer-live-player.tsx` then executes `fetch(claimUrl)` **in the viewing browser**. On a separate phone, `127.0.0.1` denotes the phone, not the Site Edge Mac. The Product therefore currently has a **client-local Gateway/Connector dependency for this playback path**, consistent with the owner's Mac-works/phone-fails report. This is a proven source-level design defect; the actual Production deployment SHA and phone network trace were not observed, so the exact deployed failure response is not claimed.

The correct future owner-controlled release must replace the client-local claim/media path with an authorized remote Platform/Edge playback route and prove DVR/Tapo playback on a separate device. Merely staging or activating the signed Gateway/Connector remediation archives will not remove the Product's browser-local URL. No Production deployment was attempted.

## STOP decision and next authority

Because real Ed25519 possession is unproven, Tapo is currently failing and the remote-client invariant is violated, do not open external QA ingress or install live trust merely to make the route reachable. No AWS signing operation, R2 download, public tunnel or paid provider resource was created by PUSH 38U; the restricted supplier-cost ledger has no new usage to reconcile from this step.

Required next work: (1) reconcile the QA schema/history against an independent pinned expected fingerprint, (2) determine the authoritative live Product identity scheme and an owner-approved public-key/challenge bridge for the existing **same** device IDs, (3) restore and attribute Tapo progression, (4) implement and verify a remote-safe Product playback path, then rerun exact-candidate CI and the staged live trust/auth/R2 gates. The last two items exceed a staging-only interpretation of PUSH 38U and need explicit scoped authorization before implementation. Integration/development, main and Production remain unchanged by this task.

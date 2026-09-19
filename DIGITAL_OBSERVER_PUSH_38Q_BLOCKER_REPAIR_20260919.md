# PUSH 38Q — HOME_QA private R2 authorization repair

Status: development implementation only. No Production deployment, schema application, live trust installation, OTA installation, or camera runtime change is authorized or claimed by this report.

## Root cause and repair

The deployed control plane does not contain the release-download authorization route, so its POST returns 404. The unreleased route was tied to Supabase Storage signed URLs and lacked a HOME_QA channel. The reviewed source now verifies the managed-device token and enrollment, an exact-device signed HOME_QA manifest, published release/rollout metadata, compatibility, trust/revocation, and update direction before issuing a 120-second SigV4 GET grant for the manifest's exact private R2 object. The R2 secret stays on the server. The device still checks HTTPS, size, SHA-256, and Ed25519 before atomic staging. The grant is bearer access after issuance; it is not a cryptographically device-bound R2 session and must never be logged or treated as a permanent URL.

The schema extension is a new, unapplied migration. No existing signed release artifact was changed. Historical broad-cohort QA manifests are **not** activated by this source change; replacement AWS-signed exact-device metadata and a protected live public trust registry are separate release prerequisites.

## Evidence boundary and outstanding gates

- Local deterministic tests cover valid HOME_QA scope, wrong device/profile/architecture/channel, revoked device, broad cohort, tampered manifest/reference, untrusted key, downgrade, legacy recovery prefix, and exact R2 object/120-second grant shape. They do **not** prove live cross-tenant isolation, live expiry, replay handling, or a real device-authenticated R2 download.
- Local results: `check-push38q-r2-download`, `check-push38o-home-qa-publication` (9), `check-remote-edge-signer` (14), `check-edge-release-trust`, OTA regression, TypeScript typecheck, targeted ESLint, migration-health, security CI gate (7 suites), release-contract preflight, and a full local Next production build passed. The broader domain gate stopped on an unrelated missing benchmark-contract document. The production dependency audit could not reach the npm advisory endpoint. Neither limitation is a PASS.
- The previous three real private R2 round-trips and local/historical signed-manifest hash comparisons remain preserved in `DIGITAL_OBSERVER_PUSH_38_R2_CONTINUATION_20260919.md`. Those were publisher-access checks, not device-authenticated authorization checks.
- This branch cannot be called live-ready until a separately reviewed non-Production control-plane deployment/schema/configuration is authorized, exact-device AWS-signed releases are published, the protected public trust registry is installed, negative tests are run on the running service, and a no-install HOME_QA staging dry run succeeds. Do not deploy the full PUSH 38 branch merely to clear the 404.
- No new AWS or R2 resources or fixed recurring supplier charge were introduced by this code. Existing R2 object storage and download operations are metered. Total all-supplier monthly cost and per-paying-user ceiling remain unverified.

Owner: PUSH 38 release/control-plane workstream. Next action: review the scoped diff and migration, finish required CI/security tests on the exact commit, then coordinate the explicitly approved development control-plane release and staging-only qualification. Main and Vercel Production remain unchanged.

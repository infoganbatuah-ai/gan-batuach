# Digital Observer Production Remaining Work

Date: 2026-08-20

This is the honest remaining work after the standalone product implementation. Items requiring external accounts, hardware, legal approval or store access cannot be completed from repository code alone.

## P0 - close before any external pilot

1. **Apply runtime migration**
   - Run `supabase/migrations/20260820010000_digital_observer_product_runtime.sql` on Supabase project `gan-batuah`.
   - Rerun `npm run qa:digital-observer-product`.
   - Acceptance: 33/33 with synthetic home and business users and no foreign-tenant rows.

2. **Real visual/manual acceptance**
   - Review home, business and admin on real Android/iPhone plus desktop Chrome/Safari.
   - Confirm keyboard, safe areas, camera permissions, offline/reconnect and background/resume behavior.

3. **External legal/privacy review**
   - Privacy, terms, AI notice, recording/retention, known-person consent, notification consent and account deletion.
   - Business facial-recognition use requires separate policy/legal approval.

## P1 - sandbox integrations

4. **Camera Gateway lab**
   - Select or deploy the server/edge gateway.
   - Test one IP/ONVIF camera, one NVR/DVR channel, one RTSP-over-TCP stream and one cloud/API connector.
   - Verify secret vaulting, rotation, connection diagnostics, preview, reconnect, health and audit.
   - Do not promise universal compatibility until the hardware matrix passes.

5. **AI shadow provider**
   - Connect a sandbox/isolated vision provider or local model worker.
   - Test person/object/motion/obstruction/entry-exit with confidence and human review.
   - Validate rule parsing, duplicate suppression, clip boundaries and feedback isolation.
   - Face recognition remains separately consent-gated.

6. **Notification providers**
   - Push, email, SMS, WhatsApp and voice each need a sandbox account, sender verification, templates and webhook/retry validation.
   - Preserve channel/source attribution so Gan Batuach and standalone Digital Observer events remain distinguishable.

7. **Billing and invoice providers**
   - Select a sandbox card provider and Israeli invoice provider.
   - Add webhook signature checks, idempotency, failed-payment/grace/refund flows and receipt reconciliation.
   - Apple/Google subscriptions require server-side receipt verification and entitlement reconciliation.

8. **Gan Batuach integration QA**
   - Keep `DIGITAL_OBSERVER_GAN_BATUACH_INTEGRATION_ENABLED=false` until a hashed token and active scoped client are provisioned server-side.
   - Test camera health and reviewed events only; build separate signed media endpoints if approved.
   - Parent camera permission, temporary token and session audit remain mandatory and independent.

## P2 - production/native readiness

9. **Native builds and devices**
   - Android debug/release build, iOS Xcode archive, real-device matrix, deep links, push permission, network security and privacy manifests.
   - `npx cap sync` already passes; Android debug build still needs an environment that permits Gradle cache writes.

10. **Operations**
    - Assign support, privacy/security, camera, AI, billing and rollback owners.
    - Configure monitoring, queue/storage budgets, backups, incident logs, alerting and provider kill switches.

11. **Production security verification**
    - External RLS/tenant penetration test, storage signed-URL tests, rate limits/WAF for public forms and APIs, secret rotation and audit retention.

12. **Store submission**
    - Only after native QA, legal texts, screenshots, support URL, privacy declarations, signing and Apple/Google billing policy review.

## Definition of done

Production is ready only when P0 is closed, every enabled P1 provider has sandbox evidence and Go/No-Go approval, native target QA passes, no critical/high tenant or privacy blocker remains, and live activation is performed through explicit server-side gates. Code readiness alone is not approval to connect real cameras or people.

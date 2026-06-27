# MOBILE 1 - Real Device Test Plan

Date: 2026-06-27

## Preconditions

Before testing on devices:

- `npm run build` passes.
- `npx cap sync` passes.
- `CAPACITOR_SERVER_URL` points to the correct HTTPS pilot/development URL.
- No signing keys or certificates are committed.
- Test accounts exist for parent, manager, staff, inspector, and admin.
- No real child sensitive data is used unless explicitly authorized.

## iPhone Manual Test

Install/run method:

1. Open `ios/App/App.xcworkspace` in full Xcode.
2. Select a development team and a physical iPhone.
3. Confirm Bundle ID `com.ganbatuach.app`.
4. Build and run Debug.

Test cases:

- App launches and loads the configured URL, not localhost unless intentionally testing local network.
- `/app` gateway is usable.
- Login form fits screen and keyboard does not hide submit button.
- Registration and role selection cards are tappable.
- Parent dashboard: child card, requests, messages, payments/readiness, camera unavailable state.
- Manager dashboard: garden status, children, enrollment requests, staff, documents, subscription/payment status.
- Staff dashboard: unassigned and assigned states, attendance, shifts, documents.
- Inspector dashboard: pending/approved state, assigned gardens, inspection form, evidence upload state.
- Admin dashboard: approvals, users, payments, alerts, provider health.
- Digital Observer dashboard: sites/cameras/readiness/review queue without fake live claims.
- Bottom navigation does not cover content.
- Safe area works around notch/home indicator.
- Back gestures and browser navigation do not trap the user.
- Camera/AI pages do not expose credentials or raw events.
- Push permission is requested only when configured and intentionally tested.

Collect:

- device model
- iOS version
- app build/version
- screenshots of auth, one role dashboard, one long form, one modal/drawer
- any console/device logs for crashes

## Android Manual Test

Install/run method:

1. Ensure Gradle distribution/dependencies are available.
2. Open `android/` in Android Studio.
3. Confirm package `com.ganbatuach.app`.
4. Build and run Debug on a physical Android device.

Test cases:

- App launches and loads configured URL.
- Login/register keyboard behavior works.
- Android back button behavior is sane on `/app`, login, registration, and dashboards.
- Parent, manager, staff, inspector, admin, and Digital Observer dashboards fit mobile viewport.
- Bottom nav and sticky CTAs are reachable.
- Upload/document controls do not crash.
- Camera/AI readiness states do not expose secrets.
- Push device token behavior is tested only with configured FCM sandbox/dev setup.

Collect:

- device model
- Android version
- app build/version
- screenshots of auth, one role dashboard, one long form, one table/list, one modal/drawer
- Logcat errors if any

## Pass Criteria

- No launch crash.
- No localhost URL in non-local build.
- Login/register usable on mobile.
- Role dashboards remain app-like.
- No bottom-nav overlap.
- No horizontal overflow on critical screens.
- No secret/camera/AI/payment exposure.
- Push remains disabled/readiness unless provider and device token are configured.

## Fail Criteria

- Build/install fails.
- App loads wrong URL.
- Auth unusable.
- Any role dashboard inaccessible.
- Sensitive data or credentials appear in WebView.
- Camera/AI live status is claimed without real validated provider/gateway.

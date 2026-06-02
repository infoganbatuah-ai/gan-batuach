# Gan Batuach Android / iOS Packaging Readiness

Gan Batuach uses one product and one backend:

- One Next.js web platform
- One Supabase project
- One set of routes and dashboards
- One authentication model
- Capacitor native shells for Android and iOS

The mobile app should wrap the same deployed web application. Do not fork or duplicate the system.

## Current Capacitor Status

Configured file:

- `capacitor.config.ts`

Generated native projects:

- `android/` generated successfully with Capacitor.
- `ios/` generated successfully with Capacitor.
- `npx cap sync` completed successfully for both platforms.

Current strategy:

- `appId`: `com.ganbatuach.app`
- `appName`: `גן בטוח`
- `webDir`: `public`
- `server.url`: read from `CAPACITOR_SERVER_URL`, then `NEXT_PUBLIC_APP_URL`, then `http://localhost:3000`
- `cleartext`: enabled only for local `http://localhost`, `127.0.0.1` or Android emulator `10.0.2.2`
- splash/status colors use Gan Batuach blue `#123b8f`

Why this matters:

- The app is not a separate static export.
- It loads the same production web platform and Supabase backend.
- Login, redirects, dashboards, uploads and camera permission logic remain shared.

## Web And Native Strategy

Web:

- Users open the regular browser app.
- Supabase auth and route guards behave normally.

Mobile:

- Capacitor opens the same app URL.
- Users use the same login page.
- After login, role redirect remains shared:
  - parent -> `/dashboard/parent`
  - manager / owner -> `/dashboard/garden`
  - staff -> `/dashboard/staff`
  - inspector -> `/dashboard/inspector`
  - admin -> `/dashboard/admin`, allowed but not marketed in mobile onboarding

## App Home Experience

Opening the app should load the same Gan Batuach landing/login experience:

- Gan Batuach branding
- one login for all roles
- short role explanation
- dashboard redirect if already logged in

No separate native homepage is required unless a future native-only capability demands it.

## Environment Variables

Required for mobile packaging:

- `CAPACITOR_SERVER_URL=https://app.your-domain.co.il`
- `NEXT_PUBLIC_APP_URL=https://app.your-domain.co.il`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only variables stay on the web server and must not be embedded in the native app:

- `SUPABASE_SERVICE_ROLE_KEY`
- `FIELD_ENCRYPTION_KEY`
- `CRON_SECRET`
- `HEALTHCHECK_SECRET`
- `VIDEO_GATEWAY_SIGNING_SECRET`
- `AI_OBSERVER_SECRET`

## Auth And Session Readiness

Current app auth uses Supabase SSR cookies. In a Capacitor webview that loads the deployed web domain, cookie-based auth should work as long as:

- the app always loads the same `CAPACITOR_SERVER_URL` origin
- Supabase auth redirect URLs include the production domain
- logout clears the Supabase session
- password reset links return to the same app domain

Future native enhancement:

- If cookie persistence is unreliable on a target OS version, add a native session bridge using Capacitor Preferences or Secure Storage.
- Do not add native token storage until a real device test proves it is needed.

## Deep Links

Recommended future scheme:

- Android/iOS custom scheme: `ganbatuach://`
- Universal/app links: `https://app.your-domain.co.il`

Notification links should keep using existing `action_url` paths, for example:

- `/dashboard/parent/notifications`
- `/dashboard/garden/children?status=pending`
- `/dashboard/garden/finance?filter=failed`

## Native Permissions Plan

Do not request permissions on app launch. Request only when the user performs an action.

Android permissions to plan:

- Camera: for profile/child/pickup photos if capturing from camera
- Photo/media picker: for uploading profile, child, pickup and document images
- Notifications: for future push notifications
- Microphone: only if a future feature explicitly records audio
- Location: only if staff GPS attendance is enabled in mobile app flows

iOS permissions to plan:

- `NSCameraUsageDescription`: taking profile/child/pickup photos
- `NSPhotoLibraryUsageDescription`: choosing upload photos/documents
- `NSUserNotificationUsageDescription`: future push notifications
- `NSMicrophoneUsageDescription`: only for future audio features
- `NSLocationWhenInUseUsageDescription`: only for staff GPS attendance

## Push Notification Readiness

Foundation implemented for future provider connection. The current behavior is safe mock mode:

- Device tokens are stored in `push_device_tokens`.
- Push attempts are logged in `push_notification_logs`.
- `/api/push/register` registers Web/Android/iOS tokens for the authenticated user only.
- `/api/push/unregister` deactivates the current user's token/device.
- Admin diagnostics are available at `/dashboard/admin/push`.
- No real Push is sent unless a real provider adapter is intentionally enabled.

Provider roadmap:

- Web: Web Push with VAPID keys and a service worker.
- Android: Firebase Cloud Messaging.
- iOS: Apple Push Notification Service.
- Capacitor: `@capacitor/push-notifications` bridge for native token registration.

Environment variables prepared:

- `PUSH_PROVIDER=mock`
- `FCM_SERVER_KEY`
- `FCM_PROJECT_ID`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### Android FCM Setup Plan

1. Create Firebase project for Gan Batuach.
2. Add Android app with package `com.ganbatuach.app`.
3. Download `google-services.json`.
4. Keep server credentials outside the client app and configure only on the web server.
5. Install and configure Capacitor Push Notifications after the Android project exists.
6. Register the FCM token through `/api/push/register`.

### iOS APNs Setup Plan

1. Configure bundle id in Apple Developer account.
2. Create APNs auth key and keep it server-only.
3. Enable Push Notifications capability in Xcode.
4. Install and configure Capacitor Push Notifications after the iOS project exists.
5. Register the APNs/FCM token through `/api/push/register`.

### Web Push Setup Plan

1. Generate VAPID public/private keys.
2. Keep `VAPID_PRIVATE_KEY` server-only.
3. Expose `VAPID_PUBLIC_KEY` only through a safe client config endpoint when Web Push UI is added.
4. Add a service worker that receives Push and opens `action_url`.
5. Ask browser permission only after the user explicitly enables notifications.

### Push Deep Links

Push payloads should keep using existing `action_url` values, for example:

- `/dashboard/parent`
- `/parent-onboarding?childId=...`
- `/dashboard/garden/messages?status=open`
- `/dashboard/garden/finance?filter=failed`
- `/dashboard/inspector/inspections`

Native app handling should resolve these paths against `CAPACITOR_SERVER_URL` and open the same shared route.

## Icons And Splash

Current available brand assets:

- `public/assets/company-symbol.png`
- `public/assets/company-name.png`
- `public/assets/hero-control-center.png`

Before store submission:

- Generate Android adaptive icons from `company-symbol.png`
- Generate iOS app icon set from `company-symbol.png`
- Use Gan Batuach blue `#123b8f` for splash background
- Avoid random placeholder assets

## App-Safe Route Checklist

Verify in Android and iOS webviews:

- `/login`
- `/auth/callback`
- `/api/auth/logout`
- `/dashboard/parent`
- `/dashboard/garden`
- `/dashboard/staff`
- `/dashboard/inspector`
- `/parent-onboarding`
- `/dashboard/parent/cameras`
- `/dashboard/garden/cameras`
- `/dashboard/parent/documents`
- `/dashboard/parent/settings`

Special attention:

- File uploads should open mobile picker.
- Camera/photo uploads should preview correctly.
- External links should open safely outside the app or in a controlled browser flow.
- Camera viewing must not expose RTSP, credentials or raw diagnostics.

## Android Setup

Android project exists in `android/`.

Requirements:

- Android Studio
- JDK compatible with the Android Gradle plugin
- Capacitor CLI available through `npx cap`

Common commands:

```bash
npm ci
npm run build
npm run mobile:sync
npm run mobile:open:android
npm run mobile:build:android
```

Google Play readiness checklist:

- package name is `com.ganbatuach.app`
- app name is `גן בטוח`
- generated icons use Gan Batuach branding
- release signing is configured outside the repository
- no real secrets are stored in Android project files
- production `CAPACITOR_SERVER_URL` points to the deployed Gan Batuach URL
- Supabase auth redirect URLs include the production domain
- file upload flows work from Android photo picker
- camera viewing opens inside the app without exposing technical stream fields
- privacy policy and store listing are ready
- FCM setup is completed only when real push notifications are enabled

## iOS Setup

iOS project exists in `ios/`.

Requirements:

- macOS
- Xcode
- Apple Developer account
- Capacitor CLI available through `npx cap`

Common commands:

```bash
npm ci
npm run build
npm run mobile:sync
npm run mobile:open:ios
```

After setup, verify:

- bundle id is `com.ganbatuach.app`
- app name is `גן בטוח`
- app icons use Gan Batuach branding
- signing team is configured in Xcode
- privacy descriptions are added for camera/photo/notifications when used
- no real secrets are stored in iOS project files
- production `CAPACITOR_SERVER_URL` points to the deployed Gan Batuach URL
- Supabase auth redirect URLs include the production domain
- file upload flows work from iOS photo picker
- camera viewing opens inside the app without exposing technical stream fields
- APNs setup is completed only when real push notifications are enabled

## App Build Scripts

- `npm run mobile:sync`: sync web assets and Capacitor config to Android/iOS.
- `npm run mobile:open:android`: open Android project in Android Studio.
- `npm run mobile:open:ios`: open iOS project in Xcode.
- `npm run mobile:build:android`: run Android debug Gradle build from the generated Android project.

iOS builds should be performed from Xcode or a dedicated macOS CI lane after signing is configured.

## Icon And Splash Next Steps

The generated projects currently use Capacitor defaults plus the configured Gan Batuach splash color. Before store submission:

- Generate Android adaptive icons from `public/assets/company-symbol.png`.
- Generate iOS AppIcon set from `public/assets/company-symbol.png`.
- Verify splash screen uses Gan Batuach blue `#123b8f`.
- Avoid embedding real customer images in app icons or splash assets.

## Native Project Safety

Verified during generation:

- No `.env*` files were copied into `android/` or `ios/`.
- No files matching `*secret*` or `*credential*` were generated in the native projects.
- Native projects wrap the same deployed web platform and do not duplicate product code.

## Store Readiness Checklist

Google Play:

- App name and description
- Screenshots for parent, manager and staff flows
- Privacy policy URL
- Data safety form
- Push notification declaration if enabled
- Camera/photo/file upload permissions explained
- Signed release build

App Store:

- App name and subtitle
- Screenshots for iPhone and iPad if supported
- Privacy nutrition labels
- Privacy policy URL
- Camera/photo/notification usage descriptions
- Apple Developer signing
- Review notes explaining role-based dashboards

## Android Test Checklist

- Open app
- Existing session redirects to correct dashboard
- Login
- Logout
- Parent dashboard
- Manager dashboard
- Staff dashboard
- Inspector dashboard
- Parent onboarding
- Upload child/parent photo
- Upload document
- Open notification center
- Open parent cameras
- Open manager cameras
- Camera without playback source shows friendly waiting state

## iOS Test Checklist

- Open app
- Existing session redirects to correct dashboard
- Login
- Logout
- Parent dashboard
- Manager dashboard
- Staff dashboard
- Inspector dashboard
- Parent onboarding
- Upload child/parent photo
- Upload document
- Open notification center
- Open parent cameras
- Open manager cameras
- Camera without playback source shows friendly waiting state

## Current Blockers Before Native Store Build

- Capacitor packages are not listed in `package.json`; install them before running native setup:
  - `@capacitor/core`
  - `@capacitor/cli`
  - `@capacitor/android`
  - `@capacitor/ios`
- Android and iOS project folders have not been generated yet.
- Real production `CAPACITOR_SERVER_URL` must be set before native sync.
- Push notifications need a future implementation before real FCM/APNs delivery.

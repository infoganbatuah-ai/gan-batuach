# MOBILE 1 - Capacitor Configuration Audit

Date: 2026-06-27

## Configuration Summary

- Capacitor is configured in `capacitor.config.ts`.
- `appId`: `com.ganbatuach.app`
- `appName`: `גן בטוח`
- `webDir`: `public`
- `bundledWebRuntime`: `false`
- Runtime strategy: hybrid WebView loading a configured web URL through `server.url`.
- Default URL resolution:
  - `CAPACITOR_SERVER_URL`
  - fallback `NEXT_PUBLIC_APP_URL`
  - fallback `http://localhost:3000`

## Web/App Packaging Strategy

The current native app is not a fully bundled static Next.js export. It loads the Gan Batuach web app in a Capacitor WebView using `server.url`.

This means:

- Normal UX/UI web changes reach mobile through the deployed web URL.
- `npx cap sync` is still required after native config, plugin, icon, splash, or bundled asset changes.
- A production mobile build must not ship with `http://localhost:3000`; `CAPACITOR_SERVER_URL` must point to the intended HTTPS deployment before store packaging.

## Native Projects

Android:

- `android/` exists.
- Package/application ID matches `com.ganbatuach.app`.
- Main manifest exists at `android/app/src/main/AndroidManifest.xml`.
- Only `android.permission.INTERNET` is currently requested.
- App icon and splash assets exist in Android resource folders.
- `google-services.json` is optional and not committed; Gradle logs that push will not work without it.

iOS:

- `ios/` exists.
- Bundle identifier is configured through Xcode project settings as `com.ganbatuach.app`.
- `Info.plist` exists.
- App icon and splash assets exist.
- No Apple certificates, provisioning profiles, or signing secrets were found in the checked native project paths.

## Plugin Configuration

Configured plugins:

- SplashScreen
- Haptics
- StatusBar

No native camera, microphone, location, Face ID, or push plugin permission prompt was confirmed in the native config during this pass.

## Security Notes

- No secrets are present in `capacitor.config.ts`.
- Capacitor server URL is environment-controlled.
- Cleartext is allowed only for local development URLs matching localhost/127.0.0.1/10.0.2.2.
- Production packaging must use HTTPS.

## Status

configuration_status = ready_for_sync

Remaining blockers:

- real_device_required: Native app behavior must be validated on physical iOS and Android devices.
- app_store_account_required: Store signing, certificates, and submission were not attempted.
- provider_required: Push requires FCM/APNs credentials and real device token validation.

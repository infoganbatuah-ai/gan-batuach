# Observer Android offline QA package — local receipt

This is a Development-only, unsigned offline qualification artifact. It has not been installed on a device and is not Product, login, media, or Push proof.

- Source baseline: `07e9a9ac95f6e901defa8ee762947cac0a568df6`.
- Build: `CAPACITOR_PRODUCT=observer CAPACITOR_BUILD_PROFILE=qa ./gradlew :app:assembleObserverObserverQa --offline --no-daemon --quiet` with the existing Kingston Android SDK and JDK 21. PASS on 2026-11-16. The SDK XML compatibility warning did not fail the build.
- Artifact: `android/app/build/outputs/apk/observer/observerQa/app-observer-observerQa-unsigned.apk` on the Development drive; 5,756,065 bytes; SHA-256 `b0cda800337624e6e43700fb20f663511d7c6ac373ac8f2ecb08556f1b1bbd3d`.
- Android package: `com.digitalobserver.app.qa`, version `1.0-qa`, label `תצפיתן דיגיטלי`; callback scheme `observerqaandroid` is retained by the Observer QA variant.
- Bundled web assets: only the generated offline Capacitor config, four non-Push plugin registrations, native bridge, and `public/index.html`. The bundled page SHA-256 matches `ios/qa-observer/index.html`: `c9e36076c877afd1ee7b2f005f73042052a51b06ba648460d0d6aafaa0ed1581`. It states that this is a local installation check. There is no remote server URL or Gan web application asset.
- Config has `androidScheme: https`, no `server.url`, and no PushNotifications plugin. APK manifest permissions are Internet, network state, and the app's non-exported dynamic receiver permission; no notification permission was listed. No Firebase/Push credentials were provided or packaged. Dormant Firebase library metadata can remain from shared native dependencies; that is not evidence of Push delivery.
- `apksigner verify` rejects the artifact as unsigned (`Missing META-INF/MANIFEST.MF`), as intended. It cannot be installed without a separately approved signing step.
- The generated asset directory is synchronized, so stale assets cannot survive between builds. The Gan variant's source assets and existing guard remain separate.

No device installation, external endpoint, database access, Production change, remote Git action, or media activation occurred.

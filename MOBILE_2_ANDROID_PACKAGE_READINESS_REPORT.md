# MOBILE 2 - Android Package Readiness Report

Date: 2026-06-27

## Project Status

- `android/` exists.
- Package namespace/application ID: `com.ganbatuach.app`
- App label: `גן בטוח`
- Manifest exists.
- App icon resources exist.
- Adaptive icon resources exist.
- Splash resources exist.
- Current permission set: `android.permission.INTERNET`
- No release keystore, APK, AAB, or signing secret was found in checked project paths.

## Build Attempt

Command attempted:

`GRADLE_USER_HOME=/private/tmp/gan-batuach-gradle ./gradlew assembleDebug`

Result:

- failed due environment/network restriction, not app code.
- Gradle wrapper attempted to download `https://services.gradle.org/distributions/gradle-8.14.3-all.zip`.
- DNS/network access to `services.gradle.org` failed in this environment.

## Release Readiness

Google Play final expected artifact:

- signed release `.aab`

Do not commit:

- `.apk`
- `.aab`
- `.jks`
- `.keystore`
- keystore passwords
- signing config with secrets

## Manual Android Studio Steps

1. Ensure `CAPACITOR_SERVER_URL` points to the intended HTTPS staging/pilot URL.
2. Run `npm run build`.
3. Run `npx cap sync`.
4. Open `android/` in Android Studio.
5. Let Gradle download dependencies.
6. Build Debug on a real device.
7. Create release signing key outside the repository.
8. Generate signed `.aab`.
9. Upload to an internal Google Play testing track only after privacy/data safety/reviewer notes are ready.

Status:

- android_project_ready = true
- android_debug_build_local = blocked_by_network
- android_release_ready = signing_required

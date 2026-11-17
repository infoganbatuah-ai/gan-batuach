# PUSH 44 Observer Android QA visual identity

The Observer QA Debug selection uses `CAPACITOR_PRODUCT=observer` and
`CAPACITOR_BUILD_PROFILE=qa`. It retains the separate
`com.digitalobserver.app.qa` package, `observerqaandroid` callback and
`.invalid` Development launch URL. The Gan default and release selection remain
unchanged.

The Observer launcher icon and launch mark are byte-identical copies of the
already approved iOS Observer QA assets. The manifest selects them only for
Observer, with a separate dark launch theme. Gan continues using its original
launcher and splash resources. Shared camera code is unchanged.

Focused local checks: `check-observer-android-qa-identity.mjs`,
`check-push44-capacitor-local-url.mjs`, and
`check-push44-android-deeplink-replay.mjs` (13 tests passed).

An offline Debug APK was built with the existing external-drive Android SDK,
JDK 21 and Gradle cache. Local artifact (ignored, not committed):
`android/app/build/outputs/apk/debug/app-debug.apk`, 23,129,544 bytes,
SHA-256 `b0b840f3792076f76ada1aca89d5c1579b79eccd5aba95487ec4df2e92906b25`.
`aapt` verifies package `com.digitalobserver.app.qa`, Hebrew Observer label,
Observer launcher icon, callback `observerqaandroid` and cleartext disabled.
`aapt2` verifies the Observer splash theme and launch mark. The packaged icon
and mark hashes match the approved iOS Observer QA assets. The embedded
Capacitor config points only to the inert
`https://observer-qa.example.invalid/digital-observer/dashboard` and selects
the dark Observer splash/status bar. `apksigner` verifies Android Debug signing.
No `google-services.json`, service-account/credential file, or Firebase app ID,
API key or sender-ID resource was found in the APK. The common Capacitor Push
plugin and manifest permissions remain present; this is **not** live Push proof.
No physical-device installation, provider activation or media test occurred.

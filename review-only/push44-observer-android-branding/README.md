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

No Debug APK was produced in this worktree: after Capacitor sync and resolving
Gradle plugins on the external drive, `assembleDebug` stopped at
`SDK location not found`. No `ANDROID_HOME` or `android/local.properties` points
to an installed SDK. The artifact must be rebuilt and inspected after a valid
external-drive Android SDK is located or installed. Even then, a Debug-signed
`.invalid`-URL APK is not physical-device, Push, provider or media proof.

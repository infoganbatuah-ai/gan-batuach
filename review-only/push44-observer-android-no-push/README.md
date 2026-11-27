# PUSH 44 — offline Observer Android QA notification boundary

The prior named Observer QA APK inherited `POST_NOTIFICATIONS`, the Capacitor
messaging service, Firebase receiver/service/discovery and initialization
provider from the shared Push plugin. No provider credentials were present.

`src/observerObserverQa/AndroidManifest.xml` removes only this variant's
notification/FCM permissions and entry points. `ganDebug` and `ganRelease`
retain the existing shared plugin manifest. The Observer runtime additionally
waits for the native app ID and permits only the real Gan release package
(`com.ganbatuach.app`, which can open Observer screens) or the future Observer
release package (`com.digitalobserver.app`) on Android/iOS. Both `.qa` packages,
unknown IDs and other platforms fail closed. The offline
`com.digitalobserver.app.qa` package cannot call the runtime's permission or
registration path, even though the shared Capacitor plugin class and
`assets/capacitor.plugins.json` remain packaged. This is not a general removal
of the shared Push dependency or a future-release policy change.

Both APKs were built locally with the installed external-drive SDK/JDK and
cached dependencies, after separate matching Capacitor sync operations:

| APK | Bytes | SHA-256 |
| --- | ---: | --- |
| `android/app/build/outputs/apk/observer/observerQa/app-observer-observerQa.apk` | 23,128,283 | `f161c9a3346e981d7c620545aecc864a4a3fb78786c4be1c39e33e37acc7c5de` |
| `android/app/build/outputs/apk/gan/debug/app-gan-debug.apk` | 23,129,071 | `4def3d1823a438ead05eb3f807a9e308d184f6e0c84bacc95869b2ba2f96a514` |

The Gan APK hash is identical to the prior qualified Gan Debug build. Actual
Observer merged manifest/APK inspection found no `POST_NOTIFICATIONS`,
`WAKE_LOCK`, C2DM receive permission, Capacitor messaging service, Firebase
receiver, discovery service or init provider. Gan retains the existing
notification permission and FCM entry points. Neither APK contains a provider
credential file. Focused tests 12/12, TypeScript and focused lint passed.

The APKs are Debug-signed and use `.invalid` QA URLs. No physical-device prompt,
provider delivery, Push token, media or Production behavior was tested.

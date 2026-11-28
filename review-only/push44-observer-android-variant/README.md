# PUSH 44 — named Android QA product variants

Gradle now exposes only `ganDebug`, `ganRelease`, and `observerObserverQa`.
`assembleDebug` still assembles only Gan Debug; `assembleRelease` selects only
Gan Release. Observer QA requires the explicit `:app:assembleObserverObserverQa`
task. The Observer QA build type inherits Debug signing and never has a Release
variant. Each variant verifies that the staged Capacitor product/profile and
exact URL match before packaging; Gan-staged assets were rejected by the
Observer verification task with `CAPACITOR_PRODUCT_VARIANT_MISMATCH`.

Capacitor has one shared `src/main/assets` staging location. Build the two
products **sequentially**, running `cap sync android` with the matching
`CAPACITOR_PRODUCT`, profile, URL and approved origin before each Gradle task.
Do not invoke both product assembly tasks against one staged asset snapshot.
No second camera engine or native client was introduced.

Using the existing external-drive SDK/JDK/Gradle cache, both real APK builds
passed. Local ignored artifacts (not committed):

| Variant | APK | SHA-256 |
| --- | ---: | --- |
| Observer QA | `android/app/build/outputs/apk/observer/observerQa/app-observer-observerQa.apk` (23,129,027 bytes) | `ed5eb36a953d1c3c8f4a01cdaed9c2c6e500a82f4da0e0025b91751a3e4cd45a` |
| Gan Debug | `android/app/build/outputs/apk/gan/debug/app-gan-debug.apk` (23,129,071 bytes) | `4def3d1823a438ead05eb3f807a9e308d184f6e0c84bacc95869b2ba2f96a514` |

`aapt` and embedded config inspection confirmed distinct package, label,
callback, icon, splash color and inert `.invalid` QA URLs. `apksigner` verified
Android Debug signing. Neither APK contains a `google-services.json`,
service-account/credential file, or Firebase app ID/API key/sender-ID resource.
The common Push plugin is packaged, but provider credentials and live Push are
not activated. These builds are not device, Push or media proof.

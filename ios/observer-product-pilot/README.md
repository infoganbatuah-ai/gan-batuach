# Digital Observer Product pilot for iPhone

Use the existing App target and PersonalTeamQA configuration with the explicit
`ObserverProductPilot.xcconfig` override and fresh derived data. The build
phase validates the pilot plist and generates its runtime resources. Its only
remote entry is `https://gan-batuach.vercel.app/digital-observer/login`. The
normal Product sign-in form posts to the same origin and issues the app's own
session cookies. From the dashboard, select the existing Home Site and open
Cameras. The server continues to enforce account and Site authorization.

The pilot has the distinct bundle ID `com.digitalobserver.app.pilot`, which
gives iOS a separate application container. It excludes the QA Swift bridges
and custom callback, and the config contains only the App plugin. It uses
Capacitor's same-origin navigation behavior with an empty external allowlist.
Capacitor can hand external top-level links off to iOS. Confirm that normal
Product sign-in, dashboard and Cameras stay inside the app during device QA.

Future qualification, after authorization:

1. Prepare the normal iOS project resources in a clean worktree. Produce the
   unsigned bundle using the pilot override in its own derived-data directory.
2. Inspect the resulting plist, Capacitor config, and binary. Resolve an
   eligible provisioning profile for the exact pilot bundle ID. Verify the
   final signature and entitlements. Existing QA provisioning is for another
   identity. This source change supplies no Product signing material.
3. Record the existing installed app identities. Install the pilot beside
   them, then sign in directly in the pilot. Check that the expected Home Site
   and Cameras open, and test resume, cold start and logout. Confirm Product
   source health before testing authorized CH1 playback over cellular.
4. To roll back, sign out of the pilot and remove only its bundle from the
   iPhone. The separate bundle ID lets the previous app remain available.

Run these source checks from the repository root on macOS. Set
`OBSERVER_PILOT_TEST_ROOT` to an existing writable directory on
`/Volumes/DIGITAL_OBSERVER`. The fixtures are removed when each test ends.

```sh
OBSERVER_PILOT_TEST_ROOT="$PWD" node --test scripts/qa/check-observer-ios-product-pilot.mjs
```

With the locked Capacitor dependencies and Swift packages already available
on the development drive, inspect the effective Xcode settings without a build.
Use an unused result-bundle path for each invocation.

```sh
PILOT_SETTINGS_ROOT="$PWD/.source-settings"
PILOT_SWIFT_PACKAGES="/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/SwiftPackages"
mkdir -p "$PILOT_SETTINGS_ROOT/tmp" "$PILOT_SETTINGS_ROOT/cache"
TMPDIR="$PILOT_SETTINGS_ROOT/tmp" xcodebuild \
  -project ios/App/App.xcodeproj -target App -configuration PersonalTeamQA -sdk iphoneos \
  -xcconfig ios/observer-product-pilot/ObserverProductPilot.xcconfig \
  -clonedSourcePackagesDirPath "$PILOT_SWIFT_PACKAGES/Clones" \
  -packageCachePath "$PILOT_SETTINGS_ROOT/cache" \
  -resultBundlePath "$PILOT_SETTINGS_ROOT/target.xcresult" \
  -disableAutomaticPackageResolution -skipPackageUpdates -showBuildSettings
```

Check that the effective target settings include `com.digitalobserver.app.pilot`,
`OBSERVER_PRODUCT_PILOT`, and `CODE_SIGNING_ALLOWED = NO`. The effective
`INFOPLIST_FILE` resolves from `ios/App` to
`ios/observer-product-pilot/Info.plist`.

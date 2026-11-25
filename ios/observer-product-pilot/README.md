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

Source tests use temporary generated bundles and plists. They do not compile,
sign, install, or access the Product host. Run them on macOS with
`node --test scripts/qa/check-observer-ios-product-pilot.mjs`.

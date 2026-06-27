# MOBILE 2 - iOS Archive Readiness Report

Date: 2026-06-27

## Project Status

- `ios/` exists.
- Xcode project/workspace exists.
- Bundle ID: `com.ganbatuach.app`
- Display name: `גן בטוח`
- App icon asset exists.
- Launch/splash asset exists.
- No certificates, provisioning profiles, `.ipa`, or private Apple keys were found in checked project paths.

## Current Info.plist Permission State

No usage descriptions are currently configured for:

- camera
- microphone
- location
- photo library
- Face ID / biometrics

This is acceptable only while those native permissions are not requested. If upload, GPS, or push flows require native permissions on device, precise usage descriptions must be added before archive submission.

## Archive Readiness

Full archive was not attempted because the environment has Command Line Tools active rather than full Xcode.

Manual Xcode steps:

1. Install/open full Xcode.
2. Open `ios/App/App.xcworkspace`.
3. Set Apple Developer Team.
4. Confirm Bundle ID `com.ganbatuach.app`.
5. Set final marketing version/build number.
6. Add required capabilities only when used.
7. Build on real iPhone.
8. Archive.
9. Upload to TestFlight only after reviewer accounts, privacy labels, and legal review are ready.

Status:

- ios_project_ready = true
- ios_archive_ready = xcode_required
- signing_status = apple_developer_required

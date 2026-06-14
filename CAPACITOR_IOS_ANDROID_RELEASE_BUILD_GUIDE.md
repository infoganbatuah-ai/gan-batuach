# Capacitor iOS / Android Release Build Guide

Status: documented process only. Do not run production signing or upload without explicit approval.

## Preconditions

- Developer accounts are verified.
- Store metadata is ready.
- Privacy labels and Data Safety are approved.
- Screenshots use synthetic data only.
- Demo reviewer accounts are prepared securely.
- Signing assets are stored outside the repository.
- Production environment points to the approved app URL.

## Web Build And Capacitor Sync

Typical flow:

```bash
npm run build
npx cap sync
```

Use the approved environment before building. Do not place secrets in `NEXT_PUBLIC_*` variables.

## iOS Build Readiness

Open the iOS project in Xcode:

```bash
npx cap open ios
```

Review:

- bundle identifier
- display name
- version
- build number
- signing team
- provisioning profile
- permission strings
- launch screen
- app icon

Archive and upload only after final approval.

## Android Build Readiness

Open Android project:

```bash
npx cap open android
```

Review:

- application ID
- versionName
- versionCode
- target SDK
- signing configuration
- app icon
- splash screen
- permissions

Generate release build only after signing assets are ready outside the repo.

## Native Plugin Verification

Verify:

- push token registration
- deep links
- permissions prompts
- camera/photos upload if used
- location flows if used
- secure logout
- sensitive screen behavior

## Rollback

If a release candidate is not safe:

- do not upload
- keep web/PWA deployment active
- return release status to `preparing`
- fix blockers
- rerun mobile QA


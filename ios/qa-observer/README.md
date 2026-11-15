# Digital Observer iOS QA — offline unsigned build

This is an isolated, non-installable source/build qualification of the Observer app identity. It does not change the Xcode project's Release or PersonalTeamQA defaults. The runtime URL uses `.invalid` deliberately; it cannot be used for a live login or media test.

From the repository root, with existing local Capacitor dependencies:

```sh
CAPACITOR_BUILD_PROFILE=qa CAPACITOR_SERVER_URL=https://gan-qa.example.invalid CAPACITOR_ALLOWED_SERVER_ORIGIN=https://gan-qa.example.invalid ./node_modules/.bin/cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration PersonalTeamQA -destination 'generic/platform=iOS' -derivedDataPath /path/on/external-drive/ObserverQADerivedData -xcconfig ios/qa-observer/ObserverQA.xcconfig CODE_SIGNING_ALLOWED=NO build
swift scripts/qa/finalize-observer-ios-qa.swift /path/on/external-drive/ObserverQADerivedData/Build/Products/PersonalTeamQA-iphoneos/App.app ios/qa-observer/capacitor.config.json
```

The finalizer refuses a signed bundle, a wrong bundle identity, a wrong callback scheme, an unexpected remote URL, or embedded Push credentials. Capacitor may mechanically rewrite tracked local-package paths when `node_modules` is a symlink; restore those generated path changes before committing. Do not install or distribute this unsigned `.app`.

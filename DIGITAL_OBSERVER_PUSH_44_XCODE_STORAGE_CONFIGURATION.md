# DIGITAL OBSERVER — PUSH 44 XCODE STORAGE CONFIGURATION

Date: 2026-10-20

Scope: Development-only iOS qualification. No Production deployment, store
submission, paid-provider activation or customer data was used.

## Result

Xcode 26.3 (17C529) is installed at `/Applications/Xcode.app` and selected as
the active developer directory. Reproducible Xcode build artifacts are
configured on the encrypted external APFS volume mounted at
`/Volumes/DIGITAL_OBSERVER`. The repository and worktrees were already on that
volume and were not migrated again.

The external volume is required for the new scripted iOS qualification builds.
The build helper fails closed if the volume is not mounted or if the checkout is
not below that mount; it never falls back to internal DerivedData.

## Configured paths

| Artifact | Path | Result |
|---|---|---|
| DerivedData | `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/DerivedData` | Xcode custom location and command-line build path verified |
| Archives | `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/Archives` | Xcode custom location verified; no archive created |
| Swift package clones | `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/SwiftPackages/Clones` | Explicit build path verified |
| Swift package cache | `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/SwiftPackages/Cache` | Explicit build path verified |
| Result bundles | `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/ResultBundles` | Simulator and device result bundles verified |
| Compilation cache | `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/DerivedData/CompilationCache.noindex` | Follows Xcode custom DerivedData |

Xcode's supported Locations settings were used for DerivedData and Archives.
No symlink was created in an Apple-protected directory.

## Apple-managed internal storage

Xcode 26.3 exposes no supported custom location for installed simulator
runtimes or simulator device data. Those remain in Apple's managed locations:

- simulator runtime: `/Library/Developer/CoreSimulator`;
- simulator device data: `~/Library/Developer/CoreSimulator`.

No additional runtime was installed. Only the iOS 26.3 runtime required by the
current Xcode installation was used.

## Storage observations

Before the first configured build, internal free space was approximately
9.2 GiB. After the first simulator initialization it was 7.8 GiB. The decrease
is attributable primarily to Apple-managed simulator device initialization,
which cannot be relocated through an official Xcode setting.

Observed after exact-commit builds:

| Location | Observed size |
|---|---:|
| External DerivedData | 489 MiB |
| External Swift package clones | 28 MiB |
| External Swift package cache | 8.3 MiB |
| External result bundles | 156 KiB |
| External Archives | 0 B |
| Internal Xcode application | 3.7 GiB |
| Internal simulator runtimes | approximately 20 GiB |
| Internal simulator device data | approximately 1.5 GiB |
| Internal legacy/default DerivedData | 28 MiB |
| Downloaded Xcode archive retained in Downloads | 2.1 GiB |

The Xcode archive was not deleted because this task does not authorize removal
of existing developer data.

## Volume health

The external volume is APFS, encrypted, writable and had approximately 1.6 TiB
free after the builds. Two online `verifyVolume` runs reported compressed-file
resource-fork warnings and performed deferred repair actions; each then ended
with “appears to be OK.” This is **PARTIAL**, not a clean storage-health PASS.
Run macOS Disk Utility First Aid while the volume is offline during an approved
maintenance window before treating it as fully qualified long-term build
storage. The repository, databases, Supabase, Docker data and worktrees were not
moved or altered.

## Reproducible commands

- `npm run mobile:sync:ios`
- `npm run mobile:build:ios:simulator`
- `npm run mobile:build:ios:device:unsigned`

The two build commands record their selected external paths and create an
`.xcresult` bundle on the external volume. The device command is an unsigned
compile qualification only; it is not installation or real-device proof.

## Build evidence

Exact portable-helper commit `9c886315`:

- iOS Simulator Debug target: **NATIVE BUILD PASS**;
- generic iOS arm64 Debug target with signing disabled: **NATIVE BUILD PASS**;
- Capacitor sync with five official plugins: **PASS**.

The app process installed and launched in an iPhone 17 Pro / iOS 26.3
simulator, but its WebView failed with `NSURLErrorDomain -1004` because no
approved Development endpoint was available and the localhost fallback was not
running. This is **SIMULATOR FAIL**, not SIMULATOR PASS.

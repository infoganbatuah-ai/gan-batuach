# Connector installer UX — PUSH 17B

## PUSH 17D VERIFIED STATUS

Connector remains an exception. Internal commercial flow is READY. The macOS DMG is self-contained and graphically verified: mount → open Digital Observer → `התקן והמשך` → per-user app + RunAtLoad/KeepAlive LaunchAgent. The real service ran, survived a controlled restart and stayed safely at `WAITING_FOR_INSTALL` until an authorized short-lived pairing file exists. No Terminal or separate Node/npm/FFmpeg/model installation.

Enrollment is automatic after the customer opens the one-time `.observer-connect` file: durable local identity/poll proof, single-use actor/Site-bound claim, original-account approval, heartbeat, same-wizard detection and automatic discovery. Windows has a WinForms/.NET 8 + WiX automatic-service implementation with DPAPI/named-pipe handoff; real Windows execution remains external. macOS public distribution remains `EXTERNAL DISTRIBUTION GAP — APPLE SIGNING`; local package is verified, not notarized.

## PUSH 17C POSITIONING

Connector is an exception, not a Digital Observer requirement. New installation requests must first pass the canonical server assessment; a usable persistent zero-install route precludes the installer step. Original Site/account confirmation and existing device lifecycle are preserved. Computer questions occur only after path assessment. No new package installation, signing or native lifecycle verification was performed in 17C; the local 17B package does not become Production Verified by reuse. Complete installer/discovery customer continuation remains an internal gap, separately from Apple credentials.

## STATUS

LOCAL PACKAGE QA ONLY. Commercial flow NOT READY. No public download, Production deployment, native service installation or camera migration occurred. Signing is not the only blocker.

## MACOS FLOW

Target: same Add Cameras wizard → Install and continue → download/open Digital Observer → normal OS approval → Install → open short-lived pairing document → approve computer in original wizard → cameras found → confirm.

Implemented source: `services/connector-desktop/macos/DesktopHost.swift` supplies Cocoa UI, per-user app installation, LaunchAgent, document association and Keychain helper. `scripts/build-connector-macos.mjs` builds a new isolated app, never installs/enrolls or contacts cameras. arm64 app compiled and package smoke passed. Native install/login/reboot/uninstall was NOT executed on the monitored host.

## WINDOWS FLOW

NOT READY. No Windows installer/service executable built. The `windows-x64` contract is not platform support. Installer/secure-host implementation is internal work; real Windows/UAC/reboot validation is an additional external gap. No PowerShell workaround is an acceptable customer flow.

## PACKAGE CONTENTS

Local package: approximately 384 MB; shared Gateway/Connector JavaScript core, desktop runner, Node, FFmpeg/FFprobe, relocated native closure (22 binaries/libraries), ONNX Runtime 1.29.0 and digest-verified existing SSD MobileNet model. Bundled binaries and actual model load passed. No customer secrets/config/media copied. Explicit build-time binary inputs are not customer prerequisites. FFmpeg/codec and other redistribution licenses/notices require review before public distribution.

## INSTALL

Native Install copies the app to the user's Applications directory and registers a fixed per-user LaunchAgent. Registration failure is not success. This code was compiled, not run as a real installer. There is no approved same-wizard public download yet.

## ENROLLMENT

Dashboard creates a ten-minute single-use actor/Site-bound intent, storing only a digest. `.observer-connect` contains an ephemeral bearer, not permanent credentials. Never commit/log it or put it in a URL. Native claim only prepares canonical enrollment; original actor confirms the computer. No manual Device/Site/Tenant IDs or token copy. Identity, poll proof and prepared refresh secret are stored in Keychain before transport. Delivery recovery requires original proof and current prepared refresh hash.

## BACKGROUND SERVICE / RESTART

RunAtLoad/KeepAlive after user login, NOT pre-login monitoring. Same canonical core; separate commercial data directory/Keychain service/local port. Existing DVR/Tapo services were untouched. Actual reboot/login recovery remains unverified; isolated enrollment restart tests passed.

## UNINSTALL / REVOKE

Native confirmation removes its exact LaunchAgent/Keychain service and trashes its app. Camera/Event history is retained. Cloud revoke remains a separate authorized Product action. Automated uninstall+revoke+truthful Product state is not verified. Do not present it as complete.

## REINSTALL

Enrolled identity blocks blind re-enrollment. Pending request retry preserves identity and proof. Expired unapproved request replacement preserves installation ID; DB rejects duplicate active enrollment. Full reinstall-after-uninstall recovery UX remains incomplete.

## FAILURE RECOVERY

Expired request → renew in same wizard. Wrong account → initiating account. Stale heartbeat → waiting, never connected. Lost delivery → original durable proof. Background generic ACTION_REQUIRED status still needs detailed diagnosis/retry integration. Current configuration runner supports one selected camera; commercial multi-camera continuation is not complete.

## SIGNING STATUS

AD-HOC LOCAL QA ONLY; 0 valid signing identities. Developer ID, entitlement review, notarization/stapling and Gatekeeper verification are pending. Never instruct Gatekeeper bypass. [Apple Developer ID](https://developer.apple.com/developer-id/) documents distribution identity requirements. License review is separate from Apple signing.

## CUSTOMER LANGUAGE

“נדרש רכיב חיבור קטן”, “התקן והמשך”, “מחכים לרכיב החיבור”, “אישור חיבור המחשב לבית הזה”. No Node, ports or commands in normal onboarding. Current UI explicitly says the public installer is unavailable rather than offering a fake Install action.

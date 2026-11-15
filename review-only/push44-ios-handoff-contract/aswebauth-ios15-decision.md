# ASWebAuthenticationSession callback availability — iOS 15 QA

Local Xcode iPhoneOS 26.2 SDK headers provide the decisive availability facts:

- `ASWebAuthenticationSession`'s `initWithURL:callbackURLScheme:completionHandler:`
  is available since iOS 12. The header says this initializer can nominate the
  callback scheme even if it is not registered in `Info.plist`.
- The newer `initWithURL:callback:completionHandler:` and
  `ASWebAuthenticationSessionCallback.https(host:path:)` are available only
  since iOS 17.4. The HTTPS callback header requires the host to be associated
  with the app using **associated web credentials** domains. It is therefore
  not an iOS-15-compatible escape from domain association.
- PersonalTeamQA targets iOS 15 and strips `CFBundleURLTypes`; its current
  signing entitlements are empty. No callback mechanism is active in it.

Apple's public [ASWebAuthenticationSession reference](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)
and [callback reference](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/callback)
describe the supported system-browser callback APIs. The local SDK headers
above establish exact availability for this installed toolchain.

`AsWebAuthIos15Probe.swift` is a **review-only, compile-only iOS primitive**
using the old custom-scheme initializer. The `enabled` flag is false, no code
calls `start()`, and the file is not in the Xcode target. Its parser accepts
only `observerqa://return/qa/device-proof?state=<64 lowercase hex>`; it
rejects extra parameters, fragments, changed scheme/host/path and short or
wrong state. The callback emits no URL or token, only a clean `onValidated`
signal. A future implementation must generate and retain unpredictable state
in the trusted app process, bind it to the current Development account and
installation, establish an authenticated one-use server-side exchange, and
test the scheme behavior on the signed physical iPhone. It must not use a
bearer, cookie, Supabase token or approval credential in the callback URL.

Verification: iOS 15 cross-target Swift typecheck PASS against installed SDK;
local Swift parser/default-off test 10/10 PASS on macOS. These do **not** prove
physical-iPhone callback delivery or account/session authorization. No
entitlement, URL registration, signing, endpoint, DNS or network service was
changed.

# PersonalTeamQA callback signing decision — read-only

## Observed local state

- `ios/App/App.xcodeproj/project.pbxproj`, PersonalTeamQA: bundle ID
  `com.ganbatuach.app.qa`, iOS deployment target 15.0, automatic signing,
  `CODE_SIGN_ENTITLEMENTS = ""`.
- The PersonalTeamQA build phase deletes `CFBundleURLTypes` from the built
  `Info.plist`. The production `App/App.entitlements` contains only the APNs
  environment and is not used by PersonalTeamQA.
- `AppDelegate.swift` delegates Universal Links to Capacitor. A new QA return
  gate is dormant and default-off; it has no Associated Domains entitlement,
  live callback producer, or authenticated account/installation source.
- No local IPA or `.mobileprovision` artifact was found in the inspected iOS
  project/cache paths. Thus the signed installed artifact's effective
  entitlements and the Personal Team provisioning service's ability to grant
  Associated Domains are **not proven** by this source inspection.
- Read-only DNS lookup for `qa-iphone-device-proof.ganbatuach.com` was denied
  by the local sandbox (`dig` socket bind not permitted). Current hostname
  resolution/AASA serving is **not verified**. No DNS or provider mutation was
  attempted.

## Apple contract and decision

Apple states that Universal Links require both an Associated Domains
entitlement in the app and an `apple-app-site-association` file at the exact
HTTPS subdomain, served without redirect. See [Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains).
Apple also states provisioning capabilities depend on program membership;
its [iOS capability reference](https://developer.apple.com/help/account/reference/supported-capabilities-ios)
does not establish the entitlement of *this* unsigned source or installed
PersonalTeamQA package. Therefore the current PersonalTeamQA build **cannot
be qualified as a Universal Link callback build**, and whether a regenerated
Personal Team profile could grant this entitlement remains unproven. Do not
add an entitlement or assume Apple will issue it based on source alone.

The preferred conditional alternative is Apple's
[ASWebAuthenticationSession callback](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/callback)
with an exact return matcher, using a browser-carried one-time opaque state
only. The callback must not contain an access token, bearer, Supabase cookie,
authorization code, device private key, or approval credential. The app must
validate the state, and a future authenticated server-side exchange must bind
the same Development account/session and approved installation with atomic
one-use consumption and device proof. Apple documents that the authentication
session delivers a matching callback to its initiating app even when another
app registers the same custom scheme; this does **not** replace server-side
binding or prove compatibility with the current PersonalTeamQA signing setup.
The current build deliberately strips custom URL schemes, so any custom-scheme
variant also requires a separately reviewed signing/build change and real
device test. An HTTPS callback matcher may avoid custom-scheme registration,
but its API availability for the iPhone OS and installed SDK must be verified
before selection. Neither variant is active or implemented here.

## Exact next gate

Before choosing an iOS callback: inspect a signed PersonalTeamQA artifact's
effective entitlements and provisioning profile without exposing signing
secrets; verify Apple's supported callback API against the actual target OS;
then qualify the exact hostname and AASA or session callback on a physical
iPhone under separate authorization. Until then keep the native gate off and
the remote-build block in place. No signing, DNS, provider, service, device,
or Production change was made by this receipt.

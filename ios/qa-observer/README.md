# Digital Observer iOS QA — isolated build states

This is an isolated source/build qualification of the Observer app identity. It does not change the Xcode project's Release or PersonalTeamQA defaults. The earlier signed QA build used a `.invalid` server URL, which overrides its bundled page and can produce a black screen. The default offline template has no remote URL and displays "בדיקת התקנה מקומית בלבד". The separately opted-in authenticated-origin candidate is restricted to the exact Observer QA host and instead bundles "חיבור QA טרם אומת" as its local fallback. Neither page proves login, media, Push or a reachable QA service.

The Observer-specific xcconfig selects `ObserverQAIcon`, rasterized from the existing Observer SVG. Its dedicated launch storyboard is compiled into the unsigned bundle by the Swift finalizer; no Gan splash asset is selected for launch. This is a source-controlled build override, not yet a distinct Xcode target or signed distribution configuration.

The default finalizer accepts only an unsigned bundle with no remote URL. With `OBSERVER_QA_AUTH_BUILD=1` alone, it accepts only `https://observer-qa.ganbatuach.com/digital-observer/dashboard` and the exact `observerqaapp://return/qa/device-proof` callback contract; this still does not sign or install the app. Both modes reject a wrong bundle identity, callback scheme or embedded Push credentials. The finalizer compiles the Observer-only launch storyboard and chooses the appropriate local status page. No current source-level test proves a signed authenticated package, live QA host or callback. Do not install or distribute an unsigned `.app` as an authenticated build.

### First-party iOS login candidate

Set `OBSERVER_QA_FIRST_PARTY_LOGIN=1` alongside the authenticated build settings when preparing the config and finalizing the unsigned bundle. Set `OBSERVER_QA_LAUNCH_URL=https://observer-qa.ganbatuach.com/digital-observer/login` for preparation. Capacitor uses the exact HTTPS origin with a trailing slash as its navigation boundary and opens `digital-observer/login` as its start path. The form submits to the existing Product login handler in the same WebView. The dedicated host must be qualified for native access before distribution.

On macOS, run `node --test scripts/qa/observer-first-party/session.test.mjs` with the repository dependencies and Xcode available. The probe uses a nonpersistent macOS WebKit view and loopback HTTPS with a temporary test certificate trusted only by the probe. It exercises the Product login POST and SSR cookie handling with synthetic Auth and Site responses. Dashboard content is a test marker. Real iPhone lifecycle, the hosted hostname and TLS remain separate qualifications.

### Single-use owner approval

For the dedicated hostname the QA proxy serves an approval form at the normal login URL. The operator supplies a fresh, private output path in `PUSH44_QA_APPROVAL_OUTPUT`. The proxy writes a newly generated code there once with owner-only permissions. The owner has two minutes and five attempts to enter it in the app. A successful POST consumes the code and issues a separate host-only, Secure, HttpOnly gate cookie for the rest of the QA window. Product login and Product authorization still run independently. Stopping the proxy invalidates the window. Remove the private output file after use.

The listener is loopback-only. External qualification requires an independently verified TLS ingress that sets the exact Host and HTTPS protocol headers, plus an isolated QA backend. The gate cookie demonstrates admission to a temporary QA window. Cryptographic installation identity remains a separate qualification.

# Digital Observer Auth And Subscriptions Visual QA

Date: 2026-08-22
Environment: local production build (`next start`) connected to the configured Supabase project
Data: synthetic QA accounts only

## Acceptance Result

`PASS_AUTH_AND_SUBSCRIPTIONS_NO_LIVE_BILLING`

The captured screens render without horizontal overflow at the tested widths. The home, business and Digital Observer Admin sessions use separate signed-in accounts and distinct dashboard experiences. The screenshots do not contain passwords, access tokens, provider secrets or real customer data.

## Evidence

| Area | Viewport | Evidence | Result |
|---|---:|---|---|
| Home dashboard | 390 x 844 | `home-dashboard-mobile-390.jpg` | PASS |
| Home subscription catalogue | 390 x 844 | `home-billing-mobile-390.jpg` | PASS |
| Business dashboard | 1280 x 720 | `business-dashboard-desktop-1280.jpg` | PASS |
| Business dashboard | 820 x 1151 | `business-dashboard-tablet-820.jpg` | PASS |
| Business subscription catalogue | 1280 x 720 | `business-billing-desktop-1280.jpg` | PASS |
| Observer Admin control center | 390 x 844 | `admin-dashboard-mobile-390.jpg` | PASS |
| Observer Admin control center | 768 x 1024 | `admin-dashboard-tablet-768.jpg` | PASS |
| Observer Admin control center | 1280 x 720 | `admin-dashboard-desktop-1280.jpg` | PASS |
| Login | 390 x 844 | `login-mobile-390.jpg` | PASS |
| Registration | 390 x 844 | `register-mobile-390.jpg` | PASS |
| Forgot password | 390 x 844 | `forgot-password-mobile-390.jpg` | PASS |
| Reused/invalid recovery link | 390 x 844 | `recovery-invalid-mobile-390.jpg` | PASS |

The replacement recovery screenshots were captured after route loading completed. Their measured browser width and document width were both 390 pixels, and the route loader opacity was `0`.

## Functional Evidence

- Real home, business and product-scoped Observer Admin logins reached their expected dashboards.
- A regular business account was denied access to the Observer Admin route.
- A real recovery email reached the pilot mailbox, the fresh link opened the password form, the password was updated through Supabase, and the local session was signed out.
- Reusing the same recovery link produced the neutral expired/used-link screen.
- Home accounts saw home plans only. Business accounts saw business and enterprise plans only.
- Subscription changes remain server-side readiness requests and do not invoke a payment provider.
- The automated Digital Observer suite passed 64/64 checks against Supabase and RLS.
- A fresh synthetic home signup produced a real confirmation email after the Supabase template was repaired and Auth was restarted to clear its stale configuration.
- The latest one-time confirmation link returned to `/digital-observer/login`; a real login then issued session cookies and redirected to `/digital-observer/onboarding?type=home`.

## Remaining Scope Boundary

The final signup E2E used the one-time confirmation link. The numeric OTP path remains implemented with `email` to `signup` fallback but was not separately entered in the final browser run. Live billing, cameras, AI, external messaging and emergency actions remain intentionally disabled and were not accepted by this report.

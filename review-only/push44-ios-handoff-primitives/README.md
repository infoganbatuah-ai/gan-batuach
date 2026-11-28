# PUSH 44 — existing primitive inventory for iOS QA handoff

Offline source review only. No SQL was executed, no route was opened, and no
physical iPhone or provider behavior was tested. The companion fixture test
pins the inspected contracts; it does not prove the absence of every possible
implementation outside these files.

| Need | Existing source | Decision |
| --- | --- | --- |
| Development session validation | `lib/domain/digital-observer/access.ts` validates Supabase user, profile, Observer account and active session. | Reusable for a future authenticated handoff endpoint, but the current QA proxy does not call it. |
| One-time redemption | `lib/domain/single-use-auth-code.ts` memoizes one Supabase code exchange in a browser tab. | Not a durable or atomic server-side consume operation; it even returns the same result on replay in that tab. |
| Durable state | `digital_observer_sso_transactions` has state hash, expiry and consumed timestamp, but is tied to an SSO connection and lacks QA user/session/installation binding. | Do not repurpose without a new, reviewed schema and authorization contract. Shared AI job/result tables are likewise unrelated service-only coordination. |
| Native callback | `AppDelegate.swift` forwards app URLs and Universal Links to Capacitor. The PersonalTeamQA configuration has no approved handoff callback or `ASWebAuthenticationSession` exchange. | A supported exact-audience app return and physical-device proof are missing. |
| Current QA entry | `push44-owner-qa-proxy.mjs` accepts a reusable bearer in a GET query and sets a cookie in the requesting browser. `prepare-push44-iphone-qa-config.mjs` blocks remote packaging. | Keep the block. Neither copying the cookie nor embedding the bearer is an acceptable handoff. |

## Exact missing dependency

There is no currently identified primitive that atomically stores and consumes
a short-lived handoff bound to the Development session, intended installation,
callback audience and one-time nonce. The existing proxy has no session-aware
redemption route, and the QA app has no verified callback/exchange. Implementing
this safely requires a new server-side store or reviewed extension to an
appropriate existing store, a narrow authenticated endpoint, and a native
return contract. A process-local map would fail on restart or multiple workers
and would not prove replay resistance. Do not build it under this offline task.

Future target files, subject to a separately scoped task: a reviewed
Development-only migration or existing durable-store contract; a new narrowly
scoped `app/api/digital-observer/qa-handoff/` endpoint; the QA proxy route
allowlist; a native callback handler/entitlement appropriate to the approved
iOS signing configuration; and focused replay, cross-account, cross-device,
expiry, cancellation, revocation and physical-device tests. No secret may appear
in the signed IPA, callback URL, diagnostics or client-accessible storage.

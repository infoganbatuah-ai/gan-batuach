# PILOT FIX 8 - Negative Provider / Payment Tests

Date: 2026-07-05

| Test | Expected result | Actual result | Status | Severity | Fix needed |
|---|---|---|---|---:|---|
| Parent cannot access platform subscription records | denied | requires real RLS dataset | MANUAL_REQUIRED | high | Verify with Pilot Fix 2/5 data. |
| Staff cannot access payment/provider records | denied | requires real RLS dataset | MANUAL_REQUIRED | high | Verify with assigned/unassigned staff. |
| Inspector cannot access payment/provider records | denied | requires real RLS dataset | MANUAL_REQUIRED | high | Verify assigned/unassigned inspector. |
| Manager A cannot see Kindergarten B subscription | denied | requires real RLS dataset | MANUAL_REQUIRED | critical if fails | Verify manager scope. |
| Digital Observer billing not visible to Gan Batuach parent | denied | requires separated tenant data | MANUAL_REQUIRED | high | Verify product context. |
| Payment success cannot be faked client-side | denied | webhook side effects guarded server-side | PASS_STATIC | high | Live test still required. |
| Duplicate webhook does not double-activate subscription | duplicate ignored | idempotency implemented | PASS_STATIC | high | Provider replay test required. |
| Invalid webhook signature rejected | rejected | implemented by webhook guard | PASS_STATIC | high | Live env test required. |
| Missing live credentials block live mode | blocked | readiness guard checks missing config | PASS_STATIC | high | Verify deployed env. |
| Live payment button disabled if provider not approved | disabled/readiness | manager sandbox route returns no live checkout | PASS_STATIC | high | UI walkthrough required. |
| Invoice not issued in production without approval | blocked | production invoice not active | PASS_STATIC | high | Provider setup required. |
| External notification not sent if channel disabled | blocked/dry-run | providers default mock/dry-run | PASS_STATIC | high | Wrong-recipient tests required. |

## Result

Negative provider/payment tests are acceptable for static closure, but real environment RLS and provider replay tests remain required before live use.

# AUTHED UX/UI QA 2 - Safe Fixes Applied

## Fix 1 - Parent Children Query Schema Mismatch

| Field | Detail |
|---|---|
| File | `lib/domain/parent-family.ts` |
| Change | Removed `pickup_status` from the Parent children select list. |
| Reason | Runtime server logs showed `column children.pickup_status does not exist` while loading the authenticated Parent dashboard. |
| Safety note | This does not broaden access, does not bypass RLS, does not use service role, and does not change the database schema. It only stops selecting a nonexistent optional field that was not used by the Parent family mapping. |
| Production risk | Low. The change narrows a read query to existing fields. |
| Manual follow-up | Continue full Parent flow QA in AUTHED UX/UI QA 3 or equivalent once all-role session switching is available. |

## Guardrails Preserved

- No auth bypass was introduced.
- No service-role client exposure was introduced.
- No risky feature was activated.
- No live payments, parent camera viewing, live AI, or production WhatsApp/SMS were enabled.

Product Reality Fix 1 changes remain in the working tree and were validated by typecheck/build.

# Staff attendance summary correctness — Development

Task: `GB-PRODUCT-STAFF-TIME-SUMMARY-CORRECTNESS-20261107`
Source: `origin/integration/development@3495944d77e04712e8dc225aefda1473a292ed66`
Branch: `codex/staff-time-summary-correctness-20261107`

## Defect and scoped change

The Staff attendance page rounded whole hours before appending remaining minutes. A server total of 90 minutes therefore appeared as two hours and 30 minutes; 59 minutes appeared as one hour and 59 minutes. It also treated failed Staff, shift, location-sample, anomaly and readiness reads like valid empty results. A failed shift read could leave the attendance action panel enabled without a verified open-shift state. Month grouping used the host machine's local calendar before converting to UTC.

The page now uses the authoritative completed-shift `total_minutes` field for both period metrics and row labels. It floors whole hours and uses the same remainder, never counts an open, invalid or negative-duration row as verified work, and marks a potentially truncated 45-row period as partial. The rolling metric is labeled "7 הימים האחרונים" and uses Israel calendar-day keys, including month and DST boundaries. A failed Staff read is unavailable, not pending assignment; a failed shift read disables the attendance action panel; other secondary failures display unavailable state instead of a healthy or verified empty state. The existing role guard remains before any data read. Queries, filters, result limits and server actions are unchanged. No GPS policy, permission, payroll, schema, provider or Digital Observer core code changed.

## Validation and limits

Focused fixture tests cover 0, 59, 60, 90 and 125 minutes, open/invalid totals, same-source row and period totals, Jerusalem month/rolling-window and DST boundaries, capped partial periods, and valid empty/populated versus failed reads. Focused lint and UX-07 regression passed. A feature-worktree TypeScript attempt using another worktree's compiler could not resolve optional Capacitor modules from this worktree; it reported no changed-path type errors, but is **not** a full typecheck pass. Exact-head CI, actual feature and merged Development browser capture, functional/security regression and release gates remain to be recorded after they run.

Existing completed synthetic Staff B shift and prior protected evidence are preserved; no new shift or GPS sample was created for this source fix. A later GET-only browser check must use a settled post-splash screen and the known completed record, with no geolocation permission or business mutation. Passing these fixtures is not proof of physical GPS, full Product/security or external owner visual acceptance. No paid dependency or fixed monthly commitment was added; main, Production and RELEASE-GAP-01 remain untouched.

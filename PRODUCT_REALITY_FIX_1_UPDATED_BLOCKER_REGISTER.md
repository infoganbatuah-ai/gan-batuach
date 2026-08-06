# PRODUCT REALITY FIX 1 - Updated Blocker Register

| ID | Severity | Category | Status | Impact | Required action |
|---|---|---|---|---|---|
| PRF1-CLOSED-01 | Critical | responsive_runtime | CLOSED_STATIC | Missing app shell stylesheet could break first-load layout. | Fixed in `app/layout.tsx`. |
| PRF1-CLOSED-02 | High | responsive_runtime | CLOSED_STATIC | Persisted mobile preview could make desktop render as mobile until manual correction. | Fixed in `components/app-motion-shell.tsx`. |
| PRF1-CLOSED-03 | High | wrong_date | CLOSED_STATIC | Stale 2025 date shown in manager/attendance/shared teacher screens. | Fixed with Israel date helper. |
| PRF1-CLOSED-04 | High | dummy_ui | CLOSED_STATIC | Manager dashboard used fake children/staff counts and fake update time. | Bound to real counts or honest empty states. |
| PRF1-OPEN-01 | High | authenticated_qa_required | OPEN | Manager/staff/inspector/admin/DO dashboards not accepted with real sessions. | Run AUTHED UX/UI QA 2. |
| PRF1-OPEN-02 | High | manual_visual_review_required | OPEN | No screenshots captured in this phase. | Capture mobile/tablet/desktop screenshots. |
| PRF1-OPEN-03 | Medium | dead_button | OPEN | Internal section anchors may feel like dummy actions in some role pages. | Verify and fix in authenticated QA. |
| PRF1-OPEN-04 | Medium | dummy_ui | OPEN | Some manager landing sections still use synthetic/example update/task copy. | Convert per-role during authenticated QA/follow-up rescue if visible. |
| PRF1-OPEN-05 | Medium | app_webview | OPEN | Native/WebView not synced after layout changes. | Run `npx cap sync` before native/mobile QA. |

## Counts

- Critical blockers remaining: 0 confirmed in code after this phase.
- High blockers remaining: 2 confirmed process blockers.
- Medium blockers remaining: 3.

# UX/UI RESCUE 3 - Dead Button And Broken Action Inventory

Date: 2026-08-06

Method: static scan of major TSX files plus shell/layout inspection. Full click-through was not completed in this phase, so this is a recovery inventory, not final QA.

## Classification Rules

| Status | Meaning |
|---|---|
| works | Route/action exists and is expected to work |
| route_missing | Link/action points to unavailable route |
| no-op | Button has no useful action and no explanation |
| disabled_without_explanation | Disabled control does not tell user why |
| clipped/not_clickable | Layout can hide or block the action |
| unsafe_action_correctly_blocked | Action is intentionally locked by pilot policy |
| readiness_state | Feature is not live and should explain readiness |

## High-Risk Findings

| Area | Label/action | Expected behavior | Actual/static finding | Severity | Fix plan/status |
|---|---|---|---|---|---|
| Parent/Manager app dashboards | bottom navigation / floating actions | one app navigation only | duplicate shell nav risk found | high | fixed in `components/dashboard-shell.tsx` |
| Public app gateway | app store buttons | clear unavailable state | disabled with title explaining store approval | low | acceptable; global disabled styling improved |
| Camera cards | open playback | only tokenized/allowed viewing | button disabled when playback not allowed | medium | acceptable; manual click QA required |
| Digital Observer onboarding | disabled setup fields | readiness/demo state | disabled fields describe no real activation | low | acceptable; global disabled styling improved |
| Admin dense tables/cards | view/edit actions | reachable and not clipped | static clipping risk in action rows | high | global button/list wrapping applied; manual visual QA required |
| Forms/modals | submit/close actions | reachable on mobile | static viewport-height risk | high | global dialog max-height/scroll applied; manual QA required |

## Applied Recovery

- Minimum touch size added for common button/action classes.
- Buttons/actions now allow wrapping instead of clipping text.
- Action rows and badge rows wrap instead of overflowing.
- Disabled states are visibly disabled and do not look like broken active buttons.
- App-home duplicate shell navigation was removed.

## Remaining QA

Every main button still needs browser/manual click testing in UX/UI QA 3. No button should silently do nothing; if a feature is blocked, it must show a readiness or unavailable explanation.


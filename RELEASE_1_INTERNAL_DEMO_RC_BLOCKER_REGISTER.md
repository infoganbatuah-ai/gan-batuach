# RELEASE 1 - Internal Demo RC Blocker Register

Date: 2026-06-27

| Blocker | Severity | Classification | Status |
| --- | --- | --- | --- |
| Real pilot not approved | blocking for pilot | demo_only_limitation | open |
| Real child/parent data not allowed | blocking for pilot | privacy_review_required | controlled |
| Demo accounts not confirmed | high | account_required | open |
| Demo environment URL/access not confirmed | high | environment_required | open |
| Environment separation not proven | high | environment_required | open |
| Legal/privacy pages pending final review | high | legal_review_required | open |
| Android/iOS real-device builds not completed | high | real_device_required | open |
| Payment providers not live | medium | provider_required | controlled |
| Camera not validated for parent viewing | high | demo_only_limitation | controlled |
| AI not validated as live inference | high | demo_only_limitation | controlled |
| External notifications not validated for production | medium | provider_required | controlled |
| Store submission blocked | medium | demo_only_limitation | controlled |

## RC Blocking Criteria

The RC should be marked not ready if:

- build fails
- login is broken
- role dashboards are inaccessible
- demo role sees wrong data
- real data appears in demo
- secrets are exposed
- camera/AI appears falsely live
- payment appears falsely live
- critical responsive cut-off appears in the scripted demo path

Current recommendation:

- RC_READY_FOR_INTERNAL_TEAM after demo accounts/environment are prepared.
- RC_READY_FOR_INVESTOR_DEMO only as presenter-led screen-share with synthetic data.

# RELEASE QA 1 - Internal Demo RC Validation Blocker Register

Date: 2026-06-27

## Blocking For Real Pilot

| Finding | Classification | Status |
| --- | --- | --- |
| QA 5 decision remains `INTERNAL_DEMO_ONLY` | demo_only_limitation | open |
| Real child/parent/staff data must not be used | privacy_review_required | controlled |
| Legal/privacy review remains incomplete | legal_review_required | open |
| Live Supabase/RLS negative tests in target environment are not documented as passed | security_followup_required | open |
| Real camera gateway/parent viewing is not validated for pilot use | provider_required | open |
| Real AI inference is not validated for pilot use | provider_required | open |

## Blocking For Unassisted Stakeholder Distribution

| Finding | Classification | Status |
| --- | --- | --- |
| Demo accounts are placeholders only | account_required | open |
| Demo environment URL and access controls are not confirmed | environment_required | open |
| Environment separation is not proven in this QA environment | environment_required | open |
| Browser/visual QA could not run locally because local server listen is blocked | responsive_followup_required | open |

## Controlled / Acceptable For Presenter-Led Internal Demo

| Finding | Classification | Status |
| --- | --- | --- |
| Build passes | low | closed |
| Main demo routes exist and build | low | closed |
| Store/pilot claims are documented as restricted | demo_only_limitation | controlled |
| Payment/camera/AI live claims are restricted in release scripts | demo_only_limitation | controlled |
| No signing packages or mobile credentials were found in checked paths | low | closed |

## Notes

- The RC can be used for internal team review after demo accounts and demo environment are prepared.
- Investor/stakeholder use should be presenter-led until visual QA, account setup and environment separation are completed.
- This register does not approve real pilot or public store release.

# PILOT QA 1 - Real Pilot Decision Options

Date: 2026-07-06

| Decision | Allowed users | Allowed data | Allowed modules | Prohibited modules | Required signoffs | Risk level | Recommended |
|---|---|---|---|---|---|---:|---|
| NO_GO | none beyond current internal use | none | none | all pilot activity | build/security/legal closure | high | no, because build passes and prep can continue |
| REMAIN_INTERNAL_DEMO_ONLY | internal team/demo viewers | synthetic only | demo dashboards, in-app flows | real users, real child data, live providers | none beyond demo guardrails | low | acceptable fallback |
| PILOT_PREP_ONLY | internal team, Daniel, test operators | synthetic/test only | environment setup, synthetic E2E, RLS tests, legal review | real child/parent data, live payments, parent camera, live AI | RLS/legal/environment/support still required | medium | **yes - final recommendation** |
| LIMITED_REAL_MANAGER_ONLY | one real manager/admin | no real child/parent data | manager onboarding, environment smoke, support flow | parent/child data, live camera, live AI, live payments | environment, legal acceptance for manager data, RLS basics | medium/high | not yet; needs signoff |
| LIMITED_REAL_STAFF_ONLY | limited staff/test staff | no child-sensitive data | staff account/onboarding smoke | child records, parent data, camera/AI | staff notice/legal and RLS signoff | medium/high | not yet |
| LIMITED_PARENT_TEST_WITH_SYNTHETIC_CHILD_DATA | selected test parents | synthetic children only | parent onboarding and enrollment demo | real child docs, camera, AI, live payments | synthetic environment and RLS proof | medium | possible after RLS synthetic tests |
| LIMITED_PARENT_TEST_WITH_REAL_CHILD_DATA_AFTER_SIGNOFF | limited real parents | limited real child data | child/enrollment/schedule/messages as approved | camera parent view, raw AI, live providers unless signed off | RLS, legal/privacy/consent, support, environment | high | not now |
| PILOT_WITHOUT_CAMERA_AI | selected real manager/staff/possibly parents | limited real data after signoff | core role workflows only | camera viewing, AI, live providers | RLS/legal/environment/support | medium/high | possible after critical blockers close |
| PILOT_WITH_CAMERA_READINESS_ONLY | selected pilot roles | limited real data after signoff | camera status/readiness only | parent live viewing, raw RTSP, credentials | camera notice, RLS, legal, token/audit policy | high | not now |
| PILOT_WITH_AI_SHADOW_SYNTHETIC_ONLY | internal reviewers | synthetic AI events only | shadow review training | AI on real child data, parent AI summaries | none beyond synthetic controls | medium | possible within prep |
| CONTROLLED_REAL_PILOT_READY | real pilot roles | approved real data | approved pilot scope | none beyond intentionally disabled features | all critical/high gates closed | high if premature | no |

## Final Option

Selected decision: **PILOT_PREP_ONLY**.

Reason: build/runtime are stable, but real Supabase/RLS verification and legal/privacy/consent review are still not complete. Real child/parent onboarding is not allowed yet.

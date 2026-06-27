# PILOT FIX 1 - Real Data Admission Policy

Date: 2026-06-27

## Default Rule

No real personal/sensitive data may enter the pilot environment until the relevant readiness gate passes.

## Prohibited Before Real Pilot Approval

- real child data before RLS verification
- real parent data before privacy/terms/consent review
- real staff documents before document access rules are verified
- real camera streams before camera notice/policy/gateway security are verified
- real AI processing before legal mode/human review is approved
- real payments before provider/payment terms and webhook security are verified
- bulk onboarding before pilot Go decision

## Allowed Before Real Pilot

- synthetic data
- demo users
- test kindergarten
- test-only provider events
- non-sensitive screenshots
- internal admin notes
- sandbox provider callbacks with no real customer data

## Admission Criteria For Real Data

Real data can be admitted only when:

1. target environment is identified and isolated
2. RLS/security tests pass
3. legal/privacy/consent documents are approved
4. support/incident path exists
5. rollback/kill switches exist
6. data owner approves the limited pilot scope

real_data_status = blocked_until_gates_pass

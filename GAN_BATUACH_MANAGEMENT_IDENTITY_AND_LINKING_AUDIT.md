# Gan Batuach Management — Identity and Linking Audit

## Garden owner/teacher lifecycle

| Step | Actual records/routes | Status | Finding |
|---|---|---|---|
| Registration/identity | `POST /api/self-service/register`; Auth user, profile, self-service profile | COMPLETE_NEEDS_QA | account created unconfirmed and inactive |
| Phone/email verification | Auth email callback; phone status JSON only | PARTIAL | email E2E/provider unverified; phone OTP missing |
| Garden creation | manager application creates/updates garden and profile link | PARTIAL | singular `profile.garden_id` |
| owner/teacher semantics | owner and manager share dashboard; teachers/staff separate | MISSING | owner is not automatically teacher; no explicit decision record |
| teacher where owner differs | staff/teacher records can hold role/class | PARTIAL | overlapping `teachers` and `staff` models |
| documents/terms | document routes + policy acceptances | PARTIAL | not one atomic activation prerequisite |
| groups/capacity/pricing | onboarding writes age setup + fee groups | PARTIAL | cannot represent duplicate age classes |
| staff/children/invitations | APIs exist and are optional during activation | PARTIAL | garden can become active before completion |
| subscription | creates trial/payment-pending state | MOCK | collection adapter is manual/sandbox |
| active garden | onboarding may set active after form submission | PARTIAL | production payment/provider and admin approval gates are not consistently atomic |

## Parent lifecycle and record graph

`auth.users → profiles(role=parent) → self_service_user_profiles`
`profiles → parents (legacy garden-specific identity)`
`profiles → permanent_child_files → kindergarten_enrollment_requests → children/child_kindergarten_enrollments`
`profiles/parents → parent_kindergarten_links → gardens`

| Capability | Status | Actual behavior/gap |
|---|---|---|
| Parent registration/profile | COMPLETE_NEEDS_QA | self-service route and profile/settings/onboarding exist |
| Household/second guardian | PARTIAL | adult/pickup data exists; no complete co-guardian account invitation/recovery |
| Authorized pickup | COMPLETE_NEEDS_QA | contacts, authorization lifecycle, revocation and human pickup event records |
| Create/multiple children | COMPLETE_NEEDS_QA | permanent files support multiple children |
| Discover/match gardens | PARTIAL | public data and filters exist; no validated matching engine |
| Enrollment request | COMPLETE_NEEDS_QA | request and garden decision APIs exist |
| Payment→activation | PARTIAL | statuses exist; no proven provider-backed atomic transition |
| Parent Garden experience | COMPLETE_NEEDS_QA | broad role dashboard exists |

Garden invitation branching is **PARTIAL**. Existing profiles can receive in-app invitation/affiliation records. Non-users are provisioned through server-side Auth and delivery logs, but delivery may be mock and the flow is based on temporary credentials rather than a complete signed, recoverable invitation token. Relationship/enrollment/payment activation is distributed across several API calls.

## Staff lifecycle and record graph

`auth.users → profiles(role=staff, active=false) → staff_candidate_profiles → staff_job_applications → staff`
`staff_permanent_files → staff_kindergarten_employments → gardens`

Registration, profile, openings, application, manager approval/rejection reason and activation exist: **PARTIAL/COMPLETE_NEEDS_QA**. Qualifications, location relevance and multi-garden context are incomplete. Direct garden provisioning creates records and credentials, but does not provide a robust existing-user/non-user invitation acceptance and recovery workflow. Candidate state reuses the full `staff` role, so activation checks are security-critical.

## Inspector lifecycle

`profiles(role=inspector, active=false) → inspector_applications → inspectors`; admin approval may assign many `gardens.inspector_id` rows. This is **COMPLETE_NEEDS_QA** for application and assignment. The requested inspector-created preliminary garden→owner invitation→activation→assignment flow is **MISSING**.

## Security findings

1. **P1:** dual legacy/new parent-child authority can create inconsistent access decisions unless every endpoint resolves a canonical relationship.
2. **P1:** inactive candidates already carry staff/inspector roles; role-only endpoints can over-authorize if they do not also check activation/assignment.
3. **P1:** service-role lifecycle routes require explicit garden/child/application ownership because RLS is bypassed.
4. **P1:** phone ownership is not verified by a real OTP lifecycle.
5. No specific exploitable P0 was proven statically; production IDOR/RLS probes remain mandatory.

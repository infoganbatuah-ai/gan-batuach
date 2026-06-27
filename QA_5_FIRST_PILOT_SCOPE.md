# QA 5 First Pilot Scope

Date: 2026-06-27

Scope type: controlled first kindergarten pilot definition.

Data rule: use demo/test identities only until Supabase RLS negative tests, legal notices and provider/camera/AI boundaries are manually verified in the target environment.

## Minimal Pilot Scenario

| Pilot element | Minimum entity | Status | Notes |
|---|---|---|---|
| Admin | 1 platform admin | ready for internal demo | Admin dashboard and provider readiness surfaces exist. |
| Kindergarten manager | 1 manager/owner | partially ready | Registration, approval and dashboard flows exist; real Supabase role tests still required. |
| Kindergarten | 1 kindergarten | partially ready | Card, city, age groups, prices and subscription states exist. |
| Parent | 1 parent | partially ready | Parent registration, child profile and enrollment flows exist; must use demo data until RLS is proven. |
| Child | 1 child test profile | partially ready | Do not use real sensitive child data before RLS/manual privacy verification. |
| Staff | 1 staff member | partially ready | Staff registration/application/assignment flows exist; assignment isolation needs live negative testing. |
| Inspector | 1 inspector | partially ready | Inspector approval/assignment/inspection flows exist; assigned-only access needs live negative testing. |
| Subscription/payment state | 1 approved-pending-subscription or demo subscription | pilot_without_live_payment | Sandbox/readiness only; no live charge. |
| Enrollment request | 1 parent-to-kindergarten request | partially ready | Functional flow exists; live role boundary verification required. |
| Child card | 1 manager/parent visible child card | partially ready | Must verify parent sees only own child. |
| Staff assignment | 1 assigned staff record | partially ready | Must verify unassigned staff cannot see internal child/parent data. |
| Inspection record | 1 assigned inspection | partially ready | Inspector must see assigned garden only. |
| Notification/message flow | 1 in-app notification, optional test email/SMS/WhatsApp/push | in_app_ready_external_provider_required | External channels remain sandbox/provider setup only. |
| Provider readiness checks | payment, invoice, email, SMS, WhatsApp, push | readiness_only | PROD 2 created readiness; real credentials missing/not tested. |
| Camera readiness checks | one camera readiness record | gateway_readiness / no live stream proven | No live parent camera pilot without real gateway/token/audit verification. |
| AI readiness checks | one reviewed/mock/shadow event | event_model_ready / no real inference proven | No raw AI to parents; shadow-only if later connected. |

## Pilot Flow Readiness

| Step | Flow | QA 5 classification | Blocker / next action |
|---:|---|---|---|
| 1 | Manager registers | partially ready | Must test with real auth/Supabase target. |
| 2 | Admin approves kindergarten/manager | partially ready | Approval flow exists; audit/manual live verification needed. |
| 3 | Manager completes kindergarten card | ready for internal demo | Use demo kindergarten data. |
| 4 | Manager defines city, age groups/classes and parent prices | ready for internal demo | Verify no parent tuition/platform revenue mixing. |
| 5 | Manager reaches subscription/demo/payment state | pilot_without_live_payment | Sandbox/readiness only. |
| 6 | Parent registers | partially ready | Invite/self-service compatibility requires target-environment test. |
| 7 | Parent creates child profile | partially ready | Use synthetic child; RLS required before real child data. |
| 8 | Parent discovers kindergarten | ready for internal demo | Public-safe data only. |
| 9 | Parent submits enrollment request | partially ready | Live role-boundary test required. |
| 10 | Manager approves child | partially ready | Verify status and parent scope in Supabase. |
| 11 | Child becomes active or pending payment according to rules | partially ready | Payment/provider state remains manual/sandbox. |
| 12 | Staff registers/applies or is invited | partially ready | Staff candidate privacy live test required. |
| 13 | Manager approves staff | partially ready | Assignment scope live test required. |
| 14 | Admin approves/assigns inspector | partially ready | Inspector assigned-only test required. |
| 15 | Inspector sees assigned kindergarten only | requires manual Supabase test | Critical gate before real pilot. |
| 16 | Inspector can create/start inspection | partially ready | GPS/evidence/provider storage live test required. |
| 17 | Notifications/readiness exists | in_app_ready_external_provider_required | Do not send production external messages. |
| 18 | Admin can see pilot state | ready for internal demo | Use provider/admin readiness dashboards. |

## Pilot Data Boundaries

- Use synthetic parent, child, staff, inspector and manager records.
- Do not upload real medical documents, staff certificates or inspection evidence during internal demo.
- Do not expose camera streams to parents.
- Do not send external notifications to real families/staff.
- Do not charge a card or issue production invoices.

## Recommended Initial Scope

Recommended first execution mode: `INTERNAL_DEMO_ONLY`.

The same flow can become a limited real pilot only after:

- live Supabase RLS/JWT negative tests pass,
- provider modes are confirmed sandbox/test,
- support and incident path is staffed,
- privacy/camera/AI notices are legally reviewed,
- camera/AI remain disabled or explicitly sandbox/shadow-only.

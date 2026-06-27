# PILOT FIX 1 - Consolidated Real Pilot Blockers Register

Date: 2026-06-27

## Summary

Current decision remains: `INTERNAL_DEMO_ONLY`.

Real kindergarten pilot is blocked until critical/high items below are closed and verified in the target environment.

| Category | Source report | Severity | Affected roles | Route/module | Current status | Required fix | Owner type | Prerequisite | Complexity | Blocks real pilot | Blocks public launch | Recommended next phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Build/runtime stability | RELEASE QA 1 | low | all | app build | build currently passes | keep typecheck/build green before each gate | engineering | none | low | no | yes if regresses | all phases |
| Supabase/RLS real environment verification | QA 5, SECQA 2 | critical | parent, manager, staff, inspector, admin | Supabase/RLS | not manually verified in target project | run JWT/RLS negative tests for every role | engineering/security | target Supabase project | high | yes | yes | PILOT FIX 2 |
| Authentication/session flows | TECHQA 1, RELEASE QA 1 | high | all | `/login`, `/app`, dashboards | build-stable, not demo-account validated | create test accounts and validate login/logout/session redirects | engineering/QA | demo/pilot environment | medium | yes | yes | PILOT FIX 4/5 |
| Role-based access | QA 5 | critical | all roles | dashboards/APIs | requires live negative tests | validate wrong-role denial and assignment scope | engineering/security | RLS tests | high | yes | yes | PILOT FIX 2/5 |
| Parent/child data privacy | QA 5, SECQA 2 | critical | parents, children | parent dashboard, child APIs/storage | blocked for real users | prove parent A cannot access child B or garden-wide child lists | engineering/security | target Supabase | high | yes | yes | PILOT FIX 2 |
| Staff assignment boundaries | QA 5 | high | staff, children, parents | staff dashboard/APIs | not live-verified | unassigned staff sees own profile/apps only; assigned staff scoped to own garden | engineering/security | role fixtures | medium | yes | yes | PILOT FIX 2/5 |
| Inspector assignment boundaries | QA 5 | high | inspectors, gardens | inspector dashboard/APIs | not live-verified | pending inspector sees no gardens; approved sees assigned gardens only | engineering/security | inspector fixtures | medium | yes | yes | PILOT FIX 2/5 |
| Manager kindergarten boundaries | QA 5 | high | managers, children/staff/payments | garden dashboard/APIs | not live-verified | manager sees own kindergarten only | engineering/security | manager fixtures | medium | yes | yes | PILOT FIX 2/5 |
| Sensitive document access | SECQA 2, QA 5 | critical | parents, staff, manager, inspector | storage/upload/download | requires live signed URL tests | verify private buckets, short signed URLs, authorization before URL creation | engineering/security | target storage | high | yes | yes | PILOT FIX 2 |
| Payment/provider readiness | QA 4B, PROD 2, QA 5 | high | manager, admin | payments/subscriptions/webhooks | readiness/sandbox only | configure sandbox provider, signed webhooks, idempotency/replay tests | engineering/provider | provider sandbox account | high | yes if paid pilot | yes | PILOT FIX 8 |
| Invoice readiness | QA 4B, PROD 2 | high | manager, admin | invoice webhooks | readiness only | provider setup, invoice policy, receipt tests | engineering/provider/legal | provider selected | medium | yes if billing pilot | yes | PILOT FIX 8 |
| Notification readiness | PROD 2, QA 5 | medium | all | notifications/providers | in-app only, external provider-dependent | configure test recipients/templates/callbacks/logging | engineering/provider | provider setup | medium | no for minimal pilot | yes | PILOT FIX 8 |
| Camera gateway readiness | PROD 3, QA 5 | critical | manager, admin, parent, inspector | cameras/gateway | gateway readiness, no real camera proven | connect test camera through gateway, verify tokens/audit/no RTSP | engineering/security/legal | camera policy | high | yes if camera included | yes | PILOT FIX 6 |
| Parent camera viewing restrictions | PROD 3, QA 5 | critical | parents/children | parent cameras | must remain disabled | keep disabled until all policy/token/audit/consent gates pass | engineering/legal/security | camera gate | high | yes if enabled | yes | PILOT FIX 6 |
| AI observer/shadow readiness | PROD 4, QA 5 | high | admin, manager, inspector | AI observer | event model/readiness only | validate shadow mode/human review with safe test source | engineering/AI/legal | camera/frame source | high | no if excluded | yes if claimed | PILOT FIX 7 |
| Raw AI parent exposure prevention | PROD 4, QA 5 | critical | parents | AI/safety reports | must remain blocked | prove parents cannot see raw AI events | engineering/security/legal | AI fixtures | high | yes if AI included | yes | PILOT FIX 7 |
| Legal/privacy/consent | STORE QA 1, QA 5 | critical | all real users | legal/public/app notices | not finalized | privacy, terms, child data, camera, AI, retention, deletion, consent review | legal/product | legal counsel | high | yes | yes | PILOT FIX 3 |
| Child data/family policy | STORE QA 1 | critical | parents/children | legal/store/app | legal review required | classify adult-facing child-data app, finalize consent/deletion/retention | legal/privacy | policy draft | high | yes | yes | PILOT FIX 3 |
| Terms/privacy/support/account deletion | STORE QA 1, RELEASE QA 1 | high | all | public/legal/support | pending | publish reviewed URLs and support/deletion path | legal/product/support | content owner | medium | yes | yes | PILOT FIX 3/10 |
| Demo vs real environment separation | RELEASE QA 1 | high | all | Vercel/Supabase/providers | not proven | create/verify separate demo, staging/pilot, production environments | engineering/ops | env access | high | yes | yes | PILOT FIX 4 |
| Synthetic vs real data separation | RELEASE 1 | high | all | DB/storage | plan only | mark demo data, separate environments, no demo data in pilot | engineering/ops | env separation | medium | yes | yes | PILOT FIX 4 |
| Mobile/responsive readiness | RESPONSIVE QA 1, MOBILE 2 | medium | all | mobile/tablet/webview | build-stable, manual device QA pending | real device/browser QA for pilot flows | QA/mobile | devices | medium | yes if mobile used | yes | PILOT FIX 5 |
| Store/test distribution readiness | STORE QA 1 | medium | reviewers/stakeholders | App Store/Google Play | not store-ready | keep internal/demo only until store blockers closed | product/mobile/legal | developer accounts | high | no | yes | MOBILE/STORE later |
| Support/incident handling | QA 5 | high | all real users | support/admin/incident | not staffed | assign owner, SLA, incident workflow, rollback path | support/ops/security | owner named | medium | yes | yes | PILOT FIX 10 |
| Audit logging | SECQA 2, PROD 3/4 | high | admin/security | audit logs | readiness varies by feature | verify logs for admin actions, docs, payments, camera, AI, inspections | engineering/security | target env | medium | yes | yes | PILOT FIX 2/6/7/8 |
| Monitoring/provider health | PROD 2, QA 5 | medium | admin/ops | provider health | readiness dashboards exist | wire actual pilot monitors/status checks | ops/engineering | provider setup | medium | no for manual pilot | yes | PILOT FIX 8/10 |
| Rollback plan | QA 5, RELEASE QA 1 | high | all | ops/features | not fully defined | feature kill switches and access rollback documented/tested | ops/engineering | env separation | medium | yes | yes | PILOT FIX 10/11 |

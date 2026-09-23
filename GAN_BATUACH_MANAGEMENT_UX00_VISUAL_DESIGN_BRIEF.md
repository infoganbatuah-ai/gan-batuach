# Gan Batuach Management — UX-00 visual design brief

Date: 2026-09-23
Canonical baseline: `integration/development` at `4a677205bd60551dc8b690adedcca7c509e787da`
Scope: visual-reference specification only. No product, CSS, component, schema, Digital Observer core or Production change is implied by this document.

## Design contract

Design only the canonical Management surfaces in the GB-M38 route and UX maps. A reference must depict a real, currently authorized user goal and use canonical data. It must never make a readiness signal look live, an upload look verified, a scheduled Staff member look present, a manual payment look provider-confirmed, or a camera/face result look like Child identity or pickup authority.

Each reference supplied for implementation must name: role, route, viewport, state, Hebrew copy, source domains, interaction notes and acceptance criteria. The eventual implementation reuses the existing shell and component system: `DashboardShell`, `ResponsivePage`, `MobileAppShell`, `DesktopDashboardShell`, `AppHeader`, `SidebarNav`, `BottomNav`, `PremiumCard`, `MetricCard`, `StatusChip`, `ActionCard`, `DashboardGrid`, `ListRowCard`, `EmptyState`, `DashboardLoadingState` and `DashboardErrorState`.

### State contract

Every P0/P1 reference has populated, empty, loading, error, unavailable and permission-denied variants as applicable. Transactional views also define pending, validation error, success and destructive confirmation. A failed source renders an error/retry state, never a zero or an endless skeleton.

### RTL, accessibility and responsive contract

- Hebrew is the primary direction. Use logical alignment and spacing, right-to-left back navigation, bidi-safe dates and numbers, and currency as `₪ 1,250` with the number kept readable.
- Every interactive element has a visible Hebrew label and accessible name; focus is visible, touch targets are at least 44px, validation explains the affected field, and dialogs move and return keyboard focus.
- Desktop uses sidebar, page header, summary cards, filters, tables and detail panels. Mobile uses bottom navigation only for daily destinations, a fixed context switcher where needed, cards in place of broad tables, and full-screen flows for complex forms.
- Numeric values align consistently, while Hebrew labels stay right aligned. Icons that express direction mirror; semantic icons do not mirror merely for decoration.

## UX-01 — global system and shared patterns

| UX ID | Priority | Pattern and exact requirements | Existing targets | Inherited states |
|---|---|---|---|---|
| UX00-01 | P0 | App shell: logo, active role, Garden/Child context, notification badge, account menu and a clear Development/Production-safe environment label where supplied by the app | `DashboardShell`, role frames, `AppHeader` | loading shell, denied role, sign-out/session expiry |
| UX00-02 | P0 | Desktop sidebar: five frequent role destinations, active indicator, grouped More area, no legacy route links | `SidebarNav`, role frames | collapsed sidebar, long Hebrew label |
| UX00-03 | P0 | Mobile bottom nav: Home plus four high-frequency actions; context switcher sits above content, not inside authorization claims | `BottomNav`, `MobileAppShell` | badge overflow, keyboard open |
| UX00-04 | P0 | Page header: title, truthful subtitle, back behavior, optional primary action, filters and freshness/error line | `TeacherPageTitle`, `SectionHeader` | unavailable source, filtered-empty |
| UX00-05 | P0 | Metric/action/list language: status chips, safe previews, counts, empty next action and bounded tables | `MetricCard`, `ActionCard`, `ListRowCard`, `DashboardGrid` | loading, error, empty |
| UX00-06 | P1 | Form, drawer and dialog system: labels, helper text, upload progress, validation, save/pending and destructive confirmation | existing form controls, `UploadImageField` | invalid, saved, failed, confirm |
| UX00-07 | P1 | System states: no data, provider unavailable, permission denied, degraded/offline and retry | `EmptyState`, `DashboardErrorState`, `DashboardLoadingState` | each is a reusable reference rather than a page redesign |

## UX-02 — Owner registration and Garden onboarding

### Canonical sequence

1. Account creation and Email verification. Email verification is sufficient for normal account activation; entered phone remains unverified unless a phone-specific flow requires proof.
2. Initial registration: full name, ID number optional, mobile, Email, role choice (`גננת שמפעילה את הגן`, `בעלים וגם גננת`, `בעלים, עם גננת נפרדת`), Garden name, city, street, address details, legal entity, business ID, Garden phone/Email, opening hours, public description and terms acknowledgement.
3. Five-step resumable Garden wizard:
   - **פרטי הגן**: Garden/owner/manager/business contacts, hours, description, logo, Garden image, gallery links, document declarations and document-status summary.
   - **קבוצות גיל וצוות**: age groups, planned Children, Classroom count, operational capacity per Classroom, monthly price, billing day/cycle, public-price toggle, Staff initialization and camera readiness.
   - **מנוי ותשלומים**: trial duration, current charge `0 ₪`, estimated settlement date, payment preference and truthful provider-unavailable state.
   - **ילדי הגן והזמנת הורים**: invite Parent, initial Children, Parent-invite state; Staff/Children steps remain optional and skippable.
   - **סיכום והפעלה**: what becomes available, what remains intentionally unavailable, confirmation and activation.
4. Save/resume must be obvious at every step. Final activation must surface missing required product fields as action-required, not a generic error.

| UX ID | Priority | Screen / route | Exact visual sections and actions | Source data / status labels |
|---|---|---|---|---|
| UX00-10 | P0 | Account signup + `/auth/confirm` | account form, Email sent/verified/expired-invalid states, sign-in and recovery path | Supabase Auth; `כתובת האימייל אומתה`, `קישור אינו תקף` |
| UX00-11 | P0 | `/onboarding/kindergarten` | registration form, Owner/Teacher choice, privacy acknowledgement, start button | profile + Garden draft |
| UX00-12 | P0 | `/dashboard/garden/onboarding` | five-step rail, progress, draft save, back/next, skip option, missing-items panel, activation review | onboarding profile, Classroom/capacity, subscription readiness |
| UX00-13 | P1 | document/upload and invite moments within the wizard | private upload affordance, document truth state, Parent invitation panel | GB-M32, signed invitations |

Desktop: persistent step rail and side summary. Mobile: numbered step progress, one step per screen, sticky save/continue footer; document upload opens a full-screen sheet.

## UX-03 — Owner / Manager command center

Route: `/dashboard/garden/operations`.

The populated view contains a Garden switcher, greeting/header and these sections in this order: Today (enrolled/expected/present/absent/departed and Classroom status), Staff (present now, scheduled, missing clock-out and staffing-policy state), finance (tuition outstanding/overdue/reconciliation and separate subscription state), communication (unread messages/notifications and Parent requests), Operations (open Tasks, complaints, document action items), inspection (last/next inspection and corrective actions), Safety (only truthful capability/readiness or verified incident state) and quick actions.

Quick actions: add Child, invite Parent, invite Staff, create Classroom, attendance, message/broadcast, Task, finance, documents, inspections and camera setup only when the role is authorized. A quick action always opens the existing authorized flow.

| UX ID | Priority | State | Required visual distinction |
|---|---|---|---|
| UX00-20 | P0 | populated | all seven sections, cards and safe summaries; tuition never combines with subscription |
| UX00-21 | P0 | new/empty Garden | useful actions for Children, Staff, documents and Classroom; no pretend success metrics |
| UX00-22 | P1 | provider/safety unavailable | disabled action with reason; `מוכנות`, `נדרש חיבור` or `לא זמין` rather than live/monitored |
| UX00-23 | STATE | one card fails | card-local error/retry; remaining cards stay usable |

Owner-as-Teacher uses the same dashboard and one Garden context. Delegated Teacher inherits only Classroom, attendance, Parent communication, Tasks and permitted safety information; finance, subscription, wage and membership cards/actions are absent.

## UX-04 — Children, Classrooms, attendance and pickup

| UX ID | Priority | Screen / route | Exact content and actions | Important states |
|---|---|---|---|---|
| UX00-30 | P0 | `/dashboard/garden/children` | filterable Child list, Classroom, enrollment status, attendance summary, add Child action | no Children, pending enrollment, filtered-empty |
| UX00-31 | P0 | `/dashboard/garden/children/[id]` | identity-safe profile, Guardian/enrollment/Classroom sections, attendance timeline, documents, permitted operational notes | permission denied, ended enrollment |
| UX00-32 | P1 | add/edit Child drawer | name, birth date, optional ID, HMO, allergies, medical note, photo/system consent; sensitive fields visually scoped | field validation, save/pending, no broad Staff access |
| UX00-33 | P0 | Classroom/capacity assignment | Classroom list/detail, operational capacity, occupied/reserved/available and move assignment | no Classroom, over-capacity truth, policy not configured |
| UX00-34 | P0 | `/dashboard/garden/attendance` | date/Classroom filters, expected/present/absent/late/departed, arrival/absence action and correction trail | no active enrollment, duplicate action is idempotent |
| UX00-35 | P0 | `/dashboard/garden/pickup` | Children to release, active authorized pickup people, temporary validity, request state, Staff confirmation and release history | revoked/expired/unknown pickup blocked; no face-match authority |

Desktop attendance is a dense filtered table with row action drawer. Mobile is Classroom/date filter followed by Child cards with a single safe action; release confirmation is full-screen and requires a named authorized adult plus Staff confirmation.

## UX-05 — Parent platform

Parent routes are Child-scoped. The selected Child selector is prominent; switching must update Garden, attendance, tuition, messages, documents and pickup context together.

| UX ID | Priority | Screen / route | Required sections/actions |
|---|---|---|---|
| UX00-40 | P0 | `/dashboard/parent` | Child selector, current Garden, attendance today, recent safe updates, messages, tuition, documents/action items, pickup state, notifications and Garden/inspection-safe information |
| UX00-41 | P0 | no-active-Garden Parent state | Child card, discovery, pending request, invitation and next action; no broken dashboard |
| UX00-42 | P0 | `/dashboard/parent/discover-kindergartens` | Child context, filters, Garden cards, availability/operational capacity, price only where configured, request action |
| UX00-43 | P1 | Garden detail/request/status | Garden facts, public description, request, information-required/resubmit, waitlist, awaiting manual payment, active enrollment; no false provider-payment status |
| UX00-44 | P0 | `/dashboard/parent/schedule`, `/pickup` | today attendance, pickup request, authorized people, add/revoke/temporary validity and release status |
| UX00-45 | P0 | `/dashboard/parent/payments`, `/documents` | Child-only billing period, outstanding/partial/manual settlement/reconciliation and private document action items |
| UX00-46 | P1 | `/dashboard/parent/complaints`, `/inspections`, `/trust-center` | safe case history, Parent-safe inspection projection and truthful Safety policy state |
| UX00-47 | P1 | `/dashboard/parent/settings` | profile, Guardian/family details, notification preferences and account/security |

Mobile Parent navigation prioritizes Home, Schedule, Messages, Notifications and More. Tuition/documents appear within Home and More rather than forcing desktop tables into the bottom bar.

## UX-06 — Staff candidate and active Staff

Candidate and active Staff are visually separate modes.

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-50 | P1 | `/dashboard/staff/job-market`, `/access-pending` | candidate profile status, job cards/detail, application, signed invitation, submitted/accepted/rejected status and no operational Garden access |
| UX00-51 | P1 | candidate profile/qualification | city, professional role, qualifications, preferred ages, days/notes, employment preference, professional summary, matching pause and private documents |
| UX00-52 | P0 | `/dashboard/staff` | active Garden switcher, clock state, today shift, Classroom assignments, Tasks, permitted Children/attendance, messages and notifications |
| UX00-53 | P0 | `/dashboard/staff/attendance`, `/shifts` | server clock-in/out, shift vs actual time, missing clock-out, own hours/correction/approval state |
| UX00-54 | P0 | `/dashboard/staff/tasks`, `/messages`, `/notifications` | own Tasks, permitted Parent/Garden messages, read state and notification preferences |
| UX00-55 | P1 | `/child-journal`, `/documents`, `/reports`, `/settings` | authorized Child updates, own documents, own hour reports and settings |

For multi-Garden Staff, the Garden switcher must reset all list and metric content. Desktop can show a compact context strip; mobile pins it above the first action. Candidate navigation never substitutes for active-work navigation.

## UX-07 — Inspector

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-60 | P1 | `/dashboard/inspector/apply` | application, pending, approved and suspended status, required documents and safe next action |
| UX00-61 | P0 | `/dashboard/inspector` | assigned-Garden portfolio, due/completed/overdue inspections, open findings, corrective actions, relevant complaints and Tasks |
| UX00-62 | P0 | approved/unassigned state | `טרם הוקצו לך גנים`, account-approved status, blocked access metric and no Garden data |
| UX00-63 | P0 | inspections family | assigned Garden selector, question sections, boolean/text/score answers, private photo/document evidence, signature, save draft, resume and submit |
| UX00-64 | P0 | `/dashboard/inspector/violations` | finding status, acknowledgement, remediation, evidence, reject/resubmit/accept, dates and historical inspection score |
| UX00-65 | P1 | Tasks, complaints, reports/trends | own assigned scope, age/SLA status, safe Garden trend and report export |
| UX00-66 | P1 | preliminary Garden/bootstrap | preliminary state, signed Owner/Teacher invitation, activation and assignment; never public discovery |

Suspended Inspector is a permission-denied account state, not a hidden dashboard. Evidence is private and cannot be represented as a public image gallery.

## UX-08 — Finance

Tuition and platform subscription always use separate visual surfaces.

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-70 | P0 | `/dashboard/garden/tuition-ledger` | periods, billed/settled/partial/outstanding/overdue/unapplied credit, Child/period filters and reconciliation |
| UX00-71 | P1 | manual settlement/reconciliation drawer | amount, date, evidence/reference, partial balance and idempotent pending/success/error feedback; no card-payment claim |
| UX00-72 | P0 | `/dashboard/parent/payments` | own Child billing periods, manual settlement/provider-verified/pending/outstanding distinction |
| UX00-73 | P1 | `/dashboard/garden/subscription` | plan, status, trial/billing period, manual/provider state, grace/suspension and truthful provider unavailable state |
| UX00-74 | P2 | labor-cost report/export | explicitly `עלות עבודה תפעולית משוערת`; never salary, net pay or statutory payroll |

## UX-09 — Messaging and notifications

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-80 | P0 | role `/messages` | conversation list with unread counts, participant/context, safe preview, search/filter, thread, compose/reply and private attachment state |
| UX00-81 | P1 | Garden broadcast | authorized audience selector (Garden/Classroom), safe confirmation and no accidental cross-Garden audience |
| UX00-82 | P0 | role `/notifications` | unread/read center, source category, safe summary, deep-link and no full sensitive body in preview |
| UX00-83 | P1 | notification preferences/quiet hours | per-category switches, quiet-hours range, unavailable external channel state and in-app authority |

## UX-10 — Documents

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-90 | P1 | Garden document center | category filters, list, status/expiry metrics, private upload and action-required rows |
| UX00-91 | P1 | document detail/review | category, owner scope, uploaded/pending-review/verified/rejected/expired/replaced states, issuer/expiry, replacement history and permitted review action |
| UX00-92 | P1 | upload/replacement | accepted type/size, server-authorized destination, progress, private retrieval and no "approved" state on upload |
| UX00-93 | P2 | role-specific views | Parent own-Child documents, Staff own documents, Inspector inspection-authorized documents; denied roles show no object path or metadata |

## UX-11 — Operations

Use one lifecycle language across inspection reports, corrective actions, Tasks and complaints: status chip, owner/assignee, due/age, safe detail, timeline and auditable resolution. Do not merge their source domains.

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-100 | P1 | Garden inspection report/history | score, date, Inspector, findings, private evidence availability by role and report status |
| UX00-101 | P0 | corrective actions | open/submitted/rejected/reopened/closed, due date, acknowledgement, remediation evidence and Inspector decision |
| UX00-102 | P0 | role Tasks | open/completed/overdue, assignee, source domain, create/assign/complete and race-safe pending state |
| UX00-103 | P1 | complaint lifecycle | Parent submit, routing, information request/response, SLA, resolution and Parent-safe history; internal notes stay private |

## UX-12 — Reports

Reports are role-aware read models with shared filter bar: today/week/month/custom range, Garden/Classroom/Child/Staff filters only when authorized, data freshness, pagination, error/retry and CSV export feedback.

| UX ID | Priority | Report families and viewers |
|---|---|---|
| UX00-110 | P1 | Garden summary, Children, attendance, pickup, Staff, Staff hours, tuition, enrollment funnel and Classroom capacity for Owner/Manager |
| UX00-111 | P1 | inspection, corrective-action, complaint, Task, document-expiry and staffing-policy reports for authorized Owner/Inspector/Admin |
| UX00-112 | P1 | Inspector portfolio/trends and multi-Garden network summary, strictly within assignment/management scope |
| UX00-113 | P2 | Parent own-Child summary and Staff own-hours/Tasks summary; mobile uses summary cards and drill-down |
| UX00-114 | STATE | CSV export status: scope/date displayed, authorized generation, safe filename, formula-safe content and private temporary access if stored |

## UX-13 — Safety and cameras

Management-facing Safety is a consumer of the Digital Observer contract. It must use these distinct states: **לא זמין**, **נדרשת הקמה**, **מוכנות**, **מושבת/תקול**, **פעילות מאומתת**, **אין הקלטה לפי מדיניות**, and **תקרית מאומתת**. Mock/shadow events, Track IDs and face-match results are blocked from Safety truth.

| UX ID | Priority | Screen / route | Exact content/actions |
|---|---|---|---|
| UX00-120 | P1 | `/dashboard/garden/cameras` | camera metrics, card gallery, connection/readiness, permitted view, Parent viewing policy, issue filter, add/setup action and no RTSP/credential display |
| UX00-121 | P1 | camera setup/capability | area assignment, connection test, activation/readiness, role viewing policy and safe unavailable/degraded explanation |
| UX00-122 | P1 | Safety/trust center | capability status, verified incidents only, evidence availability and policy-no-recording state |
| UX00-123 | P2 | Parent/Staff/Inspector Safety policy | what that role may see, unavailable reason, no live/AI claim without verified contract |

Watch Rules and Investigation receive a design reference only if they are exposed through the canonical Management surface. Digital Observer standalone engineering controls are excluded.

## UX-14 — Admin

Design twelve destinations, not the historical 141 physical routes. Specialist pages nest under these destinations:

| UX ID | Destination | Main content and actions |
|---|---|---|
| UX00-130 | Overview | aggregate-safe metrics, system-data warning, priority queues and quick actions |
| UX00-131 | Gardens | Garden table/cards, status, activation/support detail and safe filters |
| UX00-132 | Applications & roles | Garden applications, users, role status and explicit review actions |
| UX00-133 | Inspectors | applications, approval, assignment, workload and suspended state |
| UX00-134 | Subscriptions | platform plan/status, manual/provider readiness and controlled override |
| UX00-135 | Complaints & escalations | category/status/SLA, escalation queue and safe case projection |
| UX00-136 | Inspections & coverage | national/operational inspection status, coverage and overdue state |
| UX00-137 | Providers & system | provider readiness, system health and unavailable/degraded state; no secrets |
| UX00-138 | Safety & incidents | verified incident summaries and readiness only, no default Child/message content |
| UX00-139 | Reports & analytics | aggregate-safe reports, filters and export feedback |
| UX00-140 | Audit & support | audit/support entry points and explicit privileged-access context |
| UX00-141 | Configuration & policies | settings, staffing policy, feature/readiness policy and legal-copy guardrails |

## UX-15 — Settings and reusable edge states

Settings references cover profile, Garden settings, permissions, subscription settings, notification settings, account/security and user-facing provider readiness. Every family inherits the reusable empty/loading/error/unavailable/permission-denied patterns. Offline/degraded is displayed only where an actual source exposes it; do not fabricate offline mode.

## Copy inventory and terminology decisions

Use: `גן`, `כיתה`, `ילד/ה`, `הורה/אפוטרופוס`, `מורשה איסוף`, `צוות`, `גננת`, `בעלים/מנהל`, `מפקח`, `נוכחות`, `בקשת רישום`, `הרשמה פעילה`, `הסדר תשלום ידני`, `משימה`, `תלונה`, `ביקורת`, `ליקוי`, `פעולה מתקנת`, `מסמך`, `מצלמה`, `אירוע`, `תקרית`, `ראיה`.

Flag for final copy work: mixed `גן`/`Kindergarten`; `Owner`/`Manager`/`גננת`; English labels such as `Document Center`; technical terms exposed in readiness screens; and wording that might imply legal capacity, ratio, document, retention, payroll or camera-rights requirements. These require product/legal review before being framed as law.

## Reference-count method

The companion index contains the exact reference requests. It deliberately groups repeated list/table/form patterns under shared references while retaining separate role, state and viewport references where context changes permissions or meaning.

- Canonical screen families: **52** — P0 **22**, P1 **24**, P2 **6**.
- Unique desktop references: **38**.
- Unique mobile references: **27**.
- State/edge-case references: **18**.
- Total design references: **83**.

No referenced target is a redirected, QA-only, internal-only or Digital Observer standalone surface.

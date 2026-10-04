# Gan Batuach Management Canonical UX Surface Map

Date: 2026-09-23
Purpose: design-freeze input. Only these surviving surfaces should receive final visual work.

## Shared state contract

Every high-value screen requires populated, empty, loading, error, unavailable and permission-denied behavior where applicable, plus mobile and desktop layouts. Transactional screens also require success, validation error, pending and destructive-confirmation states. A failed query must not render a false zero.

| Role | Canonical route / family | Purpose and primary actions | Source domains | Mobile / desktop | Design priority |
|---|---|---|---|---|---|
| Owner/Manager | `/dashboard/garden/operations` | Today overview; open Children, attendance, Staff, finance, messages, Tasks, documents and inspections | GB-M11–36 reports | High / High | P0 |
| Owner/Manager | `/dashboard/garden/children`, `/children/[id]` | List/detail, enrollment and Classroom operations | Guardian, enrollment, Classroom | High / High | P0 |
| Owner/Manager | `/dashboard/garden/enrollment-requests` | Review, info request, approve, payment activation | GB-M15/16 | Medium / High | P0 |
| Owner/Manager | `/dashboard/garden/attendance`, `/pickup` | Arrival/absence/release and pickup authorization | GB-M33 | High / High | P0 |
| Owner/Manager | `/dashboard/garden/staff*`, `/staff-time` | Employment, applications, shifts, hours, corrections/export | GB-M18/19/34 | High / High | P0 |
| Owner/Manager | `/dashboard/garden/messages`, `/communication`, `/notifications` | Threads/broadcasts and delivery readiness/preferences | GB-M29–31 | High / High | P0 |
| Owner/Manager | `/dashboard/garden/finance`, `/tuition-ledger`, `/subscription` | Tuition and SaaS subscription as separate truths | GB-M26–28 | Medium / High | P0 |
| Owner/Manager | `/dashboard/garden/documents` | Upload, review state, expiry and replacement | GB-M32 | Medium / High | P1 |
| Owner/Manager | `/dashboard/garden/inspections*`, `/corrective-actions` | Inspection history and remediation | GB-M22/23 | Medium / High | P1 |
| Owner/Manager | `/dashboard/garden/tasks`, `/reports`, `/settings` | Work, role-aware exports, configuration | GB-M24/36 | Medium / High | P1 |
| Parent | `/dashboard/parent`, `/family-home` | Child-centric current state and next actions | Guardian context + GB-M27/29/30/32/33 | High / High | P0 |
| Parent | `/dashboard/parent/children/[id]*` | Child detail and safe timeline | Guardian/Child | High / Medium | P0 |
| Parent | `/dashboard/parent/discover-kindergartens` | Discovery, availability and enrollment request | GB-M14–16 | High / Medium | P0 |
| Parent | `/dashboard/parent/messages`, `/notifications` | Communication and safe notification state | GB-M29/30 | High / High | P0 |
| Parent | `/dashboard/parent/payments`, `/documents` | Own Child tuition and documents | GB-M27/32 | High / High | P0 |
| Parent | `/dashboard/parent/schedule`, `/pickup` | Attendance/pickup view and request | GB-M33 | High / Medium | P0 |
| Parent | `/dashboard/parent/complaints`, `/inspections`, `/trust-center`, `/reports` | Case lifecycle and parent-safe Garden truth | GB-M22/25/36 | Medium / High | P1 |
| Staff | `/dashboard/staff`, `/operations` | Active Garden, clock, shift, Tasks and messages | Employment + GB-M24/29/34 | High / High | P0 |
| Staff | `/dashboard/staff/job-market`, `/access-pending` | Candidate experience before active employment | GB-M17/18 | High / Medium | P1 |
| Staff | `/dashboard/staff/attendance`, `/shifts` | Clock and shift operations | GB-M34 | High / High | P0 |
| Staff | `/dashboard/staff/child-journal`, `/daily-journal` | Child updates and distinct operational checklist | Child journal/tasks | High / Medium | P1 |
| Staff | `/dashboard/staff/tasks`, `/messages`, `/notifications` | Own operational work and communication | GB-M24/29/30 | High / High | P0 |
| Staff | `/dashboard/staff/documents`, `/reports`, `/settings` | Own documents/hours/configuration | GB-M32/34/36 | Medium / High | P1 |
| Inspector | `/dashboard/inspector`, `/command-center`, `/control-center` | Portfolio, today work and assigned-Garden operations | Assignments + GB-M22–25/36 | High / High | P0 |
| Inspector | `/dashboard/inspector/inspections*`, `/violations` | Draft/submit/history and corrective actions | GB-M22/23 | High / High | P0 |
| Inspector | `/dashboard/inspector/preliminary-gardens` | Controlled Garden bootstrap | GB-M21 | Medium / High | P1 |
| Inspector | `/dashboard/inspector/tasks`, `/reports`, `/ratings` | Own tasks, reports and assigned-Garden priorities | GB-M24/36 | Medium / High | P1 |
| Inspector | `/dashboard/inspector/notifications`, `/settings` | Alerts and preferences | GB-M30/31 | Medium / High | P2 |
| Admin | `/dashboard/admin` | Aggregate-safe platform operation | Canonical aggregate sources | Medium / High | P0 |
| Admin | `/dashboard/admin/kindergartens`, `/gardens/[id]` | Garden directory and support detail | Gardens/roles | Medium / High | P0 |
| Admin | `/dashboard/admin/users`, `/inspectors`, `/inspector-applications` | Role/application administration | Auth/roles/Inspector lifecycle | Medium / High | P0 |
| Admin | `/dashboard/admin/subscriptions`, `/complaints` | SaaS state and escalations | GB-M25/26 | Medium / High | P1 |
| Admin | `/dashboard/admin/provider-production`, `/system-health` | Truthful provider/system readiness | GB-M28/31 + health | Medium / High | P1 |
| Admin | `/dashboard/admin/reports`, `/audit-logs`, `/security-center` | Aggregate reports and audited support | GB-M36/security | Medium / High | P1 |
| Admin | `/dashboard/admin/settings`, `/policies` | Explicit platform configuration | Policy models | Low / High | P2 |

## Copy flags for visual closure

- Standardize Garden/Kindergarten Hebrew terminology and Owner/Manager labels.
- Replace remaining English readiness labels with user-facing Hebrew on canonical screens; retain technical terms only inside internal tools.
- Keep `uploaded`, `pending review`, `verified`, `manual settlement`, `provider unavailable`, `readiness` and `verified incident` distinct.
- Keep `scheduled Staff` distinct from `present Staff`, and `enrollment` distinct from `attendance`.
- Candidate Staff and active Staff require visibly different state and navigation.
- Safety copy may never equate a camera record, mock/shadow event, Track ID or face match with verified monitoring, Child identity or release authority.

## Excluded from visual redesign

Compatibility redirects, QA-only fixtures, internal launch/pilot/ISO/scale pages, deprecated API surfaces, historical data tables and Digital Observer core screens are excluded until explicitly promoted or retired.

# Gan Batuach UX-IMPLEMENT-03 — Owner Command Center Implementation

## Scope and source of truth

UX-IMPLEMENT-03 applies the approved Gan Batuach Owner visual language to the canonical Owner/Manager dashboard and navigation. The primary visual reference is `GB_UX_REF_OWNER_CORE.png`; `GAN_BATUACH_BRAND_MARK.png`, `GB_UX_REF_OWNER_ONBOARDING.png`, and `GB_UX_REF_AUTH_MASTER.png` supply the shared brand, spacing, RTL, and responsive language. GB-M37 remains the functional dashboard source and GB-M38 remains the route/navigation source.

No schema, Product authority, payment behavior, or Digital Observer core contract changed.

## Canonical routes

| Surface | Canonical route | Purpose |
| --- | --- | --- |
| Owner command center | `/dashboard/garden/operations` | Daily operational overview and drill-down |
| Action center | `/dashboard/garden/command-center` | Tasks, complaints, inspections, documents, and follow-up |
| Children and classrooms | `/dashboard/garden/children` | Children, classroom assignment, and capacity context |
| Attendance and pickup | `/dashboard/garden/attendance`, `/dashboard/garden/pickup` | Canonical attendance and authorized release |
| Staff and time | `/dashboard/garden/staff`, `/dashboard/garden/staff-time` | Employment, presence, shifts, and hours |
| Communication | `/dashboard/garden/messages`, `/dashboard/garden/communication`, `/dashboard/garden/notifications` | Messages, broadcasts, and notifications |
| Parent tuition | `/dashboard/garden/tuition-ledger` | Parent-to-Garden tuition ledger and reconciliation |
| Platform subscription | `/dashboard/garden/subscription` | Garden-to-Gan-Batuach subscription |
| Documents | `/dashboard/garden/documents` | Missing, review, rejected, and expiry actions |
| Inspections | `/dashboard/garden/inspections` | Inspection status and follow-up |
| Corrective actions | `/dashboard/garden/corrective-actions` | Remediation work and evidence |
| Safety and cameras | `/dashboard/garden/cameras`, `/dashboard/garden/trust-center` | Truthful Management-facing readiness and policy |
| Reports | `/dashboard/garden/reports` | Canonical role-aware reporting |
| Settings | `/dashboard/garden/settings` | Garden, permissions, account, and subscription settings |

## Component map

- `RoleAppShell` supplies the authenticated desktop and mobile shell.
- `SidebarNav` renders the 11 grouped Owner desktop destinations in the deep Gan Batuach navy treatment.
- `BottomNav` preserves five high-value mobile destinations: Home, Children, Staff, Communication, and More.
- `ManagementGardenContextSlot` resolves the authorized Garden set on the server and renders the compact `GardenContextSwitcher`.
- `ManagerOverviewDashboard` renders the hero, Today strip, operational cards, attention center, quick actions, finance separation, communication, schedule/activity, tasks, and full domain access map.
- Existing shared `AppShell`, `ResponsivePage`, status, icon, and navigation patterns remain the design-system foundation.

## Dashboard domain and data-source map

| Widget | Canonical source | Truth behavior |
| --- | --- | --- |
| Today / attendance | active enrollments + `attendance` | Expected, present, absent, departed, and not-recorded remain distinct |
| Staff today | active employments + `staff_shifts` | Scheduled, present, and missing clock-out remain distinct |
| Classrooms/capacity | `classrooms` + current classroom assignments | Capacity is backend data; missing capacity is shown as unconfigured |
| Enrollment | canonical enrollment requests | Information-required, waitlist, and awaiting-payment remain visible |
| Parent tuition | tuition billing periods | Parent-to-Garden outstanding, overdue, and reconciliation |
| Platform subscription | kindergarten subscription | Garden-to-platform status in a separate card |
| Communication | scoped messages and canonical notifications | Counts only; no private message body appears in the dashboard |
| Operations | tasks, complaints, documents, inspections, violations | Visual aggregation only; each domain retains its own workflow |
| Safety | camera records + verified operational state | Records alone never become live monitoring or an AI incident |
| Garden context | canonical active memberships | Selection is server-authorized before the active context cookie changes |

## Navigation and access map

The desktop sidebar exposes one top-level destination per operational domain and uses hints instead of deep nested menus. Subdomain drill-down appears within the dashboard and destination pages. The mobile bottom navigation remains deliberately limited; all additional canonical destinations are available through the real Settings/More route and the command-center domain map.

Owner-only and Owner-as-Teacher share one Owner shell. The role passed to the shell comes from the authenticated profile; no Teacher permission is manufactured by the visual layer. Existing canonical authorization continues to control teaching actions.

## Responsive behavior

Desktop at 1440×1024 uses a fixed deep-navy sidebar, utility header, wide command hero, six metric tiles, three-column operational cards, and two/three-column secondary grids. Mobile at 390×844 removes the sidebar, keeps a compact branded header and Garden selector, uses a fixed safe-area-aware bottom navigation, turns metrics into a horizontal snap strip, and stacks operational cards and domain groups without desktop tables.

## Loading, empty, error, and degraded states

- Canonical server rendering continues to provide route-level loading behavior.
- Widget data failures produce an explicit localized source warning; they never become false zero-success data.
- Empty schedules, tasks, classrooms, and updates have actionable empty-state copy.
- Safety displays verified, setup-required, degraded, or unavailable language derived from capability state.
- The dashboard never labels mock, shadow, sandbox, or record-existence data as live monitoring.

## Accessibility and RTL

The implementation preserves RTL document flow, correct directional chevrons, Hebrew labels, LTR handling for mixed identifiers, keyboard-focus styles, named icon actions, navigation landmarks, non-color status text, 44px mobile targets, and reduced-motion behavior. Metric values and status labels remain available as text; decorative imagery has empty alternative text.

## Visual-reference mapping

| Reference characteristic | Implemented treatment |
| --- | --- |
| Deep navy Owner navigation | Gradient navy `SidebarNav` with official mark and active blue item |
| White/light-blue workspace | Soft radial/linear workspace surfaces and elevated white cards |
| Branded hero imagery | Selective child/Garden image with operational copy and real CTAs |
| Metric row | Six compact, colored-but-restrained canonical metrics |
| Premium operational cards | Attendance ring, Staff status, and truthful Safety state |
| Quick-action language | Prioritized icon cards with real authorized destinations |
| Mobile composition | Compact header, Garden context, stacked cards, and bottom navigation |

## QA scenarios

- Synthetic multi-Garden Owner with four authorized Garden contexts.
- Garden switch verified through the canonical server endpoint and reflected after refresh.
- Owner and Manager role shell selection.
- Attendance, Staff, tuition/subscription, messages, tasks, documents, inspection, corrective action, and Safety source checks.
- Desktop 1440×1024 and mobile 390×844 screenshot capture.
- Console, server-error, overflow, and route-response checks during visual capture.
- Five bounded authenticated navigation samples recorded for Development comparison with the GB-M37 baseline.

## Known deviations

The reference contains illustrative operational counts and a visual camera preview. The implementation uses actual synthetic Development data and therefore may show zero or unavailable states. It deliberately replaces any unverified live-camera preview with a truthful Safety readiness card. The local isolated QA database reported unavailable canonical sources during one capture; the visible localized warning is the intended failure-isolation treatment and other cards remained usable.

## Performance

The dashboard keeps bounded explicit selects and loads independent sources concurrently. A direct five-navigation comparison on the same machine, local backend, browser, and `networkidle` measurement produced UX-02 baseline p50 4,687 ms / p95 12,797 ms and UX-03 p50 4,130 ms / p95 12,539 ms. Individual new canonical queries completed within 0.5 seconds in the isolated synthetic database. This shows no measured regression in the paired environment. The earlier GB-M37 warm baseline (p50 1,247 ms / p95 2,002 ms) used a materially different Development runtime and remains contextual rather than a Production SLA.

## Cost and boundaries

- New paid dependency: none.
- Fixed monthly cost delta: ₪0.
- Schema migration: none.
- Digital Observer core diff: 0.
- Production change: none.

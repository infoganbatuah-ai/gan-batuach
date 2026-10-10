# GAN BATUACH UX-IMPLEMENT-06 — Attendance and Pickup Operations

## Scope and source of truth

UX-IMPLEMENT-06 refines the existing Management attendance and pickup domains. It does not add a parallel attendance, identity, authorization, release, or camera model. Canonical server records remain authoritative for attendance state, server timestamps, Classroom scope, pickup authorization, release events, and tenant isolation.

Visual source of truth:

- `GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png` — primary reference
- `GB_UX_REF_OWNER_CORE.png` — authenticated shell and navigation
- `GAN_BATUACH_BRAND_MARK.png` — brand mark

## Route map

| Audience | Route | Surface |
| --- | --- | --- |
| Owner/Manager | `/dashboard/garden/attendance` | Daily Garden and Classroom attendance, date/status/Classroom filters, arrival actions, exact canonical counts |
| Owner/Manager | `/dashboard/garden/pickup` | Pickup authorization review, release confirmation, blocked authorization states, release history |
| Owner/Manager | `/dashboard/garden/children/[childId]` | Child attendance and release history in the canonical Child profile |
| Staff | `/dashboard/staff/attendance` | Staff's own time state with links to permitted Child operations |
| Staff | `/dashboard/staff/children-attendance` | Assigned-Classroom Child attendance only |
| Staff | `/dashboard/staff/pickup` | Assigned-Classroom pickup/release operations only |
| Parent | `/dashboard/parent/attendance` | Own linked Children only: today's state and attendance history |
| Parent | `/dashboard/parent/pickup` | Own linked Children only: pickup people, states, and history |

## Component map

| Component | Canonical responsibility |
| --- | --- |
| `GardenAttendanceActionButton` | Calls the canonical attendance API and refreshes from server truth after success or conflict |
| `GardenPickupVerificationPanel` | Reviews authorized people and performs the canonical Staff/Manager release transaction |
| `ParentPickupAuthorizationPanel` | Manages pickup people for the Parent's linked Child through canonical APIs |
| `RoleAppShell` | Provides the shared RTL authenticated shell, active Garden context, desktop navigation, and mobile bottom navigation |
| `OperationalState` | Distinguishes loading, empty, unavailable, denied, and request-failure states |

## Attendance state model

| State | UI meaning | Authority |
| --- | --- | --- |
| `expected` | Assigned and expected, with no arrival record | Canonical assignment plus daily attendance read model |
| `present` | Checked in and not departed | Canonical attendance record |
| `absent` | Explicitly absent | Canonical attendance record |
| `departed` / `checked_out` | Arrival and completed release/departure | Canonical attendance/release transaction |

Departed Children are never counted as currently present. Camera events, face matches, local device time, and client state cannot establish attendance.

## Pickup and release state model

| Authorization state | Release behavior |
| --- | --- |
| Approved and active | Selectable in an explicit two-step confirmation flow |
| Pending | Visible as not yet eligible where canonical |
| Revoked | Clearly labeled and blocked |
| Expired | Clearly labeled and blocked |
| Unapproved / missing | Blocked with a safe, actionable explanation |
| Stale or concurrent change | Server result wins; the screen refreshes and does not fabricate success |

Release confirmation shows the Child, proposed pickup person, authorization status, cancel/back action, and explicit confirm action. Server-side authorization is revalidated at confirmation time. A finalized release is idempotent and cannot create a second release event.

## Role visibility and data isolation

| Role | Visibility and actions |
| --- | --- |
| Owner/Manager | Garden-wide attendance and pickup operations for the active canonical Garden; Classroom filtering and history |
| Staff | Active-employment, active-Garden, assigned-Classroom Children only; canonical permission is required for attendance/release |
| Parent | Own linked Child/Children only; cannot perform Staff release confirmation |
| Inspector/Admin | Existing canonical authorization remains unchanged; no new operational release grant is introduced |

All queries retain canonical Garden membership and relationship predicates. The UI does not use legacy `profiles.garden_id` as authority.

## Responsive behavior

Desktop uses the approved deep-navy shell, a calm white/light-blue operational workspace, summary cards, filter toolbar, and a readable table/card hybrid. Mobile uses a single-column hierarchy, compact date/status controls, full-width Child rows, large touch targets, and the canonical bottom navigation. No desktop table is squeezed into 390 px.

## Camera and notification boundaries

Camera context is contextual only where an existing, policy-permitted, production-verified capability exists. This batch does not create scanning, face recognition, playback, or Digital Observer functionality. Camera/AI state never sets attendance and never releases a Child. Existing canonical arrival/departure notification fanout remains the source of user notifications; no parallel notification backend was added.

## Feature completeness map

| Canonical capability | Route/surface |
| --- | --- |
| Daily Garden attendance | Garden attendance |
| Classroom attendance | Garden attendance filters and Staff assigned-Classroom attendance |
| Arrival registration | Garden/Staff permitted Child attendance action |
| Departure registration | Canonical release flow in pickup workspace |
| Attendance history | Child profile, Parent attendance |
| Authorized pickup people | Garden/Staff pickup review and Parent pickup management |
| Revoked/expired blocking | Pickup review and confirmation |
| Release confirmation | Garden and Staff pickup workspaces |
| Release history | Garden pickup and Child/Parent history surfaces |
| Parent isolation | Parent attendance and pickup relationship-scoped reads |
| Staff Classroom scope | Staff children-attendance and pickup routes |
| Multi-Garden isolation | `RoleAppShell` active context plus server membership checks |

## QA evidence

- Focused source/contract checks: `npm run qa:ux06-focused`
- Live isolated-backend attendance/pickup E2E: `scripts/qa/run-management-attendance-pickup-e2e.mjs`
- Visual capture: `npm run qa:ux06-visual`
- Visual manifest: `qa-evidence/ux-implement-06/results.json`
- Screenshot checksums: `qa-evidence/ux-implement-06/SHA256SUMS`
- Viewports: Desktop `1440×1024`; Mobile `390×844`
- Personas: `owner-a`, `parent-a`, `staff-a`

## Known deviations

- The reference shows QR scanning and video evidence. No separate QR/scanning workflow was added because this repository does not expose a verified canonical scan path for release.
- No camera preview appears in the release confirmation. The screen truthfully keeps cameras contextual and excludes unverified or simulated Digital Observer evidence.
- Synthetic Development data is intentionally sparse on some screens. Empty and zero states are rendered as valid states, never as failed fetches.

## Boundaries

- Digital Observer core diff: `0`
- New fixed monthly commitment: `₪0`
- Production data, migrations, `main`, and Production deployment: untouched

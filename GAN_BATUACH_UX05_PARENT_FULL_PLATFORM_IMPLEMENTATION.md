# GAN BATUACH UX-IMPLEMENT-05 — Parent full platform

## Scope and canonical boundaries

UX-IMPLEMENT-05 refines the authenticated Parent experience without adding a Parent data model. Parent/Child links, Garden enrollment, attendance, tuition, documents, messages, notifications, camera authorization, and role isolation continue to use the existing Management domain services and tables.

The visual implementation follows `GB_UX_REF_PARENT_FULL_PLATFORM.png`, supported by `GB_UX_REF_OWNER_CORE.png` and `GAN_BATUACH_BRAND_MARK.png`. It uses the approved navy navigation, royal-blue actions, light-blue workspace, rounded cards, compact mobile hierarchy, and RTL status language.

## Route and feature map

| Canonical capability | Parent surface |
| --- | --- |
| Assigned Parent dashboard and Child switching | `/dashboard/parent` |
| Unassigned Parent handoff | `/dashboard/parent` |
| Garden discovery and enrollment | `/dashboard/parent/discover-kindergartens`, `/dashboard/parent/registrations`, `/dashboard/parent/requests` |
| Child profile | `/dashboard/parent/children/[id]` |
| Canonical attendance | `/dashboard/parent/attendance` |
| Authorized pickup context | Child profile and canonical pickup relationships |
| Tuition | `/dashboard/parent/payments` |
| Documents | `/dashboard/parent/documents` |
| Messages | `/dashboard/parent/messages` |
| Notifications | `/dashboard/parent/notifications` |
| Cameras and Safety | `/dashboard/parent/cameras`, `/dashboard/parent/trust-center` |
| Calendar | `/dashboard/parent/schedule` |
| Profile, security and preferences | `/dashboard/parent/settings` |

## Components

- `ParentAppFrame` supplies the shared Parent shell and active navigation state.
- `RoleAppShell` supplies the responsive desktop sidebar, mobile bottom navigation, brand header, date, notifications, profile and logout affordances.
- `ParentChildCard`, `ParentMetricCard`, `ParentSection`, `ParentActionTile`, and `ParentListRow` provide the reference card system.
- The Parent attendance page uses `getParentFamilyContext`, `selectAuthorizedChild`, and canonical `attendance` records. Camera events never create or change attendance.

## Assigned, unassigned and multi-Child states

- Assigned Parents receive Garden-scoped content derived from active canonical enrollments.
- Unassigned Parents receive actionable Garden discovery and Child setup states without fake Garden, attendance, camera, or tuition data.
- Multi-Child Parents can select an authorized Child. The server validates the requested Child against the Parent family context before rendering Child-scoped data.
- Cross-Garden content follows each Child's canonical enrollment; no client-only Garden substitution is used.

## Canonical state handling

- Attendance displays present, absent, departed, expected, and incomplete states from canonical records.
- Tuition is Parent-to-Garden and stays separate from the Garden platform subscription.
- Documents preserve missing, uploaded, pending, verified, rejected, expired, and replacement-required distinctions where present in the canonical source.
- Cameras remain permission and capability gated. Unavailable or unverified capability is shown as unavailable; no mock or shadow event is represented as Production truth.
- Messages, notifications, enrollment requests, and documents retain separate domain models.

## Responsive behavior and accessibility

Desktop uses a compact navy navigation rail and a light focused workspace. Mobile uses a single-column card hierarchy, large controls, safe bottom-navigation spacing, and no compressed desktop tables. RTL direction, mixed email/number content, visible focus, semantic navigation, named icon controls, status text, reduced motion, and touch targets are preserved by the shared shell and field components.

## Validation scenarios

- assigned and unassigned Parent
- multi-Child switching and unauthorized Child rejection
- Child profile access
- canonical attendance history
- tuition and document read models
- enrollment and Garden discovery
- messages and notifications
- truthful camera capability
- desktop `1440×1024`
- mobile `390×844`

Visual evidence is stored in `qa-evidence/ux-implement-05/` with SHA-256 hashes. Focused source checks are provided by `npm run qa:ux05-focused`; screen capture and runtime checks are provided by `npm run qa:ux05-visual`.

## Deviations

The implementation extends the reference with canonical enrollment lifecycle, explicit synthetic-environment labeling, and truthful unavailable camera/payment states. These additions use the approved visual system. No canonical feature was removed.

## Boundaries

- Digital Observer core diff: `0`
- New fixed monthly commitment: `₪0`
- Production deployment: not performed

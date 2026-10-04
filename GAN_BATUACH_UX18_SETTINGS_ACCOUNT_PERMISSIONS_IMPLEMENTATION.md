# GAN BATUACH UX-IMPLEMENT-18 — Settings, Account & Permissions

## Source and visual references

- Source integration head: `70d9a5aff9894086b2bc5c6ae4e0cc5815903b25` (UX-IMPLEMENT-17 merged).
- Primary: `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`, SHA-256 `58a4ae7af9050b0b45d8c2c4a094df15f581418612ae76142fb7e4fb436129a1`.
- Supporting: Owner Core, Platform Admin, Parent, Staff, Inspector and the official Gan Batuach brand mark supplied with the task.
- The reference controls composition and visual language. Canonical server models control fields, capabilities and authorization.

## Settings information architecture

The shared `SettingsPlatformNavigation` composes only role-appropriate destinations:

1. Profile
2. Account security
3. Notifications and quiet hours
4. Garden profile for Owner/Manager
5. Users and permissions for authorized management/Admin roles
6. Camera policy
7. Garden platform subscription for authorized roles
8. Integrations/readiness
9. Language, timezone and accessibility-related preferences where canonical
10. Privacy and role boundaries

No Settings-specific RBAC table or duplicate preference store was added.

## Route map and feature completeness

| Canonical capability | Role | Route / surface | Source of truth |
|---|---|---|---|
| Personal profile | All supported roles | Role `/settings` page | `profiles` plus canonical role profile |
| Email/phone verification | All | Role `/settings`, `/dashboard/security-settings` | Auth user + profile verification timestamps |
| Password recovery/change | All | `/forgot-password` → canonical reset flow | Supabase Auth |
| MFA readiness | All | `/dashboard/security-settings` | `mfa_enrollment_status` |
| Passkeys | All | `/dashboard/security-settings` | `passkey_credentials` and passkey APIs |
| Devices/sessions | All | `/dashboard/security-settings` | `trusted_devices`, `security_sessions` |
| Notifications | Role-specific `/notifications` | Notification preferences panel | `communication_preferences`, `push_category_preferences` |
| Quiet hours | Role-specific `/notifications#preferences` | Notification preferences panel | canonical quiet-hour fields |
| Language/timezone | Role-specific notification preferences | Preference controls | `preferred_language`, `quiet_hours_timezone` |
| Garden profile | Owner/Manager | `/dashboard/garden/settings#garden-profile` | active canonical Garden |
| Multi-Garden context | Owner/Manager | settings status + Garden switcher | `management_gardens_for_current_user` and active-Garden cookie |
| Classroom/Staff scope | Owner/Manager | `/dashboard/garden/staff` | employment/classroom assignments |
| Owner-as-Teacher / delegated Teacher | Owner/Manager | `/dashboard/garden/staff` | `garden_teaching_assignments` |
| Parent settings | Parent | `/dashboard/parent/settings` | own profile/children/policies only |
| Staff settings | Staff | `/dashboard/staff/settings` | active employment Garden/Classroom scope |
| Inspector settings | Inspector | `/dashboard/inspector/settings` | application and assigned Gardens |
| Admin settings | Admin | `/dashboard/admin/settings` | canonical Admin areas and server authorization |
| Camera policies | Role-specific camera routes | settings navigation and Safety UI | UX-16 camera policy contracts |
| Platform subscription | Owner/Manager/Admin | `/dashboard/garden/subscription`, `/dashboard/admin/subscriptions` | GB-M26 subscription data |
| Provider readiness | Owner/Manager/Admin | subscription/provider pages | safe provider readiness contract |
| Privacy | All | role settings privacy card | server authorization and canonical policies |
| Logout | Role shells | shell logout action | canonical session sign-out |

## Account and security policy

- A verified Email is sufficient for normal account activation.
- Phone verification is displayed truthfully and is not required for normal activation.
- SMS/WhatsApp remain disabled when delivery capability is not configured.
- MFA, Passkey, device and session status come from existing canonical tables/APIs.
- Password changes use the existing secure recovery route.
- No token, service-role key, provider secret or infrastructure credential is rendered.
- No account deletion control was added because no canonical user-facing deletion workflow exists.

## Garden settings and multi-Garden isolation

Garden settings load the active Garden from the server-validated management context. The profile mutation endpoint now calls `getManagementGardenContext()` before every Garden write and uses the returned Garden ID. It no longer performs a Garden mutation through an Admin client or trusts `profile.garden_id` as the requested write target.

Garden profile data stays on the canonical `gardens` record. Classroom structure links to the existing Classroom/Staff surfaces. No holiday schedule or legal ratio logic was introduced. The canonical operational timezone is displayed through existing context; user quiet-hour timezone remains a separate personal preference.

## Permission model

| Role | Visible settings | Excluded boundaries |
|---|---|---|
| Owner/Manager | own account, active Garden, team scope, teaching assignments, camera policy, subscription | other Gardens without membership, Admin-only controls |
| Owner-as-Teacher | management plus explicit teaching scope | no automatic Teacher grant |
| Delegated Teacher/Staff | own profile, notifications, employment/Classroom context, scoped camera access | Garden-wide administration and finance |
| Parent | own profile, own children, pickup, notifications and explicit camera policy | Garden-wide settings and other families |
| Inspector | own profile, assigned Gardens, notifications and explicit camera/evidence policy | Owner/Admin configuration |
| Admin | own account, canonical user/role, provider and platform settings | broad private Child/message/document/media browsing |

## Subscription, billing and integrations

- Garden → Gan Batuach platform subscription remains distinct from Parent tuition.
- The payment surface continues to report setup/unavailable/verification-required truth and never displays a working checkout without Production verification.
- Notification, payment and Digital Observer readiness link to existing canonical readiness surfaces.
- Digital Observer core was not changed. Management only displays integration state already exposed through canonical contracts.

## Desktop and Mobile mapping

Desktop uses the approved navy application shell, a sticky Settings category rail, spacious cards, three-column status summaries, full profile forms and role-safe detail panels. Mobile changes to a full-width category list, single-column cards, large controls and sticky save action. It does not compress the Desktop grid.

RTL rules cover forms, Email/phone values, dates, times, currency labels, role names, toggles and navigation. Focus-visible, semantic navigation, labels, live save status, non-color state text, touch targets and reduced-motion rules are included.

## QA evidence

- Focused contract: `npm run qa:ux18-focused`.
- Authenticated role and mutation contract: `npm run qa:ux18-functional`.
- Visual capture: `npm run qa:ux18-visual`.
- Regression coverage: UX-11 notifications, UX-16 camera policy, UX-17 Admin, subscriptions, provider readiness, multi-Garden Staff, contact verification, Owner/Teacher semantics and Parent/Manager live contract.
- Required gates: typecheck, lint baseline, production build, domain, security/isolation, migration health and release-contract preflight passed on the feature worktree.
- Evidence: `qa-evidence/ux-implement-18/visual-qa-report.json` and `evidence-manifest.json`.
- Required reference comparison: `qa-evidence/ux-implement-18/reference-comparison-board.webp`.
- Desktop contact sheet: `qa-evidence/ux-implement-18/contact-sheet-desktop.webp`.
- Mobile contact sheet: `qa-evidence/ux-implement-18/contact-sheet-mobile.webp`.
- Screenshots: 21 concepts × 2 approved viewports = 42 role-authenticated captures.
- Production access during QA: `false`.

## Deviations

- Account deletion/destructive confirmation is omitted because there is no canonical user-facing deletion flow.
- Theme/density switches are omitted because there is no canonical Management preference model for them. Language and timezone use existing canonical fields.
- Garden operating-hours editing is not invented; existing operational context remains authoritative until a canonical Garden-hours mutation contract exists.
- SMS and WhatsApp are visible only as truthful unavailable channels when their delivery provider is not configured.

## Cost and boundaries

- New fixed monthly commitment: `₪0`.
- New paid dependency: none.
- Schema migration: none.
- Digital Observer core diff: `0`.
- Production: untouched.

# GAN BATUACH V4 PRIMARY SCREEN MAP

Source Development SHA: `af30b84f21a35e817738bf0329cf1a632a10a5ae`

This map binds each owner-blocking primary reference panel to one actual primary route. Secondary routes remain available, but they are not accepted as substitutes for the composition on the primary route.

| Domain | Primary Reference Panel | Primary Actual Route | Required Composition | Current Mismatch | Fix |
| --- | --- | --- | --- | --- | --- |
| Owner Dashboard | `qa-evidence/v4-primary-reference-crops/owner-dashboard-primary.png` from `GB_UX_REF_OWNER_CORE.png` | `/dashboard/garden` | Navy shell, utility bar, visual hero, compact six-metric strip, three-column daily/camera/activity row, quick actions and operational cards in the first viewport | Resolved in candidate | Image-dominant hero, six-metric strip, three operational regions, quick actions and lower cards now appear together on the primary route |
| Parent Assigned | `qa-evidence/v4-primary-reference-crops/parent-assigned-primary.png` from `GB_UX_REF_PARENT_FULL_PLATFORM.png` | `/dashboard/parent` | Child selector/identity, three compact daily panels, four compact operational cards, child-centered imagery and quick actions in the first viewport | Resolved in candidate | The assigned-child card, truthful attendance row, camera panel, operational updates and quick actions now share the primary first viewport |
| Parent Multi-Child | `qa-evidence/v4-primary-reference-crops/parent-multi-child-primary.png` from `GB_UX_REF_PARENT_FULL_PLATFORM.png` | `/dashboard/parent?child=<authorized-child-id>` | Multiple child identities visible simultaneously, selected state, Garden association, immediate selected context, followed by the same child-centered dashboard | Resolved in candidate | Desktop and Mobile expose multiple portrait cards, selected state, Garden association and immediate child-scoped content; a visual add-child card remains available |
| Platform Admin | `qa-evidence/v4-primary-reference-crops/platform-admin-primary.png` from `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png` | `/dashboard/admin` | Dense control center with KPI row, two charts, service health, full-height recent activity rail, and three lower operational tables | Resolved in candidate | The primary dashboard now presents all control-center regions simultaneously; Mobile uses the compact approved management menu composition |
| Settings / Account / Permissions | `qa-evidence/v4-primary-reference-crops/settings-primary-desktop.png` from `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png` | `/dashboard/garden/settings` | Four simultaneous areas: settings navigation, profile/account, security/preferences, and Garden/subscription/integrations | Resolved in candidate | The primary Desktop route now exposes all four areas together, while Mobile keeps the approved purpose-built settings list |

## Mobile mapping

- Owner Dashboard: `owner-dashboard-primary-mobile.png` → `/dashboard/garden` at `390 × 844`.
- Parent Assigned: `parent-assigned-primary-mobile.png` → `/dashboard/parent` at `390 × 844`.
- Parent Multi-Child: `parent-multi-child-primary-mobile.png` → `/dashboard/parent?child=<authorized-child-id>` at `390 × 844`.
- Platform Admin: `platform-admin-primary-mobile.png` → `/dashboard/admin` at `390 × 844`.
- Settings: `settings-primary-mobile.png` → `/dashboard/garden/settings` at `390 × 844`.

All geometry is normalized in `GAN_BATUACH_V4_PRIMARY_GEOMETRY.json`; actual measurements are populated again from fresh merged-head screenshots in the V5 evidence pass.

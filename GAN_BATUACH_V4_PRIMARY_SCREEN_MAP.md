# GAN BATUACH V4 PRIMARY SCREEN MAP

Source Development SHA: `5635988133ca8690aa28c8797d1c54ef6ca1e8e3`

This map binds each owner-blocking primary reference panel to one actual primary route. Secondary routes remain available, but they are not accepted as substitutes for the composition on the primary route.

| Domain | Primary Reference Panel | Primary Actual Route | Required Composition | Current Mismatch | Fix |
| --- | --- | --- | --- | --- | --- |
| Owner Dashboard | `qa-evidence/v4-primary-reference-crops/owner-dashboard-primary.png` from `GB_UX_REF_OWNER_CORE.png` | `/dashboard/garden` | Navy shell, utility bar, visual hero, compact six-metric strip, three-column daily/camera/activity row, quick actions and operational cards in the first viewport | Hero copy/image split is reversed relative to the approved silhouette; first operational row consumes too much height; quick actions and operational cards begin too low | Rebalance hero to the approved image-dominant ratio, compress the first row, place quick actions directly beneath it, and expose operational cards at the fold |
| Parent Assigned | `qa-evidence/v4-primary-reference-crops/parent-assigned-primary.png` from `GB_UX_REF_PARENT_FULL_PLATFORM.png` | `/dashboard/parent` | Child selector/identity, three compact daily panels, four compact operational cards, child-centered imagery and quick actions in the first viewport | Camera panel dominates the screen; identity, metrics and actions do not reproduce the approved three-panel dashboard; daily and notification content begins below the fold | Rebuild the primary grid into selector row, attendance/camera/updates row, and compact operational strip while retaining truthful camera state and all canonical links |
| Parent Multi-Child | `qa-evidence/v4-primary-reference-crops/parent-multi-child-primary.png` from `GB_UX_REF_PARENT_FULL_PLATFORM.png` | `/dashboard/parent?child=<authorized-child-id>` | Multiple child identities visible simultaneously, selected state, Garden association, immediate selected context, followed by the same child-centered dashboard | Selector is present but reads as a long utility rail; selected context is not visually dominant enough and the screen remains nearly identical to the one-child state | Promote selector cards with larger portraits and explicit selected context; give multi-child state a dedicated compact rail on Mobile and stronger card hierarchy on Desktop |
| Platform Admin | `qa-evidence/v4-primary-reference-crops/platform-admin-primary.png` from `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png` | `/dashboard/admin` | Dense control center with KPI row, two charts, service health, full-height recent activity rail, and three lower operational tables | Upper region is divided into four equal panels; recent activity is too narrow/short; lower tables are too small and empty canvas begins too early | Use an asymmetric main-plus-activity grid, combine charts and health in the main region, extend activity rail, and enlarge lower operational tables |
| Settings / Account / Permissions | `qa-evidence/v4-primary-reference-crops/settings-primary-desktop.png` from `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png` | `/dashboard/garden/settings` | Four simultaneous areas: settings navigation, profile/account, security/preferences, and Garden/subscription/integrations | Four areas exist but Garden context is fragmented by status cards; profile and security columns are too narrow and sparse; the first viewport does not match the reference proportions | Remove the redundant status row from the primary visual hierarchy, enlarge the three content columns, add reference-style inline rows/toggles and keep Garden/subscription blocks together |

## Mobile mapping

- Owner Dashboard: `owner-dashboard-primary-mobile.png` → `/dashboard/garden` at `390 × 844`.
- Parent Assigned: `parent-assigned-primary-mobile.png` → `/dashboard/parent` at `390 × 844`.
- Parent Multi-Child: `parent-multi-child-primary-mobile.png` → `/dashboard/parent?child=<authorized-child-id>` at `390 × 844`.
- Platform Admin: `platform-admin-primary-mobile.png` → `/dashboard/admin` at `390 × 844`.
- Settings: `settings-primary-mobile.png` → `/dashboard/garden/settings` at `390 × 844`.

All geometry is normalized in `GAN_BATUACH_V4_PRIMARY_GEOMETRY.json`; actual measurements are populated again from fresh merged-head screenshots in the V5 evidence pass.

# UX-IMPLEMENT-07 VISUAL QA

Primary reference: `GB_UX_REF_STAFF_FULL_PLATFORM.png`. Supporting references: `GB_UX_REF_OWNER_CORE.png` and `GAN_BATUACH_BRAND_MARK.png`.

Evidence is generated under `qa-evidence/ux-implement-07/`. Every capture verifies a 200 response, no page-level JavaScript error, no server 5xx response and no horizontal overflow.

| Screen | Route | Viewport | Reference area | Status |
| --- | --- | --- | --- | --- |
| Staff list | `/dashboard/garden/staff` | 1440×1024 | Desktop Staff list | VISUAL_PASS |
| Staff list | `/dashboard/garden/staff` | 390×844 | Mobile Staff list | VISUAL_PASS |
| Staff profile cards | `/dashboard/garden/staff?staff=active` | 1440×1024 | Desktop Staff profile | VISUAL_PASS |
| Time ledger | `/dashboard/garden/staff-time` | 1440×1024 | Desktop hours | VISUAL_PASS |
| Time ledger / missing clock-out | `/dashboard/garden/staff-time` | 390×844 | Mobile hours | VISUAL_PASS |
| Staff dashboard | `/dashboard/staff` | 1440×1024 | Desktop Staff command center | VISUAL_PASS |
| Staff dashboard | `/dashboard/staff` | 390×844 | Mobile Staff home | VISUAL_PASS |
| Clock in/out | `/dashboard/staff/attendance` | 390×844 | Mobile clock | VISUAL_PASS |
| Schedule/time history | `/dashboard/staff/shifts` | 1440×1024 | Desktop shifts | VISUAL_PASS |
| Upcoming shifts | `/dashboard/staff/shifts` | 390×844 | Mobile shifts | VISUAL_PASS |
| Active Staff profile/settings | `/dashboard/staff/settings` | 390×844 | Mobile profile/settings | VISUAL_PASS |
| Documents | `/dashboard/staff/documents` | 390×844 | Mobile documents | VISUAL_PASS |
| Tasks | `/dashboard/staff/tasks` | 390×844 | Mobile operational list | VISUAL_PASS |
| Messages | `/dashboard/staff/messages` | 390×844 | Mobile messages | VISUAL_PASS |
| Camera policy state | `/dashboard/staff/cameras` | 390×844 | Mobile Safety/cameras | VISUAL_PASS |
| Multi-Garden selection | `/dashboard/staff` | 1440×1024 | Desktop multi-Garden | VISUAL_PASS |

Material deviations: none. Canonical controls and truthful unavailable states extend the same visual system where the concept image does not show the full functionality.

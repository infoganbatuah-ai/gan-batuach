# PRODUCT REALITY FIX 1 - Static / Dummy UI Inventory

## Critical / High Findings

| Severity | File | Route / role | UI label | Dummy type | User-facing risk | Fix strategy |
|---|---|---|---|---|---|---|
| High | `app/dashboard/garden/page.tsx` | Manager dashboard | Date pill | Hardcoded date `25 במאי 2025` | Makes current product look like an old static demo. | Replaced with Israel current date helper. |
| High | `app/dashboard/garden/attendance/page.tsx` | Manager attendance | Date pill | Hardcoded date `25 במאי 2025` | Attendance screen looked stale/static. | Replaced with Israel current date helper. |
| High | `components/teacher-app-ui.tsx` | Shared teacher frame | Date pill | Hardcoded date `25 במאי 2025` | Any teacher module using the shared frame inherited stale date. | Replaced with Israel current date helper. |
| High | `app/dashboard/garden/page.tsx` | Manager dashboard | Children/staff counts | Fake fallback values: `24`, `5/6`, `07:45` | Shows fake operational values when data is missing. | Bound to real query counts or honest empty/readiness text. |
| Medium | `app/dashboard/parent/page.tsx` | Parent dashboard | `href="#child-profile"`, `href="#requests"` | Internal anchors | Could feel like dummy buttons if target is not visible. | Kept because targets exist; requires authenticated QA. |
| Medium | `app/dashboard/garden/*` | Several manager modules | `href="#..."` management anchors | Internal section anchors | Some may be valid in-page workbenches; others may feel like dead buttons. | Logged for authenticated QA rather than broad unsafe rewrites. |
| Medium | `app/digital-observer/dashboard/page.tsx` | Digital Observer | `href="#sites"`, `#cameras`, `#alerts`, `#setup` | Internal anchors | Needs logged-in DO validation. | Keep as section navigation if targets exist; verify in AUTHED UX QA 2. |

## Not Fixed In This Phase

Some admin/manager pages still use in-page anchors. They were not automatically removed because several are legitimate section jumps. QA must verify that each feels like a real action or readiness state.

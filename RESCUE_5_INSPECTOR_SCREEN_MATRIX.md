# RESCUE 5 - Inspector Screenshot-To-Route Matrix

## Reference Availability

Canonical repository path requested by the rescue brief:

- `docs/ux-references/inspector/`

Status: not present in the repository at the time of this pass.

External reference files used for manual visual mapping:

- `/Users/danielderi/Desktop/עיצוב גן בטוח/מפקח/דשבורד ראשי מפקח.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/מפקח/גנים משוייכים מפקח.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/מפקח/ביקורות מפקח.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/מפקח/היסטוריית ביקורות מפקח.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/מפקח/דוח ביקורת מפקח לגן.png`

Because the screenshots are outside the repository, final pixel validation is classified as `manual_visual_review_required`.

## Matrix

| Reference area | Screenshot filename | Existing route | Current page/component | Data source | Existing actions/API | Role/assignment guard | Privacy constraints | Implementation status |
|---|---|---|---|---|---|---|---|---|
| Inspector main dashboard | `דשבורד ראשי מפקח.png` | `/dashboard/inspector` | `app/dashboard/inspector/page.tsx`, `InspectorAppFrame` | `inspectors`, assigned `gardens`, `required_inspections`, `inspections`, `violations`, `complaints`, `tasks` | Start inspection, assigned gardens, history, violations, tasks, notifications | `requireRole(["inspector"])`; assigned garden IDs scoped by `gardens.inspector_id = profile.id` | No unassigned garden query; no child/parent/staff details exposed | Implemented with truthful empty states; demo score/time fallbacks removed |
| Assigned kindergartens | `גנים משוייכים מפקח.png` | `/dashboard/inspector/control-center` and `/dashboard/inspector/command-center` | `app/dashboard/inspector/command-center/page.tsx` | assigned `gardens`, `required_inspections` | Open inspection by garden, due inspections | `requireRole(["inspector"])`; assigned garden scope | Shows garden-level operational data only | Implemented; raw/fake score fallback removed; statuses rendered in Hebrew |
| Inspections dashboard | `ביקורות מפקח.png` | `/dashboard/inspector/inspections`, `/dashboard/inspector/inspections/due` | `app/dashboard/inspector/inspections/page.tsx`, `app/dashboard/inspector/inspections/due/page.tsx`, `InspectorInspectionWizard` | `required_inspections`, `inspections`, canonical inspection question data | Start/resume inspection, save/submit existing inspection flow | `requireRole(["inspector"])`; required inspections scoped to assigned inspector/garden | GPS/signature/evidence logic preserved | Implemented with existing workflow; deeper field QA required |
| Monthly inspection form | `ביקורות מפקח.png` | `/dashboard/inspector/inspections` | `InspectorInspectionWizard`, `InspectionFormBuilder` | Existing inspection records and question responses | Save draft, section answers, submit through existing API | Existing server and role checks preserved | No inspection question-bank rewrite | Implemented; no new question logic invented |
| Inspection history | `היסטוריית ביקורות מפקח.png` | `/dashboard/inspector/inspections/history` | `app/dashboard/inspector/inspections/history/page.tsx` | `inspections` scoped by `inspector_id` | View report, download report through `/api/inspections/[id]/report` | `requireRole(["inspector"])` | Only own inspector history is queried | Implemented; fake average score fallback removed |
| Inspection report | `דוח ביקורת מפקח לגן.png` | `/api/inspections/[id]/report` and report links from history | `inspection-report-view`, API report route | Existing inspection, answers, findings, signature/report data | View/download generated report where backend supports it | Existing API authorization preserved | No fake PDF action added | Existing implementation preserved; provider/backend readiness must be QA-tested |
| Defects and findings | Defect section inside report references | `/dashboard/inspector/violations` | `app/dashboard/inspector/violations/page.tsx`, `ViolationStatusActions` | `violations` for assigned gardens | Approve/reject/request follow-up using existing status component | `requireRole(["inspector"])`; assigned gardens filtered | No unrelated garden findings | Implemented; existing action logic preserved |
| Corrective actions and follow-up | Defect/follow-up portions of report references | `/dashboard/inspector/violations`, `/dashboard/inspector/compliance` | Existing violations/compliance pages | `violations`, compliance review data | Review evidence, status transitions where existing | Existing server/action rules preserved | Evidence must remain private | Implemented at UI-shell level; backend depth requires UXQA 5A |
| Inspector profile and approval status | Pending/approval state implied by inspector flow | `/dashboard/inspector`, `/dashboard/inspector/apply`, `/dashboard/inspector/settings` | Pending branch in `app/dashboard/inspector/page.tsx`, apply/settings pages | `inspectors`, profile data | Complete application, profile/settings | `requireRole(["inspector"])`; active flag checked | Pending inspectors do not see assigned gardens/inspections | Implemented; pending state is intentional and non-operational |
| Complaints or urgent inspection flow | Dashboard/report alert areas | `/dashboard/inspector/reports`, `/dashboard/inspector/notifications`, `/dashboard/inspector/tasks` | Reports/notification/task pages | `complaints`, `incident_reports`, `notifications`, `tasks` | Open reports/tasks; notification center | Assigned garden IDs and recipient profile filters | No complainant identity expansion added | Implemented; raw status labels translated where touched |
| Camera/observer access | Not shown as primary reference, required by brief | `/dashboard/inspector/cameras`, `/dashboard/inspector/observer-network`, `/dashboard/inspector/ai-events` | Existing inspector camera/observer pages | assigned garden cameras and reviewed observer signals | Secure camera card, reviewed signal pages | Assigned garden query; existing camera policy checks preserved | No RTSP/IP/credential exposure; camera card forced to safe details | Implemented safety pass; live gateway remains provider-dependent |

## Preserved Routes

The following inspector routes remain available and use the inspector app frame or an existing app-style inspector component:

- `/dashboard/inspector`
- `/dashboard/inspector/control-center`
- `/dashboard/inspector/command-center`
- `/dashboard/inspector/inspections`
- `/dashboard/inspector/inspections/due`
- `/dashboard/inspector/inspections/history`
- `/dashboard/inspector/reports`
- `/dashboard/inspector/violations`
- `/dashboard/inspector/cameras`
- `/dashboard/inspector/settings`
- `/dashboard/inspector/tasks`
- `/dashboard/inspector/notifications`
- `/dashboard/inspector/compliance`
- `/dashboard/inspector/risk`
- `/dashboard/inspector/ratings`
- `/dashboard/inspector/observer-network`
- `/dashboard/inspector/observer-pilot`
- `/dashboard/inspector/ai-events`
- `/dashboard/inspector/apply`


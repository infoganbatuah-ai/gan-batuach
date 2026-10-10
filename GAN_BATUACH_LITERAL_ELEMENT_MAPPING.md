# Gan Batuach literal element mapping

**Task:** UX-LITERAL-REFERENCE-RECONSTRUCTION
**Prepared before product-code changes:** YES
**Source Development SHA:** `ae283890239caa2b75fb9ab2a8a8f193c8919296`
**Inputs:** original approved references and fresh review of the V3 actual Desktop/Mobile evidence

This is the mandatory `REFERENCE ELEMENT → EXISTING ACTUAL ELEMENT → REQUIRED CHANGE` plan. It invalidates inherited visual labels. Final status will be assigned only after fresh V4 captures, overlays and annotated reviews.

## Cross-product frame

| Reference element | Existing actual element | Required literal change |
|---|---|---|
| Navy physical-left sidebar at roughly 10–14% | Role shell is on the correct side and branded, but width and row density vary by role and some labels differ from the reference grouping | Define role-scoped widths and nav ordering from each reference; keep active blue row, centered brand, compact icon/text rhythm and footer identity |
| Shallow top utility bar | Current bar is generally correct but date/context/search consume different widths and some screens lack the reference avatar placement | Normalize height and three-zone geometry per role; keep search left, date/context center, avatar/alerts right where shown |
| Pale-blue workspace with compact page padding | Current workspace matches the palette but often leaves substantially more blank space | Reduce dead space through reference-specific grids and fixed first-viewport proportions |
| Purpose-built Mobile shell | Current Mobile shell is visually strong but some screens inherit desktop ordering and oversized section headers | Preserve the top/bottom bars while giving every domain explicit Mobile order, rails and sticky actions |
| Official brand mark | Current shell uses the correct mark but onboarding/header scale varies | Use the official asset at reference scale; white/navy treatment by surface |

## 1. Auth / Registration

| Reference element | Existing actual element | Required change |
|---|---|---|
| Tall image-led login split | Existing auth screens already use an image/form split close to the reference | Re-capture; adjust split ratio, image crop and form vertical rhythm only if overlay shows displacement |
| Card-based role selection | Existing role selection is card-based | Match card proportions, order and CTA position; retain canonical role options |
| Independent Mobile stages | Existing Mobile auth is purpose-built | Verify first viewport and bottom-safe spacing; avoid desktop form compression |

## 2. Owner Onboarding

| Reference element | Existing actual element | Required change |
|---|---|---|
| Entry is a near-even copy/photo split with large brand | Current entry is a horizontal card inside a broad generic shell; image and copy are too small relative to the viewport | Rebuild entry as the dominant split composition with a full-height photo half, centered brand/copy/benefits and CTA |
| Desktop working step has a narrow step rail and one focused compact task pane | Current page includes a large header, separate hero, broad progress panel and a large stage card; first viewport reads as a system wizard | Remove the generic hero from working steps; make the step rail structural; center one task card with reference width and contextual image |
| Reference progress is compact dots/rail | Current progress is a wide numbered bar | Add a literal desktop step rail and Mobile dot progress; retain accessible labels and current-step semantics |
| Garden step photo above fields | Current image is a broad generic welcome visual or absent on some steps | Place a Garden photo card inside the Garden step at the reference position and proportion |
| Completion mark + five summary tiles + two CTAs | Current completion structure is more generic and vertically loose | Recompose the completion screen to the exact centered hierarchy and horizontal tile row |
| Mobile sequence uses one focused card per step | Current Mobile includes the desktop-style banner before the form | Hide desktop framing; place progress, title, card and primary CTA in the same order as the eight reference phones |

## 3. Owner Dashboard

| Reference element | Existing actual element | Required change |
|---|---|---|
| Banner approximately 20% of content height, with welcome/weather left and child image middle/right | Current banner is shallower, copy is centered differently, and context/CTA chips replace the reference welcome layout | Rebuild banner internals and height; position image and welcome copy to match the reference silhouette; add compact weather/date/context |
| Six compact KPI cards directly under banner | Current six metrics are close in count but sizes and text hierarchy differ | Match reference height, icon bubble, metric scale, tint and sublabel rhythm |
| Three asymmetric operational panels | Current panels contain an empty schedule state, a very large camera card and a different activity arrangement | Use the reference widths and equal row height; fill with truthful QA schedule/activity data and camera imagery/state |
| Seven quick actions in a full-width strip | Current quick strip has six actions and different order/labels | Restore the reference action count/sequence where canonical; integrate additional function below without changing first viewport |
| Human activity list with avatars | Current activity list is text-heavy and lacks consistent avatars | Use avatar-led compact rows with time and semantic state |
| Lower operational panels remain secondary | Current lower panels enter the first viewport due to different heights | Lock the first viewport so banner, KPI row, three panels and action strip occupy the reference positions |
| Mobile four KPIs, photo banner, activity, 2×4 actions | Current Mobile shows only three KPIs before a text-heavy activity section | Match the reference order and visible block count; retain truthful counts |

## 4. Children / Classrooms / Child Profile / Enrollment

| Reference element | Existing actual element | Required change |
|---|---|---|
| Children list begins near the top with avatar-led compact rows | Current page adds a gradient Add button, four KPI blocks and a large filter bar before a wide table | Remove the extra KPI row from the reference-critical first viewport; move add/filter controls into the header strip; tighten row geometry and increase avatar identity |
| Reference filters are compact and secondary | Current filters occupy a full-height card | Convert to a compact search/filter line above the list |
| Profile header has a large circular photo and horizontal tabs | Current profile structure needs direct verification; V3 domain board does not show it | Re-capture the exact route and align photo, identity, action and tabs to the reference before accepting |
| Four photo-led classroom cards | Current classroom route must be compared independently; Children board currently shows only the list | Make the image-card rail the dominant first section, then place the compact roster below |
| Capacity bar and avatar stack inside classroom cards | Current generic cards vary | Add reference-position capacity progress and child/avatar context using canonical data |
| Enrollment is a compact avatar-led request table with status tabs | Current enrollment needs route-specific comparison | Match tabs, row density, status placement and pagination; preserve canonical actions |
| Mobile starts with title/search then child rows | Current Mobile inserts KPI blocks and expanded filters before children | Remove those blocks from above the fold; restore avatar rows and reference bottom-nav order |

## 5. Parent — Assigned

| Reference element | Existing actual element | Required change |
|---|---|---|
| Dashboard greeting and visible child selector lead the page | Current page has a wide generic greeting banner then a four-child rail that is visually separated | Merge greeting/date/context and visual child cards into the reference top hierarchy |
| Three primary panels: attendance, camera image, recent updates | Current page centers a large camera state and places four tall summary cards at the side | Rebuild the main row into the reference three-panel proportion; camera image remains truthful, attendance and updates become compact lists |
| Four compact lower action/status cards | Current summary cards are tall and occupy more vertical space | Use the reference compact horizontal card row and move extended detail below |
| Child profile header and tabs | Current assigned dashboard uses a smaller identity card rather than the profile composition | Ensure the profile route reproduces the large portrait/header/tabs/three-card layout |
| Mobile child selector and profile identity above action cards | Current Mobile hierarchy is close but summary cards become oversized | Match compact card heights, child photo size and visible above-fold action count |

## 6. Parent — Unassigned

| Reference element | Existing actual element | Required change |
|---|---|---|
| Centered illustration with two primary next actions | Existing unassigned experience previously matched closely | Re-scan fresh route; preserve if geometry matches, otherwise align illustration/action widths and support strip |

## 7. Parent — Multi-Child

| Reference element | Existing actual element | Required change |
|---|---|---|
| Multiple visual child cards with avatars and Garden association | Current page shows a visual rail, but every child uses the same image and there are duplicate names/states; rail proportions differ | Bind distinct canonical child identities and Garden labels; match card width, photo scale and selected outline |
| Selected child context updates immediately below | Current selected profile does update but main content is the assigned-dashboard composition, not the profile/dashboard shown in the reference | Keep data switching while matching the selected child header and first panel order |
| Mobile horizontal compact selector | Current Mobile shows only two cards and large whitespace around them | Match rail height, spacing and selected state; allow horizontal scroll with visible next-card affordance |

## 8. Attendance / Pickup

| Reference element | Existing actual element | Required change |
|---|---|---|
| Compact metric/filter/table operational view | Existing domain previously aligned but must be reviewed from scratch | Capture Garden and Classroom attendance; align row height, avatar size, filter placement and action controls |
| Mobile action-focused flows | Existing Mobile flows are purpose-built | Re-check arrival/departure, release and history against their specific reference panels |

## 9. Staff

| Reference element | Existing actual element | Required change |
|---|---|---|
| Avatar-led staff list, profile blocks and calendar | Existing Staff platform is close to the reference language | Verify nav order, table density, profile image scale and calendar proportions; fix any literal displacement |
| Compact Mobile list/profile/clock | Existing Mobile Staff is purpose-built | Re-capture and align header/bottom-nav/status geometry |

## 10. Candidate / Recruitment

| Reference element | Existing actual element | Required change |
|---|---|---|
| Visual recruitment hub and job/application cards | Existing recruitment domain was accepted previously but inherited status is invalid | Compare actual hub, profile, discovery and application states; restore imagery or card proportions if overlay differs |

## 11. Inspector

| Reference element | Existing actual element | Required change |
|---|---|---|
| Garden-photo portfolio and compact inspection workflow | Existing Inspector experience is close | Re-check six primary surfaces; align photo cards, status tabs, checklist rows and primary CTA anchoring |

## 12. Finance

| Reference element | Existing actual element | Required change |
|---|---|---|
| KPI/balance/chart/ledger mix with child context | Existing Finance uses approved tokens and truthful provider states | Compare structural regions; keep tuition/subscription separation and adjust only reference-critical composition |

## 13. Messaging / Notifications

| Reference element | Existing actual element | Required change |
|---|---|---|
| Compact thread list/detail and notification state | Existing surfaces require fresh evidence | Align identity, unread state, composer/attachment positions and provider readiness blocks |

## 14. Documents

| Reference element | Existing actual element | Required change |
|---|---|---|
| File-center list/preview/action composition | Existing domain previously matched but must be rescanned | Re-capture list, detail, preview and status flows; align columns, row density and Mobile primary action |

## 15. Tasks / Complaints / Corrective Actions

| Reference element | Existing actual element | Required change |
|---|---|---|
| Separate compact list/detail workflows | Existing pages use the shared work-management system | Compare each domain independently; preserve semantic separation and align status/deadline/evidence positions |

## 16. Inspections

| Reference element | Existing actual element | Required change |
|---|---|---|
| Staged checklist/evidence/findings/report flow | Existing Inspector/inspection surfaces require fresh overlay review | Match progress, checklist row density, evidence placement and sticky primary action |

## 17. Reports / Analytics

| Reference element | Existing actual element | Required change |
|---|---|---|
| Library → configuration → chart/table result → export | Existing reports use canonical filters and result data | Align panel proportions, chart/table hierarchy, tabs and Mobile report cards |

## 18. Safety / Cameras

| Reference element | Existing actual element | Required change |
|---|---|---|
| Five compact status metrics above a 3×2 camera grid | Current page has six metrics plus a large filter toolbar; the camera grid is only three cards wide then two, leaving major empty space | Use exactly the reference first-row geometry; complete a balanced 3×2 grid using canonical cameras and truthful placeholder cards |
| Bright, information-rich camera visuals | Current cards use heavily darkened generic room images with large disabled-camera icons | Use area-specific truthful static thumbnails/placeholders, lighter overlay, compact status chip and canonical metadata; retain Live-unavailable copy without dominating the image |
| Side operations/policy rail | Current page lacks the reference side action rail in the first viewport | Add role-scoped action/policy/readiness rail with canonical permissions |
| Recent-event thumbnail rail + DO status | Current lower evidence is below a large blank region | Place the event/evidence rail and readiness card directly below the camera grid |
| Mobile selected camera dominates above fold | Current Mobile shows state metrics and filters before the image | Put selected camera visual immediately below title/tabs; move metrics/filter chips beneath it |

## 19. Platform Admin

| Reference element | Existing actual element | Required change |
|---|---|---|
| Central control center plus persistent right activity rail | Current page uses a full-width 3-column dashboard and no right activity rail | Rebuild Desktop shell content as `main + activity` with the activity feed fixed in the first viewport |
| Six compact KPIs | Current KPI row is close but taller and uses different semantic grouping | Match reference height, order, icon bubbles and trend line placement |
| Two charts plus service-status table | Current middle row has large decorative mini-bar charts and a security card | Use actual chart panels at reference proportions and a compact service-health list |
| Three lower compact tables | Current page uses large full-width cards and action tiles | Add pending Gardens, open complaints and subscriptions/payments tables in one row; move canonical extra actions below |
| Mobile separate admin dashboard and domain screens | Current Mobile shows only a 2-column KPI grid above fold | Add the compact menu context and match dashboard card order/bottom nav; retain 12-area IA |

## 20. Settings / Account / Permissions

| Reference element | Existing actual element | Required change |
|---|---|---|
| Four columns: nav, profile, security/preferences, Garden/subscription | Current page has four columns, but order, relative widths and vertical groupings differ; the page leaves large empty lower space | Set literal column ratios and physical order; make each column fill the first viewport with the reference card groupings |
| Profile column has large portrait and aligned fields | Current profile uses an initial in a pale circle and a series of generic info cards | Use canonical profile photo/avatar, reference-size portrait, aligned editable fields and photo CTA row |
| Security/preferences stacked in one column | Current security and permissions are split into unrelated cards and order differs | Group password, 2FA/devices/alerts followed by language/display/date/number preferences |
| Garden/subscription/integration column | Current Garden and payment/integration groups are fragmented across multiple narrow blocks | Recreate Garden identity/photo at top, Garden rows, then subscription/payment/provider rows in the same column |
| Mobile settings index and dedicated screens | Current Mobile index has an oversized blue card header and only a subset of rows above fold | Match reference white row list, title scale, order and bottom nav; keep detail screens independent |

## 21. Global States / RTL / Accessibility

| Reference element | Existing actual element | Required change |
|---|---|---|
| Distinct loading/empty/error/denied/provider/offline states | Existing global system components exist | Fresh compare all state variants; correct geometry/copy/icon placement without collapsing semantics |
| Validation/calendar/select/toggle examples | Existing controls use the canonical system | Re-check focus, labels, mixed-direction values, target sizes and reduced motion while aligning reference proportions |

## High-priority implementation order

1. Owner Onboarding: remove system-wizard silhouette and reproduce entry/step/completion frames.
2. Owner Dashboard: lock banner, KPI row, asymmetric panels and quick-action strip.
3. Children/Classrooms/Profile/Enrollment: make human/photo identity and compact reference tables dominant.
4. Parent Assigned/Multi-Child: restore child-centered selector and three-panel dashboard/profile hierarchy.
5. Safety/Cameras: complete the 3×2 monitoring wall, side rail and event strip with truthful states.
6. Platform Admin: rebuild the control-center grid and activity rail.
7. Settings/Account/Permissions: literal four-column Desktop composition and separate Mobile ordering.
8. Secondary domains: fresh capture and overlay review; only change material mismatches.

## Pre-finish decision rule

A route remains `NEEDS_VISUAL_CORRECTION` until fresh V4 Desktop and Mobile captures show the same frame structure, banner position, block order, primary-region count, column proportions, imagery placement, density and first-viewport silhouette as the approved reference. Automated checks, token use and brand colors do not change that status.

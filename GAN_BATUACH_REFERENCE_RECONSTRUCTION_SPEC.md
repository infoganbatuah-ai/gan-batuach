# Gan Batuach Reference Reconstruction Specification

## Control data

- Task: `UX-REFERENCE-RECONSTRUCTION-FINAL`
- Source Development SHA: `25a3042d4af8a07b542ddfd376ef27b12599052e`
- Branch: `codex/ux-reference-reconstruction-final`
- Reference inspection: original PNG resolution, `1536 × 1024` for every approved board; brand mark `1080 × 1350`
- Desktop verification viewport: `1440 × 1024`
- Mobile verification viewport: `390 × 844`
- Reading direction: RTL-first; mixed-direction values remain isolated and readable
- Geometry values below are measured visual approximations from the approved composite boards. Their purpose is to preserve the first-viewport silhouette, relative proportions, and information hierarchy.

## Full reference inventory

1. `GAN_BATUACH_BRAND_MARK.png`
2. `GB_UX_REF_AUTH_MASTER.png`
3. `GB_UX_REF_OWNER_ONBOARDING.png`
4. `GB_UX_REF_OWNER_CORE.png`
5. `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png`
6. `GB_UX_REF_PARENT_FULL_PLATFORM.png`
7. `GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png`
8. `GB_UX_REF_STAFF_FULL_PLATFORM.png`
9. `GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png`
10. `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png`
11. `GB_UX_REF_FINANCE_FULL_PLATFORM.png`
12. `GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png`
13. `GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png`
14. `GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png`
15. `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png`
16. `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png`
17. `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`
18. `GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png`
19. `GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png`

The available approved set has no standalone Messaging/Notifications or Inspections overview board. For those domains, the product-wide board establishes shell and mobile language; `GB_UX_REF_OWNER_CORE.png`, `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`, `GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png`, and `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png` provide the closest exact domain compositions.

## Shared reconstruction constants

- **Desktop shell:** navy sidebar on the left, generally `8–11%` of viewport width; white top utility bar `5–7%` of viewport height; content begins immediately beside the sidebar with `12–18px` visual gaps.
- **Content canvas:** pale blue-white background, `12–20px` page padding, compact borders, restrained shadows, and `10–16px` radii.
- **Top bar:** search at the left side of the main canvas, notification/message actions near the user identity, avatar and current role/Garden at the right.
- **Typography:** major page title approximately `26–34px`, section title `18–24px`, metrics `22–34px`, body `14–16px`, compact labels `12–14px`.
- **Cards:** reference-specific proportions take priority over generic shared-card equality. Imagery cards, lists, tables, rails, charts, and settings rows keep their distinct structures.
- **Mobile shell:** independent composition; compact brand top bar, page title/context beneath it, bottom navigation fixed to safe area, minimum `44px` targets, `12–16px` side padding, and no horizontal page overflow.

## 1. Auth / Registration

**REFERENCE FILE:** `GB_UX_REF_AUTH_MASTER.png`

**DESKTOP FRAME:** no product sidebar; four equal showcase panels on the board. Actual auth screen uses a `44/56` visual/form split, full-height rounded container, `24–32px` internal margins, and centered form width near `420px`.

**BANNER:** exists as the full-height left visual panel. Deep royal/navy gradient, large child image occupying the lower `65%`, brand above, headline centered-left, three benefit icons near the lower third.

**GRID:** two columns; visual panel dominant in emotion, form panel dominant in interaction. Registration/verification remains a centered single-column card.

**CARDS:** role cards use a `2 × 2` colored grid plus a full-width Admin row; input rows are compact; verification has a focused illustration, primary CTA, secondary resend action.

**NAVIGATION:** language and login controls at the top; back arrow follows RTL direction; no app navigation.

**TYPOGRAPHY:** bold welcome heading, prominent role question, `18–20px` form title, restrained secondary text.

**DENSITY:** medium; the visual panel fills blank space with imagery rather than empty white canvas.

**DISTINCTIVE ELEMENTS:** child portrait, heart brand mark, role-color cards, email envelope illustration, success confetti.

**MOBILE:** full-screen visual opening, followed by role list, compact fields, verification and success screens. Brand is centered, CTA near the lower safe area, no Desktop split retained.

## 2. Owner Onboarding

**REFERENCE FILE:** `GB_UX_REF_OWNER_ONBOARDING.png`

**DESKTOP FRAME:** sidebar approximately `9%`; main canvas `91%`; utility bar `6%` height. Step rail occupies `22–25%` of main width; active form `52–58%`; remaining area is intentional visual breathing room or summary.

**BANNER:** welcome screen contains a right-side child image occupying about `45%` of main card and a brand/message area on the left. In-step pages replace it with a narrow step identity header, not a generic hero.

**GRID:** welcome `55/45` copy/image split; step pages `24/76` rail/content; completion page `24/76` checklist/summary.

**CARDS:** Garden image card above compact form rows; classroom capacity rows; document requirement rows; invitation card; completion icon row.

**NAVIGATION:** vertical step rail on Desktop, dot progress rail on Mobile; top utility identity remains compact.

**TYPOGRAPHY:** onboarding title `28–32px`, step title `24–28px`, form labels `13–14px`, summary headline `30px`.

**DENSITY:** medium-compact; fields remain visible together without a large uninterrupted form block.

**DISTINCTIVE ELEMENTS:** child/brand welcome art, Garden photograph, numbered capacities, document icons, confetti completion.

**MOBILE:** eight purpose-built screens; dot progress below top bar, one card group per viewport, sticky primary CTA, imagery in welcome/Garden/completion, compact summary list.

## 3. Owner Dashboard

**REFERENCE FILE:** `GB_UX_REF_OWNER_CORE.png`

**DESKTOP FRAME:** sidebar `10%`, main `90%`; top bar `6%`; banner `15%`; metric row `9%`; three-column operational row `34–38%`; quick-action rail `10%`.

**BANNER:** mandatory directly below top bar. Child photo centered-right, weather/date at left, Garden selector above title, title/subtitle left-center, handwritten brand phrase over the image.

**GRID:** six unequal metrics in one row; below, three columns approximately `31/36/33` for schedule, camera/visual, activity; quick actions span full width.

**CARDS:** compact metric tiles with colored icon circles; schedule list; large image/video card with thumbnail rail; activity list with avatars/status; colored quick-action tiles.

**NAVIGATION:** navy sidebar with active Home row; compact top search, notification/message buttons, avatar and role; Garden footer selector.

**TYPOGRAPHY:** greeting `32px`, banner subtitle `18px`, metrics `22–28px`, panel titles `18–20px`, rows `13–15px`.

**DENSITY:** compact and information-rich; first viewport contains banner, metrics, three operational panels, and quick actions.

**DISTINCTIVE ELEMENTS:** photographic banner, child hand-heart imagery, colored metrics, camera thumbnail rail, avatar activity list.

**MOBILE:** brand top bar, Garden selector, greeting, four compact KPIs, photographic banner, activity list, `2 × 4` quick-action grid, bottom navigation with central brand action.

## 4. Children / Classrooms / Child Profile / Enrollment

**REFERENCE FILE:** `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png`

**DESKTOP FRAME:** sidebar `20%` within each framed composition; main `80%`; compact utility header `9%`; content card fills the remaining height.

**BANNER:** no marketing banner. Identity header is the visual anchor: child portrait and metadata for profile, photo rail for classrooms.

**GRID:** children list is a dense table; child profile uses header plus `2 × 2` content grid; classrooms use four image cards then a child table; enrollment uses tabs plus a request table.

**CARDS:** avatar rows, status chips, classroom image/capacity cards, guardian cards, weekly attendance dots, document rows, request rows.

**NAVIGATION:** shared navy shell; active Children or Classrooms item; profile tabs under the identity header.

**TYPOGRAPHY:** page/title `28–32px`, child name `30px`, card titles `18px`, compact table `13–14px`.

**DENSITY:** compact; human identity and images prevent CRM-style abstraction.

**DISTINCTIVE ELEMENTS:** circular child portraits, classroom photographs, occupancy bars, guardian avatars, attendance week dots.

**MOBILE:** child list with avatar/status/time rows; profile opens with a large portrait and name; tabs become compact icon actions; classrooms become stacked image cards with avatar rails; enrollment is a card list.

## 5. Parent — Assigned

**REFERENCE FILE:** `GB_UX_REF_PARENT_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar `10%`, main `90%`; top bar `7%`; parent dashboard content uses a greeting/context row, a three-column middle row, and four equal quick-status cards below.

**BANNER:** dashboard uses a contextual camera/Garden image panel rather than a full-width marketing hero. Child profile uses a strong portrait identity header.

**GRID:** middle row approximately `30/35/35` for attendance, camera, messages; lower row four compact domain cards. Child profile uses portrait/header, tabs, and a three-column status grid.

**CARDS:** child switch cards, attendance rows, image card, message list, payment/document/event/contact cards.

**NAVIGATION:** navy Parent sidebar, compact top search/notifications/avatar, bottom nav on Mobile.

**TYPOGRAPHY:** greeting `28–32px`, child name `28px`, card headings `17–20px`, status values prominent.

**DENSITY:** medium-compact and child-centered.

**DISTINCTIVE ELEMENTS:** child imagery, child avatar selector, Garden camera/photo, contextual status cards.

**MOBILE:** greeting then visible child rail, dashboard activity, child profile with large portrait and icon rail, attendance/calendar, media card, documents and payments as compact lists.

## 6. Parent — Unassigned

**REFERENCE FILE:** `GB_UX_REF_PARENT_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar about `14%`, broad empty-state canvas `86%`, utility top bar, centered illustration and actions.

**BANNER:** no hero; large circular people illustration anchors the state.

**GRID:** single centered column with two horizontal primary actions and one support/help row below.

**CARDS:** actions are outlined blue tiles; help is a pale full-width row.

**NAVIGATION:** Parent shell remains visible with limited applicable items.

**TYPOGRAPHY:** empty-state title `28–32px`, concise explanatory text, clear action labels.

**DENSITY:** spacious by intent, with a focused next step rather than dashboard fragments.

**DISTINCTIVE ELEMENTS:** relationship illustration and two clear assignment/enrollment paths.

**MOBILE:** same state becomes a focused single-column screen with large icon, one action per row, safe bottom navigation.

## 7. Parent — Multi-Child

**REFERENCE FILE:** `GB_UX_REF_PARENT_FULL_PLATFORM.png`

**DESKTOP FRAME:** same Parent shell; the top content rail gives visible child cards before the selected child dashboard.

**BANNER:** selected child identity acts as context banner; no generic page hero.

**GRID:** horizontal child selector above the assigned-parent grid; selected child content keeps the `30/35/35` dashboard relationship.

**CARDS:** child cards contain avatar, name, Garden, active/unassigned state and selection border.

**NAVIGATION:** shell remains stable while selected-child data changes.

**TYPOGRAPHY:** child names visually dominant in selector; Garden/status secondary.

**DENSITY:** compact selector plus rich selected context.

**DISTINCTIVE ELEMENTS:** visible multi-child avatars and selected state; Garden association is always shown.

**MOBILE:** horizontally scrollable child rail/cards below the greeting; selected context immediately updates the first visible content card.

## 8. Attendance / Pickup

**REFERENCE FILE:** `GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png`

**DESKTOP FRAME:** sidebar `20%` in framed screens; main `80%`; metrics and rapid-action rail consume the upper `28%`; dense operational table fills the rest.

**BANNER:** no hero. Date/context row and compact metrics form the operational header.

**GRID:** five metrics, four rapid actions, filter tabs, dense table. Child detail uses two upper cards plus full-width history. Event review uses a media/list composition.

**CARDS:** metric cards, table rows with avatars/status/actions, authorized-pickup cards, event video rows.

**NAVIGATION:** attendance active in navy shell; date selector and global search remain at top.

**TYPOGRAPHY:** page title `30px`, metrics `24–28px`, table `13–14px`, action labels `14px`.

**DENSITY:** compact operational.

**DISTINCTIVE ELEMENTS:** avatar table, QR scan, arrival/departure status, pickup authorization, video evidence cards.

**MOBILE:** compact KPIs, segmented filters, avatar list; QR is full-screen; departure confirmation centers child and authorized pickup; history and pickup lists use purpose-built cards.

## 9. Staff Full Platform

**REFERENCE FILE:** `GB_UX_REF_STAFF_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar `8–10%`; main `90%`; list/table surfaces dominate. Profile uses a large identity header and three-column summary; schedule uses calendar plus staff filter rail.

**BANNER:** no marketing hero; staff portrait/profile header is the identity banner.

**GRID:** staff list table; profile `3` summary cards; schedule `75/25`; attendance/documents use dense tables.

**CARDS:** avatar rows, role/status chips, credential summary, document status rows, candidate rows.

**NAVIGATION:** navy Staff/Manager shell with active domain; search, calendar, notification and avatar utilities.

**TYPOGRAPHY:** titles `28–32px`, profile name `30px`, table body `13–14px`, status compact.

**DENSITY:** compact and work-oriented.

**DISTINCTIVE ELEMENTS:** staff portraits, calendar, clock-in/out time, document validity.

**MOBILE:** navy brand top bar, avatar lists, centered clock state with strong CTA, schedule rows, document list, settings list, bottom nav.

## 10. Candidate / Recruitment

**REFERENCE FILE:** `GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png`

**DESKTOP FRAME:** six adjacent role-flow panels; canonical screen uses sidebar near `18%`, main `82%`. Recruitment hub hero consumes roughly `24%` of main height.

**BANNER:** mandatory photographic recruitment banner with staff/children imagery and overlaid title.

**GRID:** four KPIs in a row, primary CTA, recent jobs list. Candidate profile is portrait header plus tabs and attribute list. Scheduling is a compact form.

**CARDS:** KPI cards, job rows, candidate rows with avatar/status, offer success card.

**NAVIGATION:** recruitment active in navy shell; Mobile uses bottom navigation and compact utilities.

**TYPOGRAPHY:** recruitment title `28px`, candidate name `28px`, CTA strong and full-width where shown.

**DENSITY:** medium-compact.

**DISTINCTIVE ELEMENTS:** photographic banner, candidate portraits, step indicator, celebration success.

**MOBILE:** banner retained at top of hub, `2 × 2` KPIs, stacked job/candidate cards, large portrait profile, compact interview form and success screen.

## 11. Inspector

**REFERENCE FILE:** `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar around `23%` in each narrow framed view; inspector dashboard uses portrait greeting, four KPIs, upcoming inspection list and urgent task card.

**BANNER:** portrait greeting banner at dashboard top; Garden photos anchor portfolio/detail states.

**GRID:** dashboard KPI row plus lists; Garden portfolio stack; inspection detail metadata plus checklist; findings/corrective actions as rich card lists; reports as action tiles plus file list.

**CARDS:** Garden photo rows, checklist progress, evidence thumbnails, severity-bordered findings, corrective status rows.

**NAVIGATION:** dedicated navy Inspector shell; Mobile bottom nav emphasizes Gardens/Inspections.

**TYPOGRAPHY:** greeting `28px`, section `20px`, card title `16px`, metadata `13px`.

**DENSITY:** medium-compact.

**DISTINCTIVE ELEMENTS:** inspector portrait, Garden imagery, severity cards, evidence thumbnails.

**MOBILE:** portrait greeting and KPIs, Garden image list, inspection checklist, findings/action cards, report tiles; bottom nav remains visible.

## 12. Finance

**REFERENCE FILE:** `GB_UX_REF_FINANCE_FULL_PLATFORM.png`

**DESKTOP FRAME:** narrow workflow panels in reference; actual finance dashboard uses sidebar `18%`, main `82%`, `2 × 2` KPI block above line chart.

**BANNER:** no hero; avatar/greeting and month selector form header.

**GRID:** payments/invoices/expenses use filter strip plus vertical dense list; budget uses donut and category progress; reports use stacked action tiles.

**CARDS:** colored financial KPIs, avatar payment rows, invoice/expense rows, chart and report tiles.

**NAVIGATION:** navy Finance shell with distinct payments/invoices/budget/report items.

**TYPOGRAPHY:** currency metrics `24–30px`, titles `24–28px`, rows `14px`; numbers use LTR isolation.

**DENSITY:** compact.

**DISTINCTIVE ELEMENTS:** currency KPIs, trend chart, donut, invoice identifiers, payment status chips.

**MOBILE:** `2 × 2` KPIs, compact list rows, segmented invoice tabs, donut budget, report tiles and bottom nav.

## 13. Messaging / Notifications

**REFERENCE FILE:** `GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png` with notification hierarchy from `GB_UX_REF_OWNER_CORE.png` and settings/preferences from `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`

**DESKTOP FRAME:** shared role shell; thread list approximately `34%`, active conversation `66%`; notifications use compact avatar/icon rows.

**BANNER:** absent. Identity/context header replaces hero.

**GRID:** two-column thread workspace; notification center uses filter strip and dense list; broadcasts use audience/settings panel plus preview.

**CARDS:** message rows, attachment cards, notification rows, provider-readiness settings rows.

**NAVIGATION:** Messages/Notifications active in role shell; top utilities remain consistent.

**TYPOGRAPHY:** conversation title `22–26px`, row names `15–16px`, timestamps `12–13px`.

**DENSITY:** compact.

**DISTINCTIVE ELEMENTS:** avatars, unread dots, message bubbles, attachment thumbnails, category icons.

**MOBILE:** list-first flow, full-screen thread detail, composer fixed above safe area, notification filter chips, preferences rows and quiet-hours screen.

## 14. Documents

**REFERENCE FILE:** `GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar `6%` on the full board composition; canonical page uses sidebar `10%`, main `90%`. Document center is a two-level list; preview and sharing use split workspaces.

**BANNER:** absent.

**GRID:** document list with folders/files; preview `70/30` document/actions; sharing link/settings plus user list; categories and actions are stacked tiles.

**CARDS:** folder rows, typed file rows, full-page preview, user permission rows, colored category tiles.

**NAVIGATION:** navy shell with Documents active.

**TYPOGRAPHY:** file names `15–17px`, metadata `12–13px`, page title `26–30px`.

**DENSITY:** compact.

**DISTINCTIVE ELEMENTS:** file-type colors, large PDF preview, sharing link, permissions, floating add button.

**MOBILE:** folders/files stack, preview fills viewport, sharing and operations become separate screens, bottom nav persists.

## 15. Tasks / Complaints / Corrective Actions

**REFERENCE FILE:** `GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png`

**DESKTOP FRAME:** sidebar `6%` in composite; canonical screen uses sidebar `10%`, main `90%`. Lists and detail panels keep a dense vertical rhythm.

**BANNER:** absent.

**GRID:** tasks list, task detail tabs, complaint list/detail, corrective list, analytics KPI `2 × 2` plus donut.

**CARDS:** avatar task rows, evidence image, severity complaint cards, corrective status rows, analytics tiles.

**NAVIGATION:** separate domain entries remain distinct in navy shell.

**TYPOGRAPHY:** titles `26–30px`, severity/status `12–14px`, detail body `14–16px`.

**DENSITY:** compact.

**DISTINCTIVE ELEMENTS:** severity color, checklists, evidence thumbnail, deadline/status chips, donut summary.

**MOBILE:** segmented filters, stacked cards, floating add action, sticky update CTA, dedicated analysis view.

## 16. Inspections

**REFERENCE FILE:** `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png`

**DESKTOP FRAME:** Inspector shell with metadata header and content occupying full main width.

**BANNER:** Garden image/identity strip at top of inspection detail.

**GRID:** metadata rows, tab strip, checklist list; findings/evidence/corrective panels follow as separate dense lists.

**CARDS:** checklist progress rows, severity findings, evidence thumbnails, report file rows.

**NAVIGATION:** inspection active in Inspector shell; owner remediation reuses Owner shell without changing content hierarchy.

**TYPOGRAPHY:** inspection title `26px`, Garden name `20px`, checklist labels `14–16px`.

**DENSITY:** compact.

**DISTINCTIVE ELEMENTS:** Garden photo, checklist completion fractions, evidence, immutable submitted status.

**MOBILE:** Garden identity card, metadata icons, tab rail, checklist and sticky continue/submit action.

## 17. Reports / Analytics

**REFERENCE FILE:** `GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar `6%` in composite; report catalog `20%`, configuration `20%`, results `31%`, export/share `23%` when shown together. Canonical individual pages keep those same internal proportions.

**BANNER:** absent.

**GRID:** colored report catalog; configuration form; four KPI row, chart, table; export format rail and delivery settings.

**CARDS:** report rows with category icons, metric tiles, chart, dense table, export buttons.

**NAVIGATION:** Reports active in navy shell.

**TYPOGRAPHY:** result title `24–28px`, metrics `24px`, table `13px`.

**DENSITY:** compact analytical.

**DISTINCTIVE ELEMENTS:** category colors, date-range controls, combined line/bar chart, export format tiles.

**MOBILE:** report list, configuration screen, KPI/chart summary, group breakdown, export and scheduled report screens, bottom nav.

## 18. Safety / Cameras

**REFERENCE FILE:** `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar `7%`, main `93%`; top bar `6%`; camera page header/tabs `12%`; KPI row `10%`; camera grid `45%`; event rail and readiness card `18%`.

**BANNER:** Owner dashboard retains photographic child banner. Camera page uses a strong monitoring header and tab rail rather than a marketing hero.

**GRID:** six-camera `3 × 2` image grid in dominant center; narrow action rail on the right; event thumbnail rail below; readiness status card lower-right.

**CARDS:** image-first camera cards with overlays; status KPI cards; activity actions; event thumbnails; provider/readiness card.

**NAVIGATION:** navy shell with Safety/Cameras active; top search/utilities consistent.

**TYPOGRAPHY:** page title `26–30px`, metrics `22px`, camera labels `14px`, status overlays `12px`.

**DENSITY:** rich and compact.

**DISTINCTIVE ELEMENTS:** camera thumbnails/placeholders, status overlays, selected camera, incident/evidence rail, truthful Live-unavailable treatment.

**MOBILE:** image-first camera cards, selected camera detail, overlay controls only where capability is real, event/evidence lists, setup/readiness screens and bottom nav.

## 19. Platform Admin

**REFERENCE FILE:** `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png`

**DESKTOP FRAME:** sidebar `10%`, main dashboard `70%`, recent-activity rail `20%`; top KPI row `13%`; chart/status row `38%`; three lower operational tables `27%`.

**BANNER:** absent; dashboard title and subtitle remain compact above KPIs.

**GRID:** six KPIs; three panels approximately `31/31/38`; three lower tables `36/33/31`; separate right activity rail.

**CARDS:** colored KPI icons, line/bar charts, service-status list, Garden approval table, complaints table, subscriptions table, activity rows.

**NAVIGATION:** full-height navy Admin sidebar with clear active row and user footer.

**TYPOGRAPHY:** dashboard title `26–30px`, KPIs `24–28px`, charts/tables `13–15px`.

**DENSITY:** compact control center.

**DISTINCTIVE ELEMENTS:** asymmetric dashboard, activity rail, system health, approval/subscription tables.

**MOBILE:** Admin menu/list home, stacked KPI cards, Garden/user/complaint lists, full-screen system status, settings list, bottom nav.

## 20. Settings / Account / Permissions

**REFERENCE FILE:** `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`

**DESKTOP FRAME:** shell sidebar `10%`; content `90%`; utility top bar `7%`. Four content columns inside main area approximately `17/27/24/32` with `10–12px` gaps.

**BANNER:** absent. The page starts directly with compact settings columns beneath the utility bar.

**GRID:** column 1 settings navigation; column 2 profile/account; column 3 security above preferences; column 4 Garden above subscription/billing/integration.

**CARDS:** navigation rows, avatar/profile form, security toggle rows, preference rows, Garden identity/image, subscription and billing rows.

**NAVIGATION:** navy product sidebar plus local settings navigation column.

**TYPOGRAPHY:** column titles `20–23px`, row titles `14–16px`, helper text `12–13px`, profile labels compact.

**DENSITY:** compact but readable; first viewport shows all four areas.

**DISTINCTIVE ELEMENTS:** multi-column composition, portrait avatar, Garden image, toggles, subscription crown/card.

**MOBILE:** settings index is a compact row list; profile, security, Garden, billing, notifications and appearance each become a dedicated screen with bottom navigation.

## 21. Global States / RTL / Accessibility

**REFERENCE FILE:** `GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png`

**DESKTOP FRAME:** sidebar `7%`; state examples occupy equal vertical cards in the first row and mixed component cards in the second row.

**BANNER:** absent.

**GRID:** five primary state cards; below, success, validation, calendar, selection, toggles and accessibility panels.

**CARDS:** each state has one large semantic illustration, title, short explanation and appropriately weighted action. Validation and control examples remain compact.

**NAVIGATION:** state pages inherit the current role shell where appropriate; isolated Mobile state screens use a simple top bar and bottom nav.

**TYPOGRAPHY:** state title `20–24px`, message `14–16px`, CTA `14–16px`; status never depends on color alone.

**DENSITY:** focused state cards; component demonstrations compact.

**DISTINCTIVE ELEMENTS:** semantic icons, skeletons, validation messages, calendar, select, toggles, accessibility checklist.

**MOBILE:** one state per screen, large icon, centered message, full-width CTA near lower content area, stable bottom nav and RTL back direction.

## Per-screen reconstruction gate

Every captured screen must answer YES to all of the following before receiving `REFERENCE_MATCH_CANDIDATE`:

1. Sidebar position and proportion match.
2. Top bar structure matches.
3. Banner/identity header appears in the same location.
4. Banner/identity header has comparable relative size.
5. Major sections follow the same order.
6. Columns have comparable proportions.
7. Cards occupy the same visual areas.
8. Major card sizes are comparable.
9. Visual density is comparable.
10. Imagery appears in the same structural places.
11. Dominant hierarchy matches.
12. First viewport silhouette matches.
13. Mobile is independently matched.
14. Additional canonical functionality is integrated without changing the reference composition.

## Reconstruction order

For each screen: silhouette → sidebar → top bar → banner/identity → main grid → section order → column ratios → block ratios → imagery → density → typography → controls → spacing → radii → borders → shadows → colors → micro-details.

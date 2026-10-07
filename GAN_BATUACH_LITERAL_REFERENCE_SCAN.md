# Gan Batuach literal reference scan

**Task:** UX-LITERAL-REFERENCE-RECONSTRUCTION
**Scan date:** 2026-10-07
**Source Development SHA:** `ae283890239caa2b75fb9ab2a8a8f193c8919296`
**Capture targets:** Desktop `1440 × 1024`; Mobile `390 × 844`
**Status vocabulary:** `REFERENCE_MATCH_CANDIDATE`, `NEEDS_VISUAL_CORRECTION`, `BROKEN`

This record was created before implementation. Every approved image was inspected at original resolution. Percentages below describe the visible application frame in the approved board, not the surrounding presentation canvas. Dynamic names and counts may differ; geometry, hierarchy, density, and imagery placement are binding.

## Reference inventory

All UX boards are `1536 × 1024` (`3:2`). The official brand mark is `1080 × 1350`.

| Reference file | Domains represented | Density | Distinctive composition |
|---|---|---|---|
| `GAN_BATUACH_BRAND_MARK.png` | Global brand | Spacious | Blue heart/guardian mark; transparent use on light surfaces and white treatment on navy surfaces |
| `GB_UX_REF_AUTH_MASTER.png` | Auth / Registration | Medium | Image-led split login, role cards, registration forms, verification state, independent Mobile screens |
| `GB_UX_REF_OWNER_ONBOARDING.png` | Owner Onboarding | Medium/compact | Eight-step Mobile sequence; Desktop entry, working step, and completion; navy rail, photographic context, centered task area |
| `GB_UX_REF_OWNER_CORE.png` | Owner Dashboard | Compact | Navy sidebar, top utility bar, photographic banner, six KPIs, three asymmetric operational panels, quick-action strip |
| `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png` | Children / Classrooms / Child Profile / Enrollment | Compact | Avatar-led lists, large profile identity, photo classrooms, capacity bars, compact enrollment table |
| `GB_UX_REF_PARENT_FULL_PLATFORM.png` | Parent Assigned / Unassigned / Multi-Child | Medium/compact | Child-centric shell, visual child selector, camera imagery, compact information cards, dedicated Mobile flows |
| `GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png` | Attendance / Pickup | Compact | Dense operational table, state metrics, camera-backed release context, dedicated Mobile action flows |
| `GB_UX_REF_STAFF_FULL_PLATFORM.png` | Staff | Compact | Staff list/profile/calendar/time records in one coherent role shell; avatar-rich Mobile lists |
| `GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png` | Candidate / Recruitment | Medium | Recruitment visual context, opportunity and application cards, profile completeness, invitation states |
| `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png` | Inspector | Compact | Garden photo portfolio, checklist, findings, corrective actions and reports, six purpose-built Mobile screens |
| `GB_UX_REF_FINANCE_FULL_PLATFORM.png` | Finance | Compact | Ledger metrics, balances, chart/list mix, child context, provider truth states |
| `GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png` | Documents | Compact | File list, preview, sharing, categories and actions; document-state chips and dedicated Mobile flows |
| `GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png` | Tasks / Complaints / Corrective Actions | Compact | Separate work-management domains with lists, detail, deadlines, evidence, analytics |
| `GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png` | Reports / Analytics | Compact | Report library, filters, chart/table result, export surfaces and Mobile report flows |
| `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png` | Safety / Cameras | Compact | Monitoring wall, 3×2 camera grid, status overlay, side actions, event rail, selected-camera Mobile flow |
| `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png` | Platform Admin | Compact | Control center with 6 KPIs, chart/status row, activity rail, three lower tables, separate Mobile IA |
| `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png` | Settings / Account / Permissions | Compact | Four-column Desktop settings workspace; row-based Mobile settings screens |
| `GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png` | Global states / RTL / Accessibility | Medium | Canonical system states, validation, date/select/toggle patterns and Mobile variants |
| `GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png` | Cross-product coherence | Mixed | Role-shell, typography, card hierarchy and Desktop/Mobile coherence overview |

## Shared desktop frame

- Physical left navy sidebar where the domain reference shows a shell: approximately **10–14%** of the application width. It spans the viewport, contains a centered white brand mark at the top, compact navigation rows, a bright-blue active row, and a user/context footer.
- Main workspace: approximately **86–90%**. It uses a pale blue page field, white or near-white cards, thin blue-grey borders, and restrained shadows.
- Top utility bar: approximately **6–8%** of viewport height. Search sits toward the physical left of the workspace; user/avatar, alerts, and context actions sit toward the physical right.
- Page padding is compact: approximately **1.0–1.5%** of workspace width. Typical card gaps are **8–14 px** at the 1440 target.
- Primary card radius is visually **8–14 px**. Major photo panels are similarly rounded and clipped.
- Typography is Hebrew-first, dark navy, with page titles around 26–34 px equivalent, section titles 17–22 px, compact body/list content 12–15 px, and metrics 24–36 px.
- Status is communicated through text plus icon and color. Common tones are green/active, blue/in-progress, amber/action, red/failure, grey/unavailable.

## Shared mobile frame

- Dedicated narrow composition; no desktop grid is merely scaled down.
- Navy/white branded top bar with logo, alerts and context. Content begins immediately below it.
- Fixed bottom navigation with four or five items, icon plus text, and an unmistakable active state.
- Cards become vertically ordered blocks or horizontal rails. Primary touch targets are at least 44 px.
- Above the fold prioritizes identity, selected context, current status, and one primary action.
- Page padding is approximately 12–16 px; gaps are commonly 8–12 px; text remains readable without compressed Desktop columns.

## High-priority decomposition

### `GB_UX_REF_OWNER_ONBOARDING.png`

**Desktop frame**

- Three Desktop examples occupy the lower portion of the board. Each uses a navy rail of roughly 10–12%, a white main workspace, and a small utility header.
- Entry screen: a split visual composition. The copy/logo/benefits/CTA occupy roughly 48–52%; a child photograph occupies roughly 48–52%. The image is a dominant panel, not a small card.
- Working step: the rail includes the step list; the task pane occupies roughly 72–78%; the form itself is centered and compact, with a contextual Garden image above the Garden fields.
- Completion: step rail on the left; large centered mark and success copy; a horizontal row of five summary tiles; primary and secondary actions below.

**Banner / visual context**

- Entry includes a large photographic visual rather than a shallow banner.
- Working steps use contextual imagery only where the step needs it, especially Garden identity.
- The completion visual is the official brand mark with modest confetti, not a generic success illustration.

**Grid and blocks**

- Entry: two columns, approximately `1fr / 1fr`.
- Working step: navigation rail plus one main content column; fields use a two-column form only where pairs are naturally related.
- Completion: centered vertical flow with one five-item horizontal summary row.

**Mobile**

- Eight distinct screens show the literal sequence: welcome, role, account, Garden, classrooms, documents, staff, success.
- Dot/line progress is near the top on steps 2–7. The primary CTA sits at the lower edge of the usable content.
- Cards are full-width; photo and brand identity are large; no Desktop rail appears.

### `GB_UX_REF_OWNER_CORE.png`

**Desktop frame**

- Sidebar is about 11–12%; workspace about 88–89%; utility header about 6% of height.
- Banner sits immediately below the utility bar and is approximately 18–22% of the visible content height. Welcome/weather/context are on the left side of the banner; child imagery dominates the middle/right.
- Six compact metrics form a single row below the banner, each roughly equal width and about 8–10% of viewport height.
- The next row is asymmetric: daily schedule about 30%, camera/media about 34%, activity about 36%.
- A seven-item quick-action strip spans the width under the operational row.

**Major blocks**

- Banner/identity, KPI row, schedule, camera media, activity, quick actions are the complete first-viewport silhouette.
- Lower examples show camera grid, selected camera, Children list, and Child profile as domain continuations.

**Imagery**

- One child photograph in the banner; camera/Garden thumbnails in the central operational card; human avatars in activity.

**Mobile**

- Compact header, greeting and Garden selector, four KPIs in one row, photo banner, activity list, then a 2×4 action grid and bottom nav.

### `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png`

**Children list**

- Sidebar about 20% inside each half-board Desktop viewport; main list about 80%.
- Search/top user area precedes the title. The list is table-like and compact, but every row begins with a visible child avatar and identity.
- Status, class, age, attendance time and row actions align consistently.

**Child profile**

- Large circular profile photo and identity header at the top; action button and status near the identity.
- Horizontal tabs below the header.
- Main content uses three card columns: contact/guardians, core data, documents/attendance depending on selected tab.

**Classrooms**

- Four photo cards in one row. Each includes room imagery, age group, capacity/progress, and child/avatar context.
- A compact children list follows below rather than replacing the visual cards.

**Enrollment**

- Status tabs across the top and a compact avatar-led list/table below.

**Mobile**

- Navy header and bottom navigation. Child list remains avatar-led. Child profile starts with a large circular photo. Classroom cards stack vertically with full-width imagery. Enrollment uses compact request cards.

### `GB_UX_REF_PARENT_FULL_PLATFORM.png`

**Assigned dashboard**

- Sidebar about 15–17%; workspace about 83–85%.
- Greeting/date occupy the top. A visible child selector with avatar cards sits above the dashboard panels.
- Three primary panels: daily attendance/status, camera/Garden image, recent notifications/messages. Four compact summary/action cards sit below.

**Child profile**

- Large photo/identity header, tabs, and three primary cards for attendance, Garden camera, and Garden/guardian identity. Lower cards cover documents, payments and communication.

**Multi-child selector**

- Multiple visible children with circular avatars, names, Garden association and selected state. A generic select is supplemental only.

**Unassigned state**

- Intentional centered empty state with illustration, concise explanation, two concrete actions and support path.

**Mobile**

- Child cards/avatars remain visible near the top. The selected child drives the content immediately below. Bottom navigation is role-specific.

### `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png`

**Desktop monitoring frame**

- Sidebar about 11–12%; utility header about 6%; page title/tabs and 5 status metrics above the cameras.
- Camera area occupies roughly 70–75% of the content width. It is a 3×2 grid of landscape cards with approximately 16:9 visual areas.
- An action/policy rail occupies roughly 20–25% on the side.
- A horizontal recent-events thumbnail rail and Digital Observer readiness/status card sit below.

**Camera cards**

- Image or truthful visual placeholder fills the upper majority; status overlay is anchored on the image; camera/area name and update metadata are below.
- Offline, degraded, setup-required, permission and Live-unavailable states keep the same card geometry.

**Mobile**

- Selected camera image is dominant above the fold, with overlay, status and controls. Camera list/rail and navigation follow.

### `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png`

**Desktop frame**

- Navy sidebar about 10%; central control center about 72–74%; activity rail about 16–18%.
- Six compact KPIs in one row.
- Middle row: growth chart about 32%, user activity chart about 36%, service status about 32%.
- Activity rail remains visible alongside the primary content.
- Lower row contains three compact tables: pending Gardens, open complaints, subscriptions/payments.

**Navigation**

- High-contrast white icons/text, compact rows, bright-blue active dashboard item, admin user anchored at the bottom.

**Mobile**

- A separate admin menu screen and purpose-built dashboard/gardens/users/complaints/status/settings screens. KPI cards stack as large readable rows/cards and retain bottom navigation.

### `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`

**Desktop frame**

- Navy sidebar about 9–10%; settings workspace about 90%.
- Four columns, from physical left after sidebar: settings navigation ~17%, profile/account ~27%, security/preferences ~23%, Garden/subscription/integration ~27%, with compact gaps.
- No full-width hero. The top utility area is shallow and quiet.

**Cards and controls**

- Navigation is a single compact card with icon rows.
- Profile column includes large portrait, aligned fields and photo actions.
- Security/preferences uses stacked row cards and toggles.
- Garden/subscription uses Garden photo/identity, compact rows and provider/subscription states.

**Mobile**

- Settings index plus dedicated profile, security, Garden, payment, notification and language screens. Rows are compact; bottom nav persists.

## Secondary-domain decomposition

### Auth / Registration

- Desktop login is a roughly 45/55 visual/form split with a tall child photograph and branded navy visual panel; role selection is card-based; registration remains compact and centered.
- Mobile preserves the same branded identity with a single focused form and no desktop sidebar.

### Parent Unassigned

- Desktop retains the Parent shell and places the intentional empty state centrally in the workspace. Illustration, explanation, enrollment/link actions and help are visible above the fold.
- Mobile uses the same hierarchy as a single-column page.

### Attendance / Pickup

- Desktop prioritizes compact operational metrics, filters and an avatar-led table. Release detail uses photo/evidence context and clear authorization states.
- Mobile prioritizes arrival/departure action, authorized pickup identity and confirmation history.

### Staff

- Desktop uses list/profile/calendar/time views inside a narrow navy role shell. Human identity is persistent through avatars and compact status chips.
- Mobile uses purpose-built list/profile/clock/calendar screens with navy header and fixed bottom navigation.

### Candidate / Recruitment

- Recruitment surfaces use visual job cards, completeness and application state, rather than a generic admin table.
- Mobile flows are distinct for discovery, application, invitation and activation readiness.

### Inspector

- Dashboard, Garden portfolio, inspection detail, findings/actions and reports each preserve a compact operational hierarchy with Garden photos and semantic status.
- Mobile exposes six focused workflows rather than shrinking the desktop grid.

### Finance

- Ledger and subscription remain visually and semantically separate. Desktop mixes KPIs, balance/action cards, charts and compact ledgers. Mobile keeps child context and provider truth prominent.

### Messaging / Notifications

- Thread list/detail, broadcast and notification preferences use compact conversation/list geometry, visible identity, delivery state and provider readiness.

### Documents

- Desktop uses a file-center composition with list, preview, metadata/actions and categories. Mobile uses focused file/status screens. Document status never depends on color alone.

### Tasks / Complaints / Corrective Actions

- Domains remain distinct. Desktop uses compact list/detail pairs, evidence and deadlines. Mobile uses state-filtered cards and persistent primary actions.

### Inspections

- Checklist, evidence, findings, scoring and submission are a staged inspection composition with compact progress and immutable submitted score presentation.

### Reports / Analytics

- Report library, filter/configuration, result chart/table and export form a deliberate sequence. Charts and tables have different visual roles.

### Global States / RTL / Accessibility

- Desktop state gallery shows loading, empty, error, permission and provider/offline states as separate components; lower panels show validation, calendar, select, toggle and accessibility behavior.
- Mobile uses the same language in full-width focused panels. Mixed-direction values remain readable inside RTL layout.

## Above-the-fold acceptance baseline

For every captured screen, the following must be visually checked against the domain-specific reference at the target viewport:

1. Sidebar side, width and density.
2. Top bar height and utility placement.
3. Banner or identity area position and height.
4. Primary row/column count and proportions.
5. Major block order and first-viewport silhouette.
6. Image placement and scale.
7. Card geometry and density.
8. Typography hierarchy and CTA prominence.
9. Purpose-built Mobile ordering, selected context and bottom navigation.
10. Canonical functions integrated without changing the reference composition.

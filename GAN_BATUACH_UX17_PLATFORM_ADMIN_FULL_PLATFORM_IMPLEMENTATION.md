# Gan Batuach UX-IMPLEMENT-17 — Platform Admin Full Platform

## Scope and source baseline

- Source integration head: `37f5313389f0814c186c1774f588685d004e2b82`
- Branch: `codex/ux-implement-17-platform-admin`
- Environment used for functional and visual QA: isolated `DEVELOPMENT / INTEGRATION`
- Production access, deployment, database mutation, provider activation, and `main` changes: **none**
- New paid dependency or fixed monthly commitment: **₪0**
- Digital Observer core diff: **0**

UX-17 refines the existing canonical Platform Admin implementation. It does not add another authorization, reporting, complaint, subscription, audit, provider, or service-health engine.

## Visual references

| Reference | Usage | SHA-256 |
|---|---|---|
| `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png` | Primary Admin shell, command center, metrics, charts, Gardens, Users, complaints, service state, settings, Desktop and Mobile composition | `ccdd55229842b15ab15adeb66dcb1232b82641dbb8135ed77092a9e43b6647d6` |
| `GB_UX_REF_OWNER_CORE.png` | Gan Batuach navigation, royal-blue hierarchy, light workspace and card language | `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564` |
| `GAN_BATUACH_BRAND_MARK.png` | Official Gan Batuach mark | `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce` |

The primary file was unavailable at the supplied Downloads path and was found under the supplied Gan Batuach design directory with the exact requested filename. It was visually inspected and its hash is recorded in the evidence manifest.

## Canonical 12-area Admin information architecture

| # | Canonical destination | Primary route | Specialist routes inherit here |
|---:|---|---|---|
| 1 | ראשי | `/dashboard/admin` | Action center and recent platform activity |
| 2 | גנים | `/dashboard/admin/kindergartens` | Garden detail and lifecycle |
| 3 | משתמשים | `/dashboard/admin/users` | User detail, roles and permissions |
| 4 | מפקחים | `/dashboard/admin/inspectors` | Inspector operations and assignment context |
| 5 | אישורים | `/dashboard/admin/kindergarten-applications` | Garden, Inspector and canonical verification queues |
| 6 | מנויים | `/dashboard/admin/subscriptions` | Platform billing readiness; Parent tuition remains separate |
| 7 | תלונות | `/dashboard/admin/complaints` | SLA and escalation oversight |
| 8 | ספקים ותמיכה | `/dashboard/admin/provider-production` | Communications, payment, invoice, camera and external dependency readiness |
| 9 | מצב מערכת | `/dashboard/admin/system-health` | Application, database, notifications, payment, document and camera readiness |
| 10 | Audit ואבטחה | `/dashboard/admin/audit-logs` | Sensitive platform actions and safe event review |
| 11 | דוחות | `/dashboard/admin/reports` | Existing canonical UX-15 / GB-M36 reporting center |
| 12 | הגדרות | `/dashboard/admin/settings` | Platform configuration, policy and readiness entry points |

Both role shells now expose exactly these 12 Desktop destinations. Mobile uses five high-value entry points and a contextual `עוד` destination; it does not compress 141 physical routes into navigation.

## Route and component map

| Capability | Route / component | Result |
|---|---|---|
| Admin command center | `/dashboard/admin` | Six canonical metrics, two accessible aggregate charts, service truth, action center and recent activity |
| Gardens | `/dashboard/admin/kindergartens` | Search, lifecycle/status filter and responsive operational cards |
| Garden detail | `/dashboard/admin/gardens/[id]` | Admin-safe profile, aggregate memberships, subscription, complaint/document counts, inspection summary and audit activity |
| Users / user detail / permissions | `/dashboard/admin/users` | Existing canonical account, role, membership and authorization surfaces inside canonical shell |
| Garden approvals | `/dashboard/admin/kindergarten-applications` | Existing canonical lifecycle and audited actions |
| Inspector approval | `/dashboard/admin/inspector-applications` | Explicitly separates candidate approval from Garden assignment |
| Subscriptions | `/dashboard/admin/subscriptions` | Garden → Gan Batuach only, provider readiness truth and no Parent tuition blending |
| Complaints | `/dashboard/admin/complaints` | Canonical GB-M25 status, Garden, SLA/escalation and assignment context |
| Provider readiness | `/dashboard/admin/provider-production` | Server-backed configured/unavailable/degraded states without exposing environment-variable names, endpoints or signing fields |
| System status | `/dashboard/admin/system-health` | Truthful service cards; absent proof is setup-required/degraded, never fabricated healthy |
| Audit | `/dashboard/admin/audit-logs` | Safe aggregate coverage and filtered metadata keys; no raw payload or direct network identifiers |
| Reports | `/dashboard/admin/reports` | Reuses `ReportsCenter role="admin"`; no second analytics engine |
| Settings | `/dashboard/admin/settings` | 12-area map plus profile, provider, security and policy entry points |
| Shared IA | `RoleAppShell`, `DashboardShell`, `AdminAppFrame` | Exact canonical navigation across current and retained specialist surfaces |
| Shared UX-17 primitives | `platform-admin-ui.tsx` | Area grid, Admin truth state and section introduction |
| Responsive visual layer | `ux-implement-17.css` | Purpose-built 1440×1024 Desktop and 390×844 Mobile composition |

## Role and security model

- Every reviewed P0 route keeps server-side `requireRole(["admin"])`; no page relies on a hidden navigation item or client-only gate.
- Garden detail uses aggregate child, Parent and Staff counts. It does not list Child records, medical content, family conversations, Staff conversations, private documents, or camera media.
- User surfaces do not expose passwords, tokens, recovery data, service-role keys or internal provider configuration.
- Audit metadata is allow-filtered by key and never renders raw JSON payloads or direct IP data.
- Queries remain bounded and server-side. No cross-tenant browser query or unrestricted data dump was added.
- Reports reuse canonical bounded reporting. No second report store or analytics engine was added.

## Garden lifecycle and approval states

The UI preserves canonical lifecycle/status data from the backend, including pending/preliminary, information-required context, approved/active, rejected and suspended where present. Garden approval remains an explicit audited action. No client-only approval or invented lifecycle transition was added.

Inspector approval remains separate from assignment. The approval surface explicitly explains that an approved Inspector is not assigned to a Garden until the canonical assignment workflow completes.

## Subscription and provider truth states

- Platform subscription is Garden → Gan Batuach and remains separate from Parent tuition.
- Electronic payment, invoice, communications, camera and AI readiness use server capability/configuration truth.
- Safe UI states include configured, unavailable, degraded, setup required, test/sandbox and Production verified where evidence exists.
- Missing configuration is summarized as an action-required state. Internal environment-variable names, endpoints, signing fields and raw provider messages are not displayed.
- Mock, shadow, sandbox and local-only modes are never presented as Production health.

## Complaints, service status and audit

- Complaints reuse canonical GB-M25 status, SLA, escalation and assignment records; message bodies are not promoted into the Admin overview.
- System health distinguishes application, database, communications, payments, documents/storage and Digital Observer/camera readiness.
- A green/operational state requires actual source truth. Missing Development tables or provider evidence render degraded/setup-required states.
- Audit shows aggregate coverage and safe event context. Raw payloads, sensitive metadata, storage paths and private content are omitted.

## Desktop and Mobile behavior

### Desktop — 1440 × 1024

- Deep navy Admin sidebar with exactly 12 destinations and a compact utility header.
- Six-card command-center summary, accessible aggregate charts, action center, service state and recent activity.
- Responsive card/table hybrids for Gardens, Users, approvals, complaints, subscriptions and audit.
- Spacious filters and distinct safe detail compositions rather than a generic internal dashboard.

### Mobile — 390 × 844

- Five high-value bottom destinations with a contextual menu for the full canonical IA.
- Two-column metric cards, stacked charts and single-column operational cards.
- Purpose-built Garden, User, complaint, provider, system status, audit, reports and settings surfaces.
- Large touch targets, filter controls, textual statuses and no compressed Desktop tables.

## Accessibility and RTL

- RTL is set at the application root and verified for navigation, filters, cards, metrics, charts, dates and currency.
- Semantic navigation, lists, cards and server-rendered headings are retained.
- Charts have text-equivalent `aria-label` values.
- Statuses use text plus icon/color; provider and service truth never depends on color alone.
- Keyboard focus remains visible, touch targets are sized for Mobile, and reduced-motion rules are present.

## QA evidence

Visual evidence lives in [`qa-evidence/ux-implement-17`](./qa-evidence/ux-implement-17/visual-report.md):

- 19 required concepts × Desktop/Mobile = 38 captures.
- `OWNER_REVIEW_READY`: 38
- `NEEDS_POLISH`: 0
- `VISUAL_DRIFT`: 0
- `BROKEN`: 0
- Primary-reference comparison: `reference-comparison-board.webp`
- Desktop contact sheet: `contact-sheet-desktop.webp`
- Mobile contact sheet: `contact-sheet-mobile.webp`
- Machine-readable results: `visual-qa-report.json`
- Evidence manifest and SHA-256 inventory are included in the same directory.

The visual runner uses an isolated loopback-only Development application and local database. It checks 500 responses, redirects, horizontal overflow and sensitive provider/storage text. It does not access Production.

## Validation summary

| Validation | Result |
|---|---|
| UX-17 focused Platform Admin contract | PASS — 9/9 |
| Canonical 12-area navigation | PASS |
| Admin server authorization | PASS |
| Garden aggregate privacy boundary | PASS |
| Inspector approval vs assignment | PASS |
| Subscription separation and provider truth | PASS |
| Reports reuse | PASS |
| Audit payload redaction | PASS |
| Typecheck | PASS |
| Lint regression baseline | PASS — 0 regressions; canonical errors/warnings 0/0 |
| Production build with live activation disabled | PASS — 541 routes collected/generated |
| Canonical domain regression | PASS — 30/30 |
| Security/isolation gate | PASS — 11/11 |
| Platform subscription contract | PASS — 5/5 |
| Inspector approval contract | PASS — 4/4 |
| Canonical reporting contract | PASS — 7/7 |
| Manager/Parent contract | PASS — 23/23 |
| Migration safety | PASS — 244 migrations, no unreviewed destructive change |
| Development migration drift | PASS — 244 expected, 0 missing, 0 errors |
| Release contract preflight | PASS — Production mutation false |
| Desktop visual QA | PASS — 19/19 |
| Mobile visual QA | PASS — 19/19 |
| Digital Observer core diff | PASS — 0 |

Integration checks and cumulative post-merge checks are recorded in the PR evidence and final task report.

## Deviations and truthful limitations

1. The recommended Finance, Inspector and Reports reference files were not required to reconstruct the P0 compositions because the mandatory Admin reference, Owner reference and existing canonical UX-09/15 components supplied the approved system. No unsupported screen was inferred from missing artwork.
2. Provider details remain action-oriented and intentionally omit environment-variable names, endpoints, signing fields and raw provider errors.
3. Local Development lacks some provider/readiness tables available in later environments. Those panels show degraded/setup-required truth instead of zero or fabricated healthy states.
4. Specialist routes remain reachable inside their canonical parent areas and are omitted from primary navigation.
5. Production was not accessed or changed. Provider health, payment readiness and Digital Observer status remain unverified unless canonical evidence proves otherwise.

These deviations preserve the approved Gan Batuach visual language, canonical functionality, privacy and capability truth.

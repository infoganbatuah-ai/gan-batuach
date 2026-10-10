# Gan Batuach UX-IMPLEMENT-16 — Safety + Cameras Full Platform

## Scope and source baseline

- Source integration head: `5d09f80324240b41b44ad52b7912d07fd0c0f653`
- Branch: `codex/ux-implement-16-safety-cameras`
- Environment used for functional and visual QA: isolated `DEVELOPMENT / INTEGRATION`
- Production access, Production deployment, Production database mutation, and camera-provider activation: **none**
- New paid dependency or fixed monthly commitment: **₪0**
- Digital Observer core diff: **0**

The Management product consumes existing camera and Digital Observer contracts. This batch adds no camera engine, detector, identity resolver, streaming provider, recording system, or Digital Observer core behavior.

## Visual references

| Reference | Usage | SHA-256 |
|---|---|---|
| `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png` | Primary Safety overview, camera grid/detail, Desktop and Mobile composition | `4e51efdbbb7d9dc49e96b2deadd2b9d975cbc8b29e6736488329c312f75e5b67` |
| `GB_UX_REF_OWNER_CORE.png` | Owner shell, navigation, blue hierarchy and card language | `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564` |
| `GAN_BATUACH_BRAND_MARK.png` | Official Gan Batuach brand mark | `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce` |
| `GB_UX_REF_PARENT_FULL_PLATFORM.png` | Parent shell and Mobile hierarchy | `bf9ee24689f0c7dceeed1c0e894dff6a4357f471e7c1e1ea0bda00359328d3d4` |
| `GB_UX_REF_STAFF_FULL_PLATFORM.png` | Staff shell and Mobile hierarchy | `4026a8eb545dc27cb95dacb8a7375a539ba82e6aaa74b2fdb57266114bf9662b` |
| `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png` | Inspector shell and evidence-limited composition | `dafaffdf6e556ef6c5b548db0e5d37f4f03121131e0f2ef02bf282819f043ab3` |

The primary file was unavailable at the supplied Downloads path and was found under the supplied design directory with the exact requested filename. Its hash is recorded above and in the visual report.

## Route map

| Role / capability | Route or surface | Authorization source |
|---|---|---|
| Owner / Manager Safety command center | `/dashboard/garden/cameras` | `requireRole(["manager", "owner"])` plus server-validated active Garden context |
| Owner / Manager camera detail | `/dashboard/garden/cameras?camera=:id` | Same Garden-scoped server query; selected camera must be in the returned scope |
| Owner / Manager setup | `/dashboard/garden/cameras?view=setup` | Canonical `CameraAdminManager` inside the Management composition |
| Owner / Manager events, incidents and evidence | `/dashboard/garden/cameras?view=events` | Garden-scoped canonical camera/incident records |
| Owner / Manager policy | `/dashboard/garden/cameras?view=policy` | Current role and active Garden context |
| Owner / Manager readiness | `/dashboard/garden/cameras?view=readiness` | Camera/provider readiness fields; no inferred Live state |
| Parent cameras | `/dashboard/parent/cameras` | Parent profile, linked child/Garden, camera policy and RLS through `getParentCameraListForProfile` |
| Staff cameras | `/dashboard/staff/cameras` | Active operational employment, active Garden and `staff_view_allowed` |
| Inspector cameras/evidence | `/dashboard/inspector/cameras` | Active inspector role and assigned Gardens; evidence-only projection |
| Admin Safety oversight | `/dashboard/admin/cameras` | Admin authorization; safe platform aggregation |
| Playback token boundary | `POST /api/camera-streams/:id/playback-token` | `video:stream` permission, rate limit and explicit Production verification gate |

Query-state surfaces use `view=events|setup|policy|readiness`, `filter=online|degraded|offline|setup_required|action`, and `camera=:id`. Mobile and Desktop use the same canonical data but different CSS composition and navigation behavior.

## Canonical capability map

| Canonical Safety / Cameras capability | Surface | Result |
|---|---|---|
| Safety overview and action metrics | All role routes | Implemented from scoped backend truth |
| Camera list/grid | All role routes | Implemented with role-specific filtering |
| Camera detail | `?camera=:id` | Implemented; safe metadata only |
| Live view | Detail and camera cards | Truthful unavailable state until a Production-verification attestation exists |
| Setup/onboarding | Owner, Manager and Admin `?view=setup` | Canonical manager retained; staged UX explains detection, connection, mapping, test and activation |
| Connection/readiness | `?view=readiness` | Online, degraded, offline, setup required and unavailable remain distinct |
| Area mapping | `?view=setup` | Canonical setup handoff; no new taxonomy or device-discovery engine |
| Events | `?view=events` | Only canonical verified events may render; mock/shadow/sandbox/local rows are excluded from Production claims |
| Incidents | `?view=events` | Canonical `incident_reports`, distinct from events |
| Evidence | `?view=events` | Signed/private access explanation; no public URL or storage key |
| No-recording policy | `?view=readiness` and camera detail | Explicit `אין הקלטה בהתאם למדיניות`; no fabricated history/playback |
| Role policies | `?view=policy` | Owner/Manager, Parent, Staff and Inspector rules remain separate |
| Watch Rules | `?view=readiness` | Existing canonical requests surfaced as human-review capability; no automatic action claim |
| Investigation | `?view=readiness` | Truthful unavailable state until a Management-scoped verified contract exists |
| Multi-Garden | Owner/Admin/Inspector contexts | Queries remain server-scoped; no client-selected cross-Garden authority |
| Audit/privacy | Detail, policy, API boundary | No secrets, RTSP credentials, storage paths, public evidence URLs or track-to-child identity mapping |
| Search and filters | Overview toolbar | Server-rendered query by camera name, area or Garden plus canonical truth-state chips |
| Existing camera operations | Readiness continuation links | Camera health, incidents, gateway, audit, Watch Rules and Observer Intelligence remain reachable on their canonical routes |

## Camera truth-state model

| UI state | Canonical input examples | Meaning |
|---|---|---|
| `online` | active plus `online`, `connected`, `healthy` or `active` | Source is connected; this does not prove Live is Production verified |
| `degraded` | `degraded`, `warning`, `unstable`, `partial`, `testing` | Source has limited or unstable capability and is not equivalent to offline |
| `offline` | `offline`, `failed`, `error`, `no_signal`, `unreachable`, `unauthorized` | Source is unavailable; no preview is shown |
| `setup_required` | `pending`, `pending_gateway`, `not_configured`, `setup_required`, `draft`, or no authoritative state | Setup/readiness work remains |
| `unavailable` | `active=false` or `disabled` | Source is intentionally unavailable |

`HLS`, `WebRTC`, gateway IDs, local mocks, shadow rows, sandbox rows and a rendered preview are never treated as a Production Live attestation.

## Role-camera permission matrix

| Role | Scope | Camera access | Live policy | Evidence / internal data |
|---|---|---|---|---|
| Owner / Manager | Server-validated active Garden | Broader Garden scope under canonical permissions | Disabled until explicit Production verification and role/camera policy both pass | Garden-scoped; no secrets or raw provider errors |
| Parent | Own linked child and Garden | Only cameras explicitly approved for parent viewing | Disabled until Production verification; no stale access across Garden context | No internal Safety, other families, Staff-only cameras or investigation tools |
| Staff | Active employment, Garden, role and camera policy | `staff_view_allowed` cameras in the employment Garden | Disabled until Production verification | No Garden-wide default access |
| Inspector | Assigned Gardens only | Evidence-only context unless an explicit policy says otherwise | No default Live access | No unrelated Garden operations or private notes |
| Admin | Canonical platform authorization | Operational oversight across the authorized platform scope | Disabled until Production verification | Aggregated safe metadata; no credential material |

## Setup/onboarding flow

1. Add a supported system or camera through the canonical setup manager.
2. Detect or identify through existing supported connection methods only.
3. Check connection and show connected, unreachable, auth required, degraded, unsupported, or incomplete truthfully.
4. Map the source to a canonical Garden area.
5. Test the source without exposing credentials in the browser.
6. Activate only from backend-authoritative readiness; a rendered image does not activate the camera.

The implementation preserves existing RTSP/ONVIF/NVR/DVR/Gateway paths and does not add device discovery, provider connectors, or paid infrastructure.

## Events, incidents and evidence

- Events are routine canonical camera occurrences and are not relabeled as incidents.
- Incidents come from canonical `incident_reports` and remain separate from events.
- Evidence requires role authorization and short-lived signed retrieval. No public media URL or raw storage path is rendered.
- The UI does not resolve Track ID to a named child and does not expose face/person search.
- Routine event metadata does not imply retained video.
- No-recording cameras show the policy state and do not show a fabricated history or evidence archive.

## Digital Observer integration requirements

### Secure permitted Live View

- **Required Management capability:** authorize and render a role-permitted live camera stream.
- **Missing contract:** an explicit, canonical Production-verification attestation for each Management camera/provider path. Connectivity, HLS/WebRTC readiness and gateway presence are insufficient.
- **Expected inputs:** camera ID, Garden ID, actor/profile ID, role, camera policy, capability-attestation version, provider health and allowed playback protocol.
- **Expected outputs:** `production_verified`, permitted protocol(s), bounded session expiry, readiness reason and audit reference.
- **Authorization requirement:** server-enforced tenant/Garden membership, role-camera policy, rate limit and audited token issuance.
- **Truthful fallback:** `production_verification_required`; no player and no playback token.

### Management-scoped Investigation

- **Required Management capability:** bounded search of authorized canonical Events/Incidents/evidence.
- **Missing contract:** a Management-specific authorization projection defining available query types and safe result fields.
- **Expected inputs:** authorized Garden/camera scope, bounded time window, query type and actor context.
- **Expected outputs:** grounded canonical result IDs with signed evidence indirection and no raw AI payload.
- **Authorization requirement:** tenant/Garden isolation, role policy, bounded pagination and audit.
- **Truthful fallback:** Investigation remains unavailable in Management.

These requirements are documentation only. Digital Observer core was not modified.

## Desktop and Mobile behavior

### Desktop — 1440 × 1024

- Wide command center with navy role shell, gradient Safety hero, metric row and filter bar.
- Responsive camera grid with dedicated detail workspace and safe capability state.
- Dedicated events/incidents/evidence, setup, policy and readiness compositions.
- Keyboard-visible focus, semantic sections/tables and textual state labels.

### Mobile — 390 × 844

- App-native stacked summary, horizontally scrollable filters and single-column camera cards.
- Full-width camera detail, setup steps, incident/evidence cards and policy rows.
- Role-specific bottom navigation, large touch targets and no compressed Desktop table/grid.
- Reduced-motion behavior and RTL-first layout with readable numeric/date presentation.

## Accessibility and RTL

- Semantic headings, articles, lists and table roles.
- Accessible camera names and labels for status, permission and actions.
- Every state has text plus icon/color; no color-only meaning.
- Focus-visible rings, disabled state semantics, minimum Mobile target sizing and reduced motion.
- Verified RTL order for hero, filters, cards, detail, times, events, policy and Mobile navigation.

## QA evidence

Visual evidence lives in [`qa-evidence/ux-implement-16`](./qa-evidence/ux-implement-16/visual-report.md):

- 24 required concepts × Desktop/Mobile = 48 captures.
- `OWNER_REVIEW_READY`: 48
- `NEEDS_POLISH`: 0
- `VISUAL_DRIFT`: 0
- `BROKEN`: 0
- Reference comparison: `reference-comparison-board.webp`
- Desktop contact sheet: `contact-sheet-desktop.webp`
- Mobile contact sheet: `contact-sheet-mobile.webp`
- SHA-256 manifest: `SHA256SUMS.txt`
- Authenticated role-boundary report: `role-boundary-probes.json`

The visual runner uses isolated synthetic Development data, authenticated Owner, Parent, Staff, Inspector and Admin identities, and a loopback-only Development app/database. It does not touch Production.

## Validation summary

| Validation | Result |
|---|---|
| UX-16 focused Safety/Camera contract | PASS — 10/10 |
| Authenticated role boundary probes | PASS — 9/9 assertions; 9/9 logins; private storage denied; sentinel cleanup PASS |
| Manager/Parent contract | PASS — 23/23 |
| Camera connection layer | PASS — 15/15 |
| Camera onboarding | PASS — 7/7 |
| Digital Observer Watch Rules | PASS |
| Digital Observer Investigation | PASS — 10/10 |
| Observer engine separation | PASS |
| Canonical domain regression | PASS — 30/30 |
| Security/isolation gate | PASS — 11/11 |
| Typecheck | PASS |
| Lint regression baseline | PASS — 0 regressions; canonical errors/warnings 0/0 |
| Production build with live activation disabled | PASS |
| Migration safety | PASS — 244 migrations, no unreviewed destructive change |
| Development migration drift | PASS — 244 expected, 0 missing, 0 errors |
| Release contract preflight | PASS; Production mutation false |
| Integration workflow / ledger / baseline guards | PASS |
| Desktop visual QA | PASS — 24/24 |
| Mobile visual QA | PASS — 24/24 |

## Deviations and truthful limitations

1. **Live is unavailable.** The canonical Management contract does not provide an explicit Production-verification attestation. The playback-token route fails closed with `503` after permission and rate-limit checks; the UI renders no player.
2. **Camera imagery is omitted when no canonical signed snapshot exists.** Status cards use a premium state surface instead of a fake frame or public URL.
3. **Investigation is unavailable in Management.** Existing Digital Observer investigation behavior is not projected into Management without a role-safe Management contract.
4. **Inspector access is evidence-only.** No unrestricted Garden chat, camera library or Live access is inferred.
5. **No AI incident or identity is fabricated.** Only canonical reports are shown; Track ID is explicitly not a child identity.

These deviations preserve the approved Gan Batuach visual language while keeping capability truth, privacy and Digital Observer ownership intact.

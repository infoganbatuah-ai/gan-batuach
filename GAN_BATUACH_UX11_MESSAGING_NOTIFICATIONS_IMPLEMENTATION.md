# GAN BATUACH UX-11 — Messaging, Broadcasts and Notifications

## Source and boundaries

- Source Development head: `a1f521151804c9bf630c62c6f6ffb9aea71d3d3d`
- Feature branch: `codex/ux-implement-11-messaging-notifications`
- Primary visual reference: `GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png`
- Primary reference SHA-256: `5e78d1016224292bd8d2e6ab77861847d0b89db4b1370dcd60830224baff6032`
- Supporting reference SHA-256 values: Owner `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564`, Parent `bf9ee24689f0c7dceeed1c0e894dff6a4357f471e7c1e1ea0bda00359328d3d4`, Staff `4026a8eb545dc27cb95dacb8a7375a539ba82e6aaa74b2fdb57266114bf9662b`, brand `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce`
- Production and `main`: untouched
- Digital Observer core: unchanged
- New fixed monthly commitment: `₪0`
- Schema migrations: none

UX-11 presents the existing communication contracts as three distinct products: authorized conversation threads, authorized Garden broadcasts, and role-safe system notifications. Complaints and Tasks remain separate. It creates no second messaging backend and activates no external provider.

## Route map and feature completeness

| Canonical capability | Route or surface |
|---|---|
| Owner/Manager thread list and conversation detail | `/dashboard/garden/messages` |
| Parent thread list and own-Child/Garden conversation detail | `/dashboard/parent/messages` |
| Staff thread list and employment-scoped conversation detail | `/dashboard/staff/messages` |
| Inspector communication policy state | `/dashboard/inspector/messages` |
| Authorized broadcast composition, preview and history | `/dashboard/garden/communication` |
| Garden notification center and preferences | `/dashboard/garden/notifications` |
| Parent notification center and preferences | `/dashboard/parent/notifications` |
| Staff notification center and preferences | `/dashboard/staff/notifications` |
| Inspector notification center and preferences | `/dashboard/inspector/notifications` |
| Admin delivery-readiness overview | `/dashboard/admin/communication` |
| Thread list/detail/read/send API | `/api/communication/threads`, `/api/communication/threads/[id]`, `/api/communication/threads/[id]/read`, `/api/communication/threads/[id]/messages` |
| Private attachment upload/download | `/api/communication/attachments` and signed canonical storage access |
| Broadcast creation | `/api/communication/broadcasts` |
| Notification list/read | `/api/notifications`, `/api/notifications/mark-read` |
| Preference and quiet-hours persistence | `/api/profile/communication-preferences` |
| Delivery capability truth | `managementDeliveryCapability()` and the canonical management capability contract |

## Component map

| Component | Responsibility |
|---|---|
| `InternalMessagingCenter` | Role-safe thread list, full conversation, unread/read, search, reply and private attachments |
| `BroadcastCenter` | Canonical Parents/Staff audience, optional Classroom scope, preview, idempotent send and history |
| `DeliveryReadinessStrip` | Truthful in-app, Push, Email, WhatsApp and SMS readiness |
| `NotificationCenter` | Category filtering, unread/read, safe preview and canonical deep-link actions |
| `NotificationPreferencesPanel` | In-app truth, supported external channels, category preferences and quiet hours |
| `CommunicationCenter` | Existing delivery-intent operations with capability-aware channel controls |

## Communication-domain separation

| Domain | Authority | UX treatment |
|---|---|---|
| Messaging | Canonical communication threads, participants and messages | Private split workspace / full-screen Mobile conversation |
| Broadcasts | Canonical Garden broadcast RPC and captured audience | Dedicated composition, confirmation preview and history |
| Notifications | Canonical notification rows and preference contract | Separate center, actions, categories and delivery controls |
| Complaints | Existing complaints domain | No rows, actions or lifecycle copied into communication |
| Tasks | Existing Tasks domain | No rows, actions or lifecycle copied into communication |

## Role and permission matrix

| Capability | Owner/Manager | Parent | Staff | Inspector | Admin |
|---|---:|---:|---:|---:|---:|
| Garden-authorized threads | Yes | Own linked context | Active employment/scope | No unrestricted chat | Only if separately canonical |
| Reply/attachment | Authorized thread only | Authorized thread only | Authorized thread only | No unrestricted chat | Existing policy only |
| Broadcast Parents/Staff | Authorized Garden | No | No by default | No | Existing policy only |
| Notification center | Own role-safe rows | Own rows | Own rows | Own assignment-safe rows | Authorized platform rows |
| Other Garden/family data | No | No | No | No | Only explicit Admin scope |

The server resolves role, Garden, employment, Child/Classroom scope and thread participation. UI state never expands permission. Inspector receives a purposeful limited state because the current canonical communication API does not grant unrestricted Garden conversations.

## Thread state map

| State | Presentation |
|---|---|
| Loading | Skeleton/progress treatment without exposing stale content |
| Empty | Purposeful next-step card distinct from error |
| Unread | Count and textual unread marker, backed by canonical participant read state |
| Read | Canonical read mutation after an authorized thread is opened |
| Reply pending | Composer disabled during one idempotent submission |
| Attachment upload | Private upload progress and failure feedback |
| Permission denied/stale | Safe shared state with no backend payload leakage |

## Broadcast state map

| State | Presentation |
|---|---|
| Draft | Subject, message, canonical audience and optional Classroom scope |
| Preview | Audience summary, message body and truthful in-app delivery statement |
| Sending | Disabled idempotent action |
| Sent | Canonical thread/history record; recipient snapshot is server-owned |
| Empty audience/denied | Safe actionable error; no delivery claim |

The current canonical broadcast contract supports `parents` and `staff`. It does not accept a broadcast attachment, so UX-11 does not fabricate one; the private thread attachment flow remains available where canonical.

## Notification state map

| State | Presentation |
|---|---|
| Unread/read | Text, icon and visual distinction; read state remains server-authoritative |
| Actionable | Safe `/dashboard/` deep-link to the owning domain |
| Informational | Detail sheet/card without duplicating domain data |
| Empty | Purposeful no-notifications state |
| Failed/unavailable | Shared safe error; never replaced by an empty result |

## Channel-readiness map

| Channel | UX-11 behavior |
|---|---|
| In-app | Canonical and available |
| Push | Enabled only when the capability contract reports readiness; otherwise unavailable |
| Email | Product notification Email is enabled only when its capability is ready; Auth Email remains separate |
| WhatsApp | Not configured/unavailable unless a real provider contract proves readiness |
| SMS | Optional and unavailable unless a real provider contract proves readiness |

Delivery intents may report canonical `queued`, `pending`, `sent`, `failed` or `unavailable` state. UX-11 does not infer provider receipts or transform local simulation into delivery success.

## Quiet hours and safe previews

Quiet hours persist through the existing preference API with start/end values and canonical local-time behavior. Channel/category controls are constrained by actual readiness. In-app notifications show authorized context after login; external/readiness previews remain bounded and never include raw system payloads or unrelated private message bodies.

## Desktop and Mobile behavior

Desktop at `1440×1024` uses the approved deep-navy shell, a split thread list/conversation workspace, clear avatar hierarchy, modern message bubbles, broadcast cards, notification detail panel and grouped preference/channel cards.

Mobile at `390×844` is a separate app composition: message list and conversation are independent full-screen states, creation/preview uses modal sheets, notifications use cards, controls use large touch targets, and persistent bottom navigation remains visible without horizontal overflow.

## Visual QA evidence

- Fresh capture time: `2026-09-30T05:31:03.738Z`
- Environment: isolated `DEVELOPMENT / INTEGRATION`
- Viewports: `1440×1024` and `390×844`
- Concepts: `20`
- Screenshots: `40`
- `OWNER_REVIEW_READY`: `40`
- `NEEDS_POLISH`: `0`
- `VISUAL_DRIFT`: `0`
- `BROKEN`: `0`
- Evidence index: `qa-evidence/ux-implement-11/visual-report.md`
- Desktop board: `qa-evidence/ux-implement-11/contact-sheet-desktop.webp`
- Mobile board: `qa-evidence/ux-implement-11/contact-sheet-mobile.webp`
- Reference comparison: `qa-evidence/ux-implement-11/reference-comparison-board.webp`

The concepts are thread list, thread detail, composer, attachment, Parent messaging, Staff messaging, Owner messaging, Inspector limited state, broadcast creation, broadcast preview, broadcast history, notification center, notification detail/action, preferences, quiet hours, provider unavailable, Push readiness, Email readiness, WhatsApp unavailable and SMS unavailable.

## Accessibility and RTL

Interactive cards use buttons/links, visible labels, keyboard focus, semantic status text and non-color-only meaning. Dialog/sheet actions are labeled, touch targets are sized for Mobile, and reduced-motion preferences disable nonessential transitions. Layout, bubbles, timestamps, mixed contact data, filters, forms and bottom navigation were checked RTL-first.

## QA evidence and deviations

Focused contracts cover domain separation, role-safe routing, private attachments, idempotent send, canonical audience scope, notification actions, quiet hours, channel readiness and responsive styles. Visual captures use isolated synthetic identities and do not send live external messages.

Material visual deviations: none. The reference depicts external delivery switches, while the implementation truthfully disables any channel the canonical capability contract does not prove ready. Inspector receives the canonical limited-communication state rather than unrestricted Garden chat. Unsupported broadcast attachments and provider analytics were not fabricated.

## Integration closure

This section is finalized after exact-head checks and integration merge.

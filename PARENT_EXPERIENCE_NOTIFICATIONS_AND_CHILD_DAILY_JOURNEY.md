# Parent Experience, Notifications & Child Daily Journey

## Parent Experience Architecture

The parent entry point now routes `/dashboard/parent` to `/dashboard/parent/family-home`, making the family home the single parent landing screen.

The family home is built around:

- **My Child Today**: child photo, current status, kindergarten, trust score and latest approved update.
- **What Needs My Attention Today**: unread updates, documents, payments, open requests and missing daily updates.
- **Daily Journey**: approved child timeline events such as arrival, activity, meals, sleep, pickup and reviewed safety notes.
- **Smart Parent Feed**: parent-visible timeline events, shared gallery items and notifications ordered by recency and importance.
- **Family Action Center**: absence report, message, document approval, pickup, child information and payments.

Parents should not need to search across the platform for urgent items. The home screen pulls the most useful signals into one mobile-first view.

## Notification Architecture

Gan Batuach uses the existing communication layer:

- `communication_preferences`
- `push_category_preferences`
- `push_device_tokens`
- `push_notification_logs`
- `notifications`

PHASE 129 extends `communication_preferences` with:

- `parent_category_channels`
- `parent_quiet_hours`
- `parent_daily_digest_enabled`
- `parent_ai_summary_enabled`

Supported parent categories:

- `important`
- `safety`
- `attendance`
- `message`
- `document`
- `payment`
- `pickup`

Parents can choose delivery channels per category:

- Push
- Email
- SMS
- WhatsApp

Provider activation remains controlled by the production integration layer. This phase does not activate real broad sending.

## Daily Journey Model

The child daily journey uses approved parent-visible sources:

- `child_timeline_events`
- `child_daily_journals`
- `child_unified_records`
- approved gallery items
- parent-visible notifications

The timeline must remain a feed, not a report. Events should be short, visual and understandable:

- Arrived
- Creative activity
- Lunch
- Nap
- Outdoor play
- Parent update
- Pickup completed

Internal events, investigation details and raw observer events are not shown.

## AI Assistant Model

The parent assistant is positioned around:

- “What needs my attention today?”
- “How was my child today?”
- “Did my child eat?”
- “Did my child sleep?”
- “Any action required?”

AI summaries may only use:

- parent-visible child timeline events
- parent-visible daily journal data
- approved summaries
- parent-visible notifications

AI must not infer child labels, blame, discipline or sensitive conclusions.

## Privacy Rules

Parents may only see:

- their own children
- their child’s approved timeline
- documents and payments linked to their account
- cameras explicitly opened to parents by the kindergarten
- reviewed and approved safety summaries

Parents may not see:

- raw AI or observer signals
- internal investigations
- staff scoring
- other families’ children
- unrestricted camera feeds
- private kindergarten operations

Sensitive event notifications require human review before parent visibility.

## Remaining Gaps

- Native iOS and Android push delivery still depends on provider setup and real device-token enrollment.
- WhatsApp/SMS real sending remains behind provider activation.
- Smart feed ranking is currently deterministic from approved data; deeper personalization can be added later.
- Parent satisfaction analytics are prepared through engagement events, but not yet surfaced as a manager insights dashboard in this phase.

# Parent Platform 2.0 & Family Experience Network

## Purpose

The parent experience is now centered around a single daily family home:

`/dashboard/parent/family-home`

The screen is designed to make Gan Batuach a daily-use family application. It brings together the child status, approved timeline, daily summary, weekly family summary, notifications, trust signals, cameras, gallery, documents, pickup and payments without exposing internal kindergarten data.

## Family Experience Model

- Child-first hero with photo, kindergarten, connection status and trust score.
- Today's timeline as the primary parent feed.
- AI-style daily summary based only on parent-visible journal, timeline and unified child record fields.
- Weekly family summary when enough approved data exists.
- Family action center for absence, messages, documents, pickup, child details and payments.
- Engagement cards for gallery, cameras, health updates, pickup, notifications and payments.

## Trust Model

Parents see only safe, approved trust signals:

- Trust badge readiness.
- Safety score from the latest approved inspection or kindergarten trust status.
- Latest inspection date.
- High-level improvement status.

Parents do not see raw findings, internal investigations, raw observer events, staff details or confidential kindergarten operational data.

## Communication Model

The family home links into existing parent-safe workflows:

- `/dashboard/parent/messages` for parent-kindergarten communication.
- `/dashboard/parent/notifications` for categorized updates.
- `/dashboard/parent/documents` for approvals and uploaded documents.
- `/dashboard/parent/pickup` for pickup permissions and history.

The page does not create broad sending or new messaging logic.

## AI Summary Model

Summaries are generated from existing parent-visible data only:

- `child_unified_records.parent_visible_summary`
- `child_unified_records.daily_summary`
- `child_unified_records.weekly_summary`
- parent-visible `child_timeline_events`
- `child_daily_journals.notes_to_parents`, meals and sleep summaries

The assistant prompts are navigation prompts, not autonomous decisions.

## Privacy Rules

- Parent sees only their linked children.
- Timeline events must be `parent_visible = true`, `internal_only = false`, and visibility must be `parent` or `approved_parent`.
- Cameras use the parent camera access layer and sanitized camera rows.
- Raw AI events, internal investigations and observer signals are not shown.
- Gallery items must be visible to parents and filtered by child scope when child IDs are present.

## Engagement Readiness

The screen exposes engagement signals without adding new backend dependencies:

- timeline items viewed/readiness
- unread notifications
- open parent requests
- document actions
- gallery availability
- camera availability
- payment attention

Future tracking can write these interactions into the existing analytics/audit infrastructure.

## Remaining Gaps

- True AI conversation for parents still needs the shared assistant runtime and response review rules.
- Weekly family summaries will be richer once more timeline events are consistently produced by staff workflows.
- Referral sharing and public trust badge sharing are prepared as UX direction, not activated as public sharing.
- Camera availability still depends on real gateway and manager-approved parent permissions.

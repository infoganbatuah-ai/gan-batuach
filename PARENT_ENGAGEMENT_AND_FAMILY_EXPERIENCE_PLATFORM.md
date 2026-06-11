# Parent Engagement And Family Experience Platform

## Goal

The parent portal is designed as a daily family experience, not an administrative dashboard. The main experience is the child: current status, approved updates, simple actions, trust information and calm summaries.

## Parent Experience Model

- Family home starts with the primary child photo, status, kindergarten, trust score and latest approved update.
- The main daily surface is the child timeline, presented as a feed.
- Quick actions are short and practical: message the kindergarten, view timeline, open cameras, documents, pickup, gallery and payments.
- Secondary information stays below the fold and is grouped by trust, child details and engagement availability.
- Parent payments are informational only: balance, next payment and a message path to the kindergarten.

## Timeline Model

The parent timeline uses `child_timeline_events` and only shows events where:

- `parent_visible = true`
- `internal_only = false`
- `visibility in ('parent', 'approved_parent')`
- the child belongs to the authenticated parent through the family context and RLS policy

Supported parent-facing categories:

- attendance
- meals
- sleep
- activities
- health
- pickup
- documents
- messages
- AI summaries
- observer-approved events

The timeline is intentionally written like a family feed, not a report.

## AI Summary Rules

Parent summaries must be:

- short
- calm
- factual
- based only on approved parent-visible data
- free of accusations or conclusions

Parent summaries must not include:

- raw AI events
- internal observer signals
- staff-only notes
- investigation details
- risk labels or child profiling

## Weekly Summary Readiness

`parent_family_summary_snapshots` prepares daily, weekly and monthly family summaries. These summaries are marked `approved_parent_visible_only` and are intended to be generated only from approved parent-visible events.

## Engagement Model

`parent_engagement_events` prepares safe usage tracking for:

- daily logins
- timeline views
- camera views
- message opens
- document approvals
- notification opens
- gallery views
- pickup views
- payment views
- trust views

The model stores product usage signals only. It is not a child profile and does not store raw investigation or AI data.

## Privacy Rules

- Parents see only their own children.
- Parents see only approved timeline events.
- Parent camera access remains permission based.
- Gallery items are filtered to parent-visible items and child scope.
- Documents are scoped to the parent or their children.
- Parent payments use only the children linked to the family context.
- Raw AI, internal notes and investigation data are not exposed.

## Screens Updated

- `/dashboard/parent`
- `/dashboard/parent/children/[id]/timeline`
- `/dashboard/parent/documents`
- `/dashboard/parent/gallery`
- `/dashboard/parent/payments`

## Remaining Gaps

- Real event insertion for engagement tracking still needs API hooks.
- Parent assistant answers are prepared as UI prompts, not an interactive assistant yet.
- Weekly summaries need a scheduled summarization job after real timeline data accumulates.
- Payment actions remain informational until a production payment provider is connected.
- Camera zone naming still depends on kindergarten configuration quality.

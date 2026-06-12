# Parent Trust, Transparency & Community Platform

## Purpose

Phase 140 turns the parent area into a trust platform. Parents receive a clear, safe view of kindergarten safety, compliance, staff readiness, inspections, communication, requests, announcements and community activity.

Transparency is intentionally bounded. The platform does not expose raw AI events, internal investigations, private child data, staff personal data or sensitive operational records.

## Trust Architecture

The parent trust center is available at:

- `/dashboard/parent/trust-center`
- `/dashboard/garden/trust-center`

The parent screen focuses on confidence and action:

- safety status
- compliance status
- staff readiness
- inspection summaries
- important updates
- community announcements
- calendar events
- surveys
- feedback and request submission
- parent-safe assistant summary

The manager screen focuses on operational trust:

- transparency score
- trust score
- communication quality
- open feedback
- open requests
- surveys
- community calendar
- monthly trust reports

## Transparency Framework

The transparency score is stored in `parent_transparency_scores`.

Score components:

- update frequency
- response time
- inspection visibility
- document readiness
- communication quality

The score is visible to managers and scoped parents. It is explainable through the `explanation` field.

## Communication Model

The platform adds parent trust communication records:

- `parent_feedback_items`
- `parent_request_center_items`
- `community_announcements`
- `community_calendar_events`
- `parent_surveys`
- `parent_survey_responses`
- `parent_participation_items`
- `parent_trust_reports`

Parents can submit:

- suggestions
- compliments
- concerns
- complaints
- document requests
- information requests
- meeting requests
- event participation
- volunteering interest

Managers can view lifecycle status and use the existing communication center for responses.

## Engagement Workflows

Parent engagement is prepared through:

- surveys
- feedback lifecycle
- request lifecycle
- participation records
- community announcements
- community calendar
- trust reports

This gives the kindergarten insight into parent confidence without exposing private parent details publicly.

## Visibility Rules

Parents may see:

- approved inspection summaries
- approved trust feed items
- compliance summaries
- staff readiness indicators
- community announcements
- calendar events
- their own requests and feedback
- parent-safe educational content

Parents may not see:

- raw AI events
- internal investigations
- evidence files
- other children’s information
- staff private information
- unapproved complaints
- operational security details

## Privacy And Compliance

All new tables use row-level security.

Access rules:

- admins can review platform-wide data
- managers see only their kindergarten
- parents see only data scoped to their kindergarten or their own submitted records
- global parent surveys are visible only when active and marked parent-visible

The model is designed for safe transparency, not unrestricted disclosure.

## Remaining Gaps

- Add manager response forms directly inside `/dashboard/garden/trust-center`.
- Add automated transparency score calculation jobs.
- Add monthly report generation workflow.
- Connect trust notifications to the unified notification engine.
- Add detailed engagement analytics charts after real usage data exists.

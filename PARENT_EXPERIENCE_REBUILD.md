# Parent Experience Rebuild

Date: 2026-06-11

Scope: PHASE UX-FINAL-2 parent-first UX pass.

## Goal

Make the parent experience feel like the center of Gan Batuach: simple, child-first, mobile-friendly and emotionally clear.

## Screens Changed

- `/dashboard/parent`
- `/dashboard/parent/children/[id]`
- `/dashboard/parent/daily-journal`
- `/dashboard/parent/notifications`
- `/dashboard/parent/messages`
- `/dashboard/parent/cameras`
- `/dashboard/parent/gallery`
- `/dashboard/parent/ai-events`
- Shared parent styling in `app/globals.css`

## Parent Home

The parent home was rebuilt around the child, not around system modules.

Top section now shows:

- child photo
- current child status
- kindergarten name
- safety/trust score
- latest update
- direct actions for message and journal

The page now prioritizes:

- daily child feed
- parent-friendly daily summary
- quick questions
- useful actions
- trust indicators
- child profile essentials

## Child Timeline

The parent home now includes a short feed-style day timeline:

- arrival
- morning activity
- outdoor play
- lunch
- nap/rest
- pickup

This is intentionally presented as a feed, not as a report.

## AI-Style Daily Summary

The dashboard prepares parent-friendly summaries using existing journal data only.

Examples of source data:

- mood
- meals
- sleep summary
- staff notes

The language avoids technical terms and does not claim autonomous insight.

## Notifications

The parent notification page now presents categories:

- child updates
- messages
- documents
- payments
- safety
- general

The existing notification center remains in place, but the page context is now parent-friendly.

## Cameras

The camera page was rewritten around trust:

- viewing only with kindergarten approval
- privacy first
- time-limited viewing
- kindergarten controls permissions

Technical camera language was removed from visible parent copy.

## Child Profile

The child profile was simplified.

Visible first:

- photo
- status
- age
- allergies
- emergency contact
- latest updates
- pickup/family summary

Advanced documents and requests are now behind a collapsed section.

## Communication

The parent messages page now feels closer to a conversation:

- shorter hero copy
- clearer status tracking
- chat-style thread cards
- existing request form kept intact

## Gallery

The gallery now presents approved media as moments from the kindergarten.

Added UX foundation for:

- timeline-style gallery
- filters
- future grouping by child/day/activity

No new media backend was added.

## Engagement Metrics

Parent engagement is represented using existing data:

- daily child updates
- open notifications
- journal availability
- camera access readiness

No new backend dependency was introduced.

## Remaining Parent UX Issues

- Daily journal data lookup still depends on existing parent-child linkage patterns and may need future consolidation.
- Parent camera availability still depends on kindergarten permissions and real video infrastructure.
- Parent assistant is prepared as UX questions, but no new assistant backend was added.
- Gallery filters are UX foundation only; full filtering logic can be added later without changing the visual model.
- Browser QA still needs a live local server or deployed environment for 360px, 390px and 414px review.

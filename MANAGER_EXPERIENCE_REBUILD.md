# Manager Experience Rebuild

Date: 2026-06-11

Scope: PHASE UX-FINAL-3 manager and owner experience rebuild.

## Goal

Turn the kindergarten manager dashboard into an operational command center. The manager should understand the kindergarten state in under 5 seconds and reach the most important workflows from one place.

## Screens Changed

- `/dashboard/garden`
- `/dashboard/garden/children`
- `/dashboard/garden/staff`
- Shared manager styling in `app/globals.css`

## Manager Command Center

The manager home now starts with:

- kindergarten health score
- attendance today
- staff present
- unresolved issues
- payment issues
- camera and observer issues
- AI recommendation count

The first screen answers:

> What needs attention right now?

## Daily Operations Center

The new operational area shows:

- children without attendance
- missing meal updates
- missing sleep updates
- children with health attention
- documents waiting for review
- children waiting for approval

Each item links directly to the relevant filtered workflow.

## AI Manager Assistant

The dashboard now includes a manager-facing assistant foundation using existing data and links.

Prepared questions:

- Which children need attention?
- What remains open today?
- Which documents need attention?
- What is the payment status?
- What does the observer recommend checking?

No new AI backend was added.

## Child Management Simplification

The children page remains feature-complete but now emphasizes:

- operational cards
- attendance
- missing journal updates
- allergies and health alerts
- parent requests
- payment issues

Dense tables were not introduced.

## Staff Oversight

The staff page now has clearer operational visibility:

- staff present today
- absent/not clocked in
- approved to work
- missing documents
- missing certifications
- open staff tasks

## Kindergarten Health Score

The command center calculates a simple score from existing data:

- attendance completion
- document compliance
- inspection readiness
- safety events
- staff readiness

This is a UX readiness score, not a regulatory or legal score.

## Compliance and Tasks

The manager home now groups:

- inspection actions
- missing documents
- open incidents
- open tasks
- parent requests

## Parent Communication Hub

The manager home highlights:

- parent requests
- unread messages
- urgent complaints
- children missing change clothes

## Finance Visibility

Finance is summarized on the manager home:

- expected income
- payment issues
- direct link to finance

Accounting details remain on the finance page.

## Cameras and Observer

The manager home summarizes:

- camera issues
- unresolved observer events
- direct links to cameras and observer intelligence

## Remaining Manager UX Issues

- `/dashboard/garden/finance` is better than before but still deserves a dedicated visual rebuild around collection actions.
- `/dashboard/garden/cameras` still contains admin-like technical areas in lower sections.
- `/dashboard/garden/observer-intelligence` still depends on existing observer panel density.
- Manager reports are now summarized, but trend charts were not added because this phase avoids new backend dependencies.
- Browser QA still needs a live environment for 360px, 390px, 414px and tablet review.

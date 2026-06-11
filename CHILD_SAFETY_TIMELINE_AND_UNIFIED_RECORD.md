# Child Safety Timeline And Unified Record

PHASE 114 creates a unified child safety and operations record. It is designed for transparency, safety, traceability and daily operations.

This is not a profiling system.

## Core Model

Main tables:

- `child_unified_records`
- `child_timeline_events`

`child_unified_records` stores the current child-level operational summary:

- child reference
- permanent child file reference
- kindergarten
- safety readiness score
- attendance trend
- health trend
- timeline activity count
- parent-visible event count
- missing update count
- daily summary
- weekly summary
- monthly summary

The score is operational readiness, not a child rating. It must not be used to label a child.

## Timeline Categories

Supported timeline categories:

- attendance
- meals
- sleep
- activities
- health
- incidents
- pickup
- documents
- messages
- AI summaries
- observer-approved events
- registration
- operations

## Timeline Sources

The migration seeds timeline events from existing data:

- attendance
- child daily journals
- medicine logs
- pickup events
- documents
- messages
- incident reports
- incident cases

Each event stores:

- category
- event time
- source type
- source id
- parent visibility
- visibility level
- safe summary
- safety relevance
- media URLs

## Parent Visibility Rules

Parents may see only:

- events with `parent_visible = true`
- events where `internal_only = false`
- events with `visibility` of `parent` or `approved_parent`
- events connected to their own permanent child file

Parents must not see:

- internal operational notes
- unreviewed incident case details
- raw observer signals
- investigation evidence
- staff-only notes
- AI/internal risk signals

## Manager Visibility

Managers and owners can see all timeline events scoped to their kindergarten.

The manager route is:

- `/dashboard/garden/children/[id]/timeline`

It shows:

- full operational timeline
- parent-visible count
- health events
- incident events
- linked incident cases
- safety/privacy guardrails

## Parent Timeline

The parent route is:

- `/dashboard/parent/children/[id]/timeline`

It shows:

- approved timeline events
- daily activities
- health updates
- documents
- messages
- pickup events
- parent-safe summaries

## AI Summary Rules

AI summaries must:

- use existing timeline data only
- use calm parent-friendly wording
- avoid diagnosis
- avoid blame
- avoid child labels
- avoid staff scoring
- avoid internal investigation details

Safe example:

> Today Maya participated in outdoor activities, ate normally and had no reported safety concerns.

Unsafe examples:

- “Maya is a risky child.”
- “A staff member caused the incident.”
- “AI detected neglect.”

## Privacy Model

The database policy for `child_timeline_events` was tightened so parent reads require explicit parent visibility.

Manager, owner, inspector and admin access remains scoped through existing garden access policies.

## Analytics Readiness

The model tracks:

- timeline completeness
- update frequency
- parent-visible event count
- missing updates
- attendance trend
- health trend

Future analytics can use these fields without exposing sensitive internal data.

## Remaining Work

- add staff quick-update integration into timeline writes
- add parent notification triggers for approved timeline events
- add gallery filtering by timeline event
- add PDF export for child safety record
- add richer weekly/monthly summaries once pilot data exists

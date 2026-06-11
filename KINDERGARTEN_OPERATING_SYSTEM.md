# Kindergarten Operating System

## Purpose

The Kindergarten Operating System turns Gan Batuach into one daily workspace for running a kindergarten.

It connects daily operations, children, staff, parents, compliance, inspections, payments, cameras, observer signals, tasks and notifications into one simple manager experience.

The goal is integration and clarity, not duplicated modules.

## Operational Model

The manager command center is available at:

`/dashboard/garden/operations`

It answers:

- What needs attention today?
- Which children still need updates?
- Which staff items are incomplete?
- Which inspections or compliance actions are open?
- Which observer/camera signals require review?
- Which payments or parent communications need action?

The page reads from existing product areas and shows a unified operating view.

## Daily Operations Model

The `daily_operations` table stores a daily operational snapshot per kindergarten.

Tracked areas:

- Attendance completion
- Staff readiness
- Child updates
- Health updates
- Inspections due
- Compliance issues
- Open incidents
- Observer alerts
- Payment issues
- Communication items

The live page also recalculates the current day from operational tables so the manager sees up-to-date status even before a scheduled snapshot job exists.

## Operational Health Score

`kindergarten_operational_health_scores` stores the explainable 0-100 operating score.

The score is based on:

- Attendance
- Compliance
- Inspections
- Incidents
- Communication
- Observer readiness

The score is not a black box. The command center shows component scores so managers understand what affects the result.

## Workflow Model

`operational_workflow_events` connects events into one operational workflow:

event → task → notification → review → closure

Examples:

- Inspection finding → corrective action → manager notification → inspector verification → closure
- Expired document → renewal task → reminder → document review → approved
- Observer signal → human review task → manager or inspector review → resolved/dismissed

The system does not replace existing task, notification, inspection, compliance or observer modules. It adds one orchestration layer above them.

## Unified Task Model

The operations center merges visible tasks from:

- Tasks
- Inspections
- Compliance actions
- AI recommendations
- Incidents
- Documents
- Communications
- Observer recommendations

This creates one work queue for the manager while preserving each original module.

## Unified Notification Model

The command center groups attention items from:

- Messages
- Notifications
- Compliance alerts
- Inspection alerts
- Payment alerts
- Observer alerts

The platform should continue to use the existing notification infrastructure. KOS only makes those signals easier to understand.

## Child Operations

Child operations connect:

- Attendance
- Meals
- Sleep
- Health
- Incidents
- Documents
- Timeline

The KOS page highlights missing daily updates and links to the existing child workflows.

## Staff Operations

Staff operations connect:

- GPS attendance
- Staff readiness
- Certifications
- Tasks
- Incidents
- Communication

The manager sees staff readiness as part of the operating score.

## Parent Operations

Parent operations connect:

- Timeline
- Documents
- Payments
- Communications
- Approvals
- Cameras

The manager sees parent communication and payment items without exposing private observer or investigation data.

## Inspection And Compliance Operations

Inspection operations connect:

- Inspections
- Findings
- Corrective actions
- Compliance issues
- Observer recommendations

Compliance operations connect:

- Documents
- Certifications
- Inspections
- Renewals
- Alerts

## Observer Operations

Observer operations connect:

- Cameras
- Audio
- AI events
- Observer alerts
- Incidents
- Risk scoring

Sensitive observer outputs remain review-only. No automatic accusations or disciplinary decisions are created.

## AI Operating Assistant

The KOS assistant prepares role-safe operational questions:

- What needs attention today?
- Which tasks remain open?
- What inspections are due?
- What compliance issues exist?
- Which children need updates?

Answers must use existing, permissioned data only.

## Unified Search Readiness

The current KOS page provides direct search shortcuts into:

- Children
- Staff
- Parents
- Documents
- Incidents
- Observer intelligence

Future work can add a true natural-language search index, but it must preserve role and kindergarten permissions.

## Automation Readiness

The system is ready for safe automations such as:

- Creating a task from an inspection finding
- Creating a reminder from an expiring document
- Creating a review item from an observer signal
- Closing a workflow after human verification

Automations should create reviewable work, not silently perform sensitive decisions.

## Remaining Work

- Scheduled daily snapshot generation
- Automatic workflow creation from every source module
- Stronger unified search experience
- More detailed parent engagement scoring
- Mobile QA on real devices
- Human approval rules for sensitive observer and incident workflows

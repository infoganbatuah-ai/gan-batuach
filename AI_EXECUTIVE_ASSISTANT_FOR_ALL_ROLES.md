# AI Executive Assistant For All Roles

## Architecture

The assistant is a unified layer available from every dashboard through the shared dashboard shell. It uses deterministic platform context and smart insights first. External AI can be connected later, but the current production-safe mode is rules-based and auditable.

Core tables:

- `ai_assistant_sessions`: one role-scoped assistant session per assistant open.
- `ai_assistant_messages`: prompts, responses, suggested actions, context sources and permission summary.
- `ai_assistant_usage_analytics`: aggregate usage and unresolved request tracking by role.

## Role Assistants

### Parent

Answers questions about:

- how the child was today
- meals
- sleep
- new updates
- missing parent actions

Uses only parent-visible child data, approved timeline events, documents, messages, payment status and approved camera availability.

### Staff

Answers questions about:

- children still needing updates
- open tasks
- alerts
- what to do next

Uses only staff-scoped operational data such as assigned tasks, staff documents, messages and allowed child update surfaces.

### Manager / Owner

Answers questions about:

- what needs attention today
- children requiring follow-up
- staff pending items
- expiring documents
- unresolved issues

Uses garden-scoped data only.

### Inspector

Answers questions about:

- kindergartens needing inspection
- unresolved findings
- increasing risks
- complaints requiring review

Uses assigned inspection and supervision data only.

### Admin

Answers questions about:

- kindergartens needing attention
- operational risks
- subscriptions at risk
- platform trends

Uses executive-level platform data, still without automatic decisions.

## Context Sources

The assistant can summarize from:

- inspections
- incidents
- child timeline data
- compliance
- observer signals
- documents
- tasks
- communications
- payments
- cameras

Each role receives only the sources allowed for that role.

## Permission Model

Permission modes:

- `admin_global`
- `garden_scoped`
- `parent_child_scoped`
- `staff_scoped`
- `inspector_assignment_scoped`

The assistant never bypasses route permissions, RLS policies or role boundaries. Parents do not get raw AI events, investigation data, staff notes or other child data.

## Suggested Actions

The assistant may suggest actions such as:

- complete a document
- review an inspection
- send a reminder
- schedule follow-up
- open a dashboard page

Suggested actions are links or recommendations only. No automatic execution is performed.

## Daily Briefings

Role-specific daily briefings:

- Parent: child summary and missing parent actions.
- Staff: shift summary and open tasks.
- Manager: kindergarten operational summary.
- Inspector: inspection workload summary.
- Admin: executive operational summary.

## Notification Intelligence

The assistant groups insights into:

- urgent
- important
- informational

This reduces notification overload without hiding data.

## Privacy Rules

- No hallucinated data.
- No automatic decisions.
- No automatic disciplinary action.
- No unauthorized data access.
- No parent access to raw observer signals.
- No child profiling.
- No staff scoring exposed to parents.

## Remaining Gaps

- External AI provider activation remains off until configured and reviewed.
- Natural language search is deterministic and limited to known prompts for now.
- Response quality review UI is not yet exposed to admins.
- Usage analytics are stored, but trend dashboards can be expanded later.

# Enterprise Task, Workflow & Automation Platform

PHASE 127 creates one workflow network for Gan Batuach. It does not replace existing task pages or business modules. It adds a unified layer so every process can be tracked, assigned, verified, escalated and audited from one model.

## Workflow Model

The core lifecycle is:

Trigger -> Workflow -> Task -> Assignment -> Action -> Approval or Verification -> Closure

New tables:

- `workflow_templates`: reusable process templates for onboarding, inspections, complaints, incidents, compliance, document renewal, observer review and system recommendations.
- `workflows`: the parent process record. It stores type, source, owner, priority, status and service target.
- `workflow_tasks`: the unified task inbox item. Existing `tasks` are linked here through `workflow_task_id`.
- `workflow_approvals`: approval steps for documents, onboarding, inspections, complaints and payments.
- `workflow_escalations`: overdue, ignored or critical work requiring attention.
- `workflow_audit_events`: audit trail for creation, assignment, status changes, approvals, escalations and closure.

Existing `tasks` remains active and is bridged into the new model. This avoids duplicate systems while preserving current screens.

## Automation Model

Automation rules are stored in `workflow_automation_rules`.

Prepared rules:

- Low inspection score -> follow-up inspection task
- Certification expiring in 30 days -> document renewal task
- Critical complaint -> inspector/admin escalation
- Observer signal -> human review task

All prepared rules require human review. No automatic enforcement, accusations or disciplinary action is enabled.

## SLA Model

`workflow_sla_rules` tracks response, completion and escalation targets by workflow type and priority.

Examples:

- Critical incident: fast response and escalation
- Complaint: manager or inspector response window
- Inspection: completion and follow-up window
- Compliance: renewal and verification window
- Document renewal: reminder, upload and approval window

The dashboard calculates workflow health from overdue tasks, open escalations and pending approvals.

## Escalation Model

Escalation is prepared for:

- overdue tasks
- ignored tasks
- critical findings
- unresolved incidents
- pending approvals

Escalations are tracked separately from the task so the original task history remains clear.

## Audit Model

Every workflow action can be recorded in `workflow_audit_events`.

Audit coverage includes:

- workflow creation
- legacy task linking
- task assignment
- status changes
- approval decisions
- escalations
- verification and closure

This model supports internal review and future external audit requirements.

## User Experience

Routes:

- `/dashboard/admin/workflows`: admin workflow command center
- `/dashboard/tasks`: unified role-aware task inbox

The shared inbox filters by role and permissions. Admins see all tasks. Managers and owners see garden work. Staff, parents and inspectors see only scoped assignments.

## Privacy And Permissions

The migration enables RLS on all workflow tables.

Read/write access is limited to:

- admins
- assigned users
- creators
- users with scoped garden access

The workflow layer does not bypass role permissions. It gives existing modules one shared operational record.

## Remaining Production Work

- Add write actions directly from `/dashboard/tasks` for completing and approving workflow tasks.
- Route all future module-created tasks through `workflow_tasks` first, then mirror to legacy `tasks` only when needed.
- Add user-facing approval forms for each approval type.
- Connect real notification delivery to workflow escalation events.
- Add background jobs for automatic overdue detection and SLA escalation.

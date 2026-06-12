# Enterprise Administration, Multi-Network Management & Regional Operations

## Purpose

Phase 141 prepares Gan Batuach for large-scale operation across multiple kindergartens, private networks, franchise operators, educational groups, municipalities, regional supervisors and future national operations.

The core principle remains tenant isolation. A kindergarten never sees another kindergarten's data unless an explicit network, regional or administrative assignment grants that access.

## Organizational Model

The enterprise model introduces:

- `kindergarten_networks`
- `network_kindergartens`
- `network_manager_assignments`
- `enterprise_regions`
- `enterprise_supervisor_assignments`
- `enterprise_operational_metrics`
- `enterprise_communication_notices`
- `enterprise_task_rollups`
- `enterprise_audit_logs`

Supported network types:

- private network
- franchise
- educational group
- municipal group

## Hierarchy Model

The target hierarchy is:

Country
→ Region
→ City
→ Network
→ Kindergarten

The model supports partial rollout. A kindergarten can operate without a network, then later be attached to a network or region without data migration.

## Network Permissions

The `network_manager` role is prepared for scoped enterprise management.

Network managers can view:

- assigned networks
- kindergartens in assigned networks
- performance rollups
- compliance rollups
- inspection rollups
- safety and risk rollups
- subscription overview if configured

Network managers cannot access:

- unassigned kindergartens
- private child-level data outside permitted scopes
- unrelated parent data
- unrelated staff data
- raw evidence or investigations unless explicitly permitted by policy

Access is enforced through:

- `network_manager_assignments`
- `can_access_network(network_id)`
- updated `can_access_garden(garden_id)`
- row-level security policies

## Regional Supervision Model

Regional and municipal supervision is represented by:

- `enterprise_regions`
- `enterprise_supervisor_assignments`
- existing `inspection_regions`
- existing `inspector_assignment_history`

Assignment scopes can include:

- country
- region
- municipality
- city
- network
- kindergarten

This allows future municipal reporting and regional supervision without weakening kindergarten isolation.

## Analytics Model

Enterprise analytics use rollups instead of exposing raw personal records.

Tracked areas:

- operational health
- compliance
- safety
- inspection coverage
- parent engagement
- staffing readiness
- financial readiness
- open incidents
- unresolved findings
- overdue inspections
- expiring subscriptions

The dashboard at `/dashboard/admin/enterprise` combines these rollups with existing rating, risk, inspection, billing and compliance data.

## Communication Model

Enterprise communication notices support:

- network announcements
- regional updates
- compliance notices
- emergency notices

Delivery can target:

- managers
- owners
- inspectors
- staff
- parents
- all users

Actual sending should still flow through the unified communications system.

## Audit Model

`enterprise_audit_logs` tracks:

- network creation and changes
- kindergarten-network assignment
- network manager assignment
- regional supervisor assignment
- permission-related actions
- enterprise communication actions

This creates a reviewable trail for external audit and operational governance.

## Remaining Gaps

- Add write forms for creating networks and assigning managers directly in the dashboard.
- Add automated rollup jobs for `enterprise_operational_metrics`.
- Add scoped network-manager versions of analytics pages where needed.
- Connect enterprise notices to the unified messaging delivery layer.
- Add legal review for municipal/public transparency reporting.

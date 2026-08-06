# PRODUCT REALITY FIX 1 - Live Data / Readiness Binding Pattern

## Standard Product Reality Contract

Every visible card/action should follow this pattern:

| Required part | Rule |
|---|---|
| Data source | Use real DB/API data, synthetic QA data, or an explicit readiness source. |
| Loading state | Show loading only while data is genuinely loading. |
| Error state | Show a clear safe message, not fake successful data. |
| Empty state | Explain what is missing and what happens next. |
| Disabled state | Explain why disabled: policy, setup, legal, provider, role or pilot scope. |
| CTA behavior | Link to a real route, submit a real action, or open a truthful readiness state. |
| Permission behavior | Block with clear role/permission explanation. |
| Demo/readiness label | Mark demo/readiness/manual/sandbox states honestly. |
| Values | Never invent counts, dates, payment success, camera live status or AI conclusions. |

## Helper Components Already Available

The app already has patterns that can continue to be used:

- `ParentMetricCard`
- `ParentEmptyState`
- `TeacherStatCard`
- `TeacherCompactItem`
- `AppStatusCard`
- readiness/status badges in admin/provider modules

## Added In This Phase

Added a shared Israel date helper instead of hardcoded dates.

## Next Implementation Preference

Use existing components and small helpers rather than adding a new large component system.

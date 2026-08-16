# DEMO AUTH SETUP 1 - Script Results

Date: 2026-08-13T22:39:44.852Z

No passwords are printed in this report.

| Account | Email | Role | Status | Note |
|---|---|---|---|---|
| parent_assigned | parent.1@demo.ganbatuach.com | parent | UPDATED | Assigned parent. Existing full demo seed normally links this user to Child A in Gan Rakefet. |
| parent_unassigned | qa.parent.unassigned@demo.ganbatuach.com | parent | UPDATED | Unassigned parent. Must have no child/garden link for no-child/no-enrollment QA. |
| manager | manager.rakefet@demo.ganbatuach.com | manager | UPDATED | Existing full demo seed normally provides Kindergarten A assignment. |
| staff_assigned | staff.1@demo.ganbatuach.com | staff | UPDATED | Assigned staff. Existing full demo seed normally assigns this user to Gan Rakefet. |
| staff_unassigned | qa.staff.unassigned@demo.ganbatuach.com | staff | UPDATED | Profile-only user. Must have no garden assignment for unassigned-state QA. |
| inspector_assigned | inspector.yael@demo.ganbatuach.com | inspector | UPDATED | Assigned inspector. Existing full demo seed normally assigns this user to Gan Rakefet and Gan Oranim. |
| inspector_unassigned | qa.inspector.unassigned@demo.ganbatuach.com | inspector | UPDATED | Profile-only user. Expected to reach pending/apply inspector state. |
| admin | admin-demo@demo.ganbatuach.com | admin | UPDATED | Existing full demo seed normally provides admin access. |
| digital_observer | qa.digital.observer@demo.ganbatuach.com | network_manager | UPDATED | Creates a standalone observer site and owner membership when possible. |

If any account is SKIPPED_MISSING_LOCAL_PASSWORD, add the matching password variable to an ignored local env file and rerun.

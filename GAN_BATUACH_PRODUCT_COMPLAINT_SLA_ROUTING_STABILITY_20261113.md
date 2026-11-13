# Complaint escalation routing stability — Development

Task: `GB-PRODUCT-COMPLAINT-SLA-CLOSURE-JOURNEY-20261113`
Source baseline: `c326c786b8151b6184169a3cb00dc9555fb42591`
Scope: the service-role-only `escalate_overdue_complaints` function and one rollback-only regression.

The first routing loop in the prior function included complaints already marked `escalated`. On a later scan it could restore the current Garden Inspector as assignee and route the case away from the Admin queue. The second SLA loop already excluded `escalated`. The new ordered migration excludes `escalated` from the first loop too; it keeps the function signature, service-role-only grant, owner, `SECURITY DEFINER`, `search_path`, batch limits, locks and other transitions.

An isolated Development transaction using an existing synthetic escalated complaint reproduced `escalated_complaint_rerouted_on_repeat_scan` before the replacement. The same transaction with the proposed replacement passed: the escalated case stayed in the Admin queue, its target task assignment and event/audit counts did not change, and a separate in-progress case still routed to the approved Inspector with one event. Both transactions rolled back. No additional complaint was created. Protected receipt: `exports/restricted/complaint-sla-routing-stability-20261113/rollback-regression.json` (SHA-256 `36c192b1125bf4066cf7bfc9a34e56c5c1cf5460d61be4668f8b79c4d692736f`). The original existing QA rows were not permanently changed.

`npm run qa:migrations` passed with 263 ordered files and no new destructive migration. Focused complaint checks passed 6/6, and release-contract validation passed. Source-level and rollback-only tests do not establish the full Parent → Garden → Admin/Inspector complaint closure journey; that remains in this card after the migration is preserved and applied to isolated Development. No Production migration or release is authorized. The all-in cost ceiling remains unverified with owner-reported zero paying users.

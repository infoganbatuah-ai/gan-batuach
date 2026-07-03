# PILOT FIX 7 - AI Capability Matrix

| Role | Allowed | Denied / Locked |
| --- | --- | --- |
| anonymous/public | Public AI readiness wording only | AI events, review queue, evidence, provider diagnostics, secrets |
| parent without approved child link | No AI event access | Raw AI, candidate events, review queue, confidence scores, evidence, parent summaries |
| parent with approved child link | Only reviewed parent-safe summaries if separately approved | Raw AI, internal queue, confidence, model diagnostics, evidence involving other children |
| staff unassigned | No AI access | Review queue, raw AI, evidence, AI notifications |
| staff assigned | No AI access by assignment alone | Raw AI, confidence, evidence, automatic accusations |
| kindergarten manager pending | Readiness/pending state only | Review queue and AI events before approval |
| kindergarten manager active | Own-kindergarten readiness and, if policy allows, internal review queue | Other kindergartens, provider secrets, automatic parent summaries, automatic accusations |
| inspector unassigned | Pending/unassigned state only | AI events, gardens, review queue |
| inspector assigned | Assigned-kindergarten readiness/reviewable signals if policy allows | Unassigned gardens, provider secrets, final determinations |
| admin | Operational status, review queue, redacted diagnostics | AI provider secrets, unrestricted raw evidence links |
| Digital Observer customer/admin | Own-site AI readiness/review according to product scope | Gan Batuach child data, Gan Batuach restricted capabilities |

Required result: parents cannot see raw AI candidate events, review queues, confidence scores, model diagnostics, or raw evidence. Staff does not receive AI access by assignment alone. Admin diagnostics must remain redacted.


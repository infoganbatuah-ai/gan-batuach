# DIGITAL OBSERVER — DEFERRED FROZEN SECURITY FINDINGS

Date: 2026-09-07

This register contains only findings whose durable fix would materially change the Camera / Connector / Gateway area frozen while PUSH 16 awaits independent real-hardware verification.

## DEFERRED UNTIL PUSH 16 CLOSES

### DO-SEC-25-FROZEN-001 — Billing-only membership is broader than intended in frozen camera/evidence RLS

| Field | Value |
|---|---|
| Severity | HIGH |
| Exploitability | Authenticated, same-site privilege overreach; a valid billing-only membership is required |
| Critical / remotely exploitable | NO |
| Affected contract | `public.can_access_observer_site` and frozen policies that depend on it, including camera-source and event-clip reads |
| Current consequence | A billing-only member may be able to read safe camera metadata and evidence-record metadata directly through the database API, despite not being a general Observer viewer |
| Not exposed by this finding | Cross-tenant data, camera credentials, storage write access, permanent media URLs, raw video bytes, anonymous access |
| Why deferred | Correct repair requires splitting the shared site-access helper and reapplying frozen camera/evidence RLS policies. That is a semantic change to source/media authorization immediately before the blocked PUSH 16 real-hardware proof |
| Temporary mitigation | Product/API authorization now excludes `billing` from general camera, Incident and Evidence viewing. Do not provision billing-only site memberships until the database helper is split; remove or upgrade any existing billing-only membership through an authorized owner/admin workflow |
| Required closure | After PUSH 16 closes, create distinct `can_view_observer_site` and `can_bill_observer_site` helpers, reapply camera/evidence/subscription policies, and run least-privilege live role tests before PUSH 17 proceeds |
| Owner / future gate | Camera authorization / PUSH 17 security prerequisite, followed by dependency-sensitive PUSH 25 revalidation |

The affected public columns intentionally omit camera credentials and event-clip storage paths. Media bytes still require an authenticated, authorized server route and a 60-second signed URL. This reduces impact but does not make the role overreach acceptable as a permanent state.

## DECISION

No CRITICAL or anonymously/remotely exploitable frozen-area vulnerability was found. The one HIGH finding is explicitly bounded, has a route-layer mitigation, and is scheduled as a mandatory post-PUSH16 prerequisite rather than silently accepted.


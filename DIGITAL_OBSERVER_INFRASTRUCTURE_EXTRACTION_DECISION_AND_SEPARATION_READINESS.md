# Digital Observer Infrastructure Extraction Decision And Separation Readiness

## Scope

Phase 182 prepares the decision framework for separating Digital Observer from Gan Batuach.

This phase does not:

- create a new GitHub repository
- create a new Supabase project
- create a new Vercel project
- move production data
- break Gan Batuach
- duplicate shared engines

## Decision Model

Decision states:

- `not_ready`
- `keep_inside_gan_batuach`
- `monorepo_recommended`
- `separate_vercel_ready`
- `separate_supabase_ready`
- `separate_repo_ready`
- `full_separation_ready`

Decision factors:

- paying customers
- product usage
- camera setup success
- support load
- billing separation
- legal readiness
- data boundaries
- technical complexity

Current recommendation:

**Keep Digital Observer inside Gan Batuach for now.**

Reason:

Paid beta evidence is not yet strong enough to justify a full infrastructure split. Digital Observer should first validate real paid usage, support load, camera setup success and legal readiness.

## GitHub Strategy

### Option A: Single Monorepo

Recommended as the next architecture step.

Pros:

- shared packages
- easier Codex context
- one source of truth
- easier shared engine development

Cons:

- larger repository
- requires careful boundaries

### Option B: Separate Repositories

Future-only for now.

Pros:

- stronger product separation
- cleaner permissions

Cons:

- shared package complexity
- duplicated setup
- harder synchronization

## Vercel Strategy

### Current

Same Vercel project with route-based separation:

`/digital-observer`

### Recommended Next Step

Separate Vercel projects from the same monorepo after paid beta validation:

- Gan Batuach project: `apps/gan-batuach`
- Digital Observer project: `apps/digital-observer`

Do not create the Vercel project yet.

## Supabase Strategy

### Current

Same Supabase project with:

- product type separation
- `observer_site_id` separation
- RLS enforcement
- billing stream separation

### Recommended Later

Hybrid transition model before a separate Supabase project.

Separate Supabase is higher risk because it requires:

- auth mapping
- RLS migration
- storage split
- audit continuity
- backup/restore planning
- rollback rehearsal

Do not create a new Supabase project yet.

## Domain Strategy

Current route:

`/digital-observer`

Future options:

- `observer.gan-batuach.co.il`
- `digital-observer.co.il`
- `app.digitalobserver.ai`
- `app.digital-observer.co.il`

Recommended first custom domain:

`observer.gan-batuach.co.il`

Reason:

It preserves a bridge to the existing brand and has the simplest rollback path.

## Data Boundary Map

### Gan Batuach Only

- children
- parents
- staff
- inspections
- kindergarten billing
- parent tuition payments
- child medical records

### Digital Observer Only

- observer sites
- observer subscriptions
- observer usage tracking
- observer site members
- standalone observer billing

### Shared Core

- camera infrastructure
- observer signals
- audit logs
- AI models
- workflows
- notifications
- capability matrix

## Shared Core Map

Future package plan:

```text
apps/
  gan-batuach/
  digital-observer/

packages/
  observer-core/
  camera-core/
  ai-core/
  workflow-core/
  audit-core/
  notification-core/
  billing-core/
  analytics-core/
  ui-core/
```

Readiness summary:

- `audit-core` and `analytics-core` are closest to reusable.
- `observer-core`, `camera-core`, `ai-core`, `workflow-core`, `notification-core` and `ui-core` need boundary cleanup.
- `billing-core` is unsafe to move now because the three revenue streams must remain strictly separated.

## Migration Readiness

Future separation should identify:

- tables to copy
- tables to split
- tables to keep shared
- foreign keys to replace
- `garden_id` dependencies to remove
- `observer_site_id` dependencies to preserve
- auth user mapping
- storage buckets to split

No data migration is performed in this phase.

## Authentication Strategy

Preferred future model:

Shared identity layer with product access.

Why:

- lower user friction
- supports cross-product admins
- avoids premature auth migration

Separate Supabase Auth should wait until Digital Observer has validated standalone scale and migration rehearsals.

## Billing Separation

The three revenue streams must remain separate:

1. Gan Batuach subscription  
   Kindergarten → Gan Batuach

2. Parent tuition payments  
   Parent → Kindergarten

3. Digital Observer subscription  
   Digital Observer customer → Digital Observer product account

Do not mix:

- invoices
- dashboards
- accounting exports
- payment provider accounts
- revenue reports

## Storage Separation

Gan Batuach storage:

- child documents
- parent files
- staff files
- inspection evidence
- medical documents
- signatures

Digital Observer storage:

- site documents
- camera snapshots if allowed
- incident evidence
- observer reports
- invoices

Shared storage:

- public assets
- product documentation

No files are moved in this phase.

## Camera Gateway Strategy

Digital Observer may eventually need:

- separate product gateway
- per-customer gateway option
- customer-isolated credentials
- bandwidth and stream cost controls

Current recommendation:

Keep the shared gateway while paid beta is small, but require a per-product gateway assessment before paid scale.

## AI / Observer Strategy

Digital Observer Core can contain broad capability registry and model infrastructure.

Gan Batuach must continue using its regulatory profile:

- audio disabled
- face recognition disabled
- human review required
- raw AI blocked from parents

Sensitive Digital Observer capabilities should remain capability-matrix gated.

## Support And Operations

Recommended near-term support model:

One shared support center with product type, SLA and owner fields.

Future model:

Separate support queues once Digital Observer ticket volume justifies it.

## Cost Estimate

Scenarios tracked:

- keep inside Gan Batuach
- separate Vercel only
- separate Vercel + Supabase
- full repo separation

The current low-risk option is to keep Digital Observer inside Gan Batuach until paid beta evidence improves.

## Risk Register

Highest risks:

- billing stream confusion
- data migration mistakes
- auth split complexity
- camera gateway isolation
- Supabase migration and backup/restore complexity
- legal review still pending
- customer disruption during cutover

Critical blockers prevent full separation.

## Rollback Plan

If future separation fails:

- keep Digital Observer under `/digital-observer`
- disable new domain routing
- keep data in the original Supabase project
- revert app routing
- preserve customers
- preserve billing

Rollback must not delete data or interrupt existing Gan Batuach operation.

## Final Recommendation

**Do not perform full infrastructure separation yet.**

Recommended path:

1. Keep Digital Observer inside Gan Batuach.
2. Continue paid beta evidence collection.
3. Harden product boundaries and admin product switcher.
4. Prepare monorepo restructure plan.
5. After paid beta validation, consider separate Vercel project from the same monorepo.
6. Defer separate Supabase and separate repository until migration rehearsals and revenue justify the complexity.

## PHASE 183 Readiness

Digital Observer is ready for a Phase 183 focused on:

- paid beta evidence collection
- customer retention and support metrics
- package/pricing validation
- monorepo boundary hardening
- dry-run migration inventory

Digital Observer is not yet ready for full production infrastructure extraction.

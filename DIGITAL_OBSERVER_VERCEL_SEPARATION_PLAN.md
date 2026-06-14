# Digital Observer Vercel Separation Plan

## Purpose

Prepare Digital Observer for future separate Vercel deployment without changing production infrastructure in this phase.

## Current State

Gan Batuach project:

- same GitHub repository
- same Vercel project
- same Supabase project
- Digital Observer served from `/digital-observer`

## Option A: Same Vercel Project

Current recommended mode.

Route:

`/digital-observer`

Benefits:

- lowest risk
- no DNS change required
- Gan Batuach remains untouched
- simplest rollback

## Option B: Separate Vercel Project From Same Repository

Recommended future step after paid beta validation.

Model:

- same GitHub repo
- separate Vercel project
- Digital Observer custom host routes to Digital Observer pages
- shared codebase remains intact

Required readiness:

- environment variable group for Digital Observer
- product context helper
- QA checklist complete
- custom domain validated
- rollback plan rehearsed

## Option C: Future Monorepo Root Directories

Future target:

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
  analytics-core/
  billing-core/
  ui-core/
```

Do not restructure in this phase.

## Domain Setup

Possible domains:

- `observer.gan-batuach.co.il`
- `digital-observer.co.il`
- `app.digitalobserver.ai`
- `app.digital-observer.co.il`

Recommended first domain:

`observer.gan-batuach.co.il`

## Required Vercel Steps Later

1. Create or configure a Digital Observer Vercel project.
2. Connect the same GitHub repo.
3. Configure Digital Observer env vars.
4. Add the selected custom domain.
5. Verify SSL.
6. Run QA checklist.
7. Keep `/digital-observer` active as fallback.

## Rollback

If the separate Vercel setup fails:

- remove custom domain routing
- point traffic back to the current Gan Batuach Vercel project
- keep `/digital-observer` active
- keep shared Supabase
- preserve customers, leads and billing records

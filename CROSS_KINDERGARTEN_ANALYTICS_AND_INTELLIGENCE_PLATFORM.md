# Cross Kindergarten Analytics And Intelligence Platform

## Goal

The analytics platform moves Gan Batuach from single-kindergarten management into national ecosystem intelligence. It compares trends, performance, safety, compliance, inspection activity, parent engagement, staff completion and observer readiness across multiple kindergartens and regions.

## Analytics Model

Core analytics surfaces:

- `/dashboard/admin/analytics-center`
- `cross_kindergarten_analytics_snapshots`
- `kindergarten_benchmark_profiles`
- `regional_analytics_snapshots`
- `analytics_intelligence_insights`

The dashboard reads from existing operational systems:

- gardens
- kindergarten rating profiles
- risk profiles
- inspections
- national compliance findings
- complaints
- incident cases
- compliance alerts
- observer intelligence signals
- observer calibration profiles
- parent engagement events
- video stream sessions
- documents
- tasks
- attendance
- AI assistant usage analytics

## Benchmarking Model

Benchmarking compares kindergartens using:

- safety score
- compliance score
- inspection score
- parent engagement count
- staff completion signals
- observer readiness
- national average
- percentile rank

Percentiles are calculated from available aggregate rating scores. No child or parent personal data is used for ranking.

## Regional Model

Regional analytics support:

Country → Region → City → Kindergarten

Current region grouping uses `region` when available and falls back to `city`. Metrics include:

- active kindergarten count
- safety average
- compliance average
- inspection score
- observer score
- child/staff aggregate counts

## Trend Model

Trend readiness supports:

- daily
- weekly
- monthly
- quarterly
- yearly

The initial dashboard focuses on 30-day and 60-day operational windows for complaints, incidents, observer signals, engagement and inspections.

## Intelligence Model

The AI insights layer is evidence-bound. Examples:

- region compliance average based on available scores
- complaint volume change compared with the previous period
- inspection closure rate
- rising risk count

Unsupported claims are explicitly avoided. The `analytics_intelligence_insights` table includes `unsupported_claim` and must remain `false` for production insights.

## Privacy Model

Rules:

- No private child data is exposed.
- No personal parent information is exposed.
- Parent engagement is aggregated.
- Camera usage is counted only as approved viewing sessions.
- Documents are counted by status, not shown with private content.
- Risk and ratings are admin-only and not public by default.

## Governance Model

Governance requirements:

- analytics are admin-only through RLS
- public analytics are future readiness only
- public transparency reports require a separate approval/filtering layer
- any public metric must remove sensitive data and avoid small-group reidentification
- analytics are advisory and do not trigger automatic enforcement

## Executive Dashboards Added

The analytics center includes:

- national operations KPIs
- safety and compliance trends
- growth/readiness signals
- kindergarten benchmarking
- regional analytics
- inspector workload analytics
- parent engagement analytics
- staff completion analytics
- observer and risk analytics
- AI executive insight prompts

## Remaining Gaps

- Scheduled snapshot jobs are not yet active.
- Regional taxonomy should be normalized beyond city fallback.
- Public analytics reports remain disabled until legal/privacy review.
- Trend charts can be expanded after more historical snapshots accumulate.
- Benchmarking should be recalculated by a scheduled job for production scale.

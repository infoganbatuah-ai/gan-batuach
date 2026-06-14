# CI/CD Security Gates, SAST, DAST, Dependency & Secret Scanning Platform

Phase 157 creates the security gate architecture for Gan Batuach and future Digital Observer verticals.

No production deployment should be considered ready unless type checking, build, dependency scanning, secret scanning and SAST readiness have passed.

## GitHub Actions Architecture

Workflow:

- `.github/workflows/security-checks.yml`

Triggers:

- `pull_request`
- `push` to `main`
- `push` to `master`
- `workflow_dispatch`

Blocking gates:

- `npm ci`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- `npm audit --audit-level=high`
- secret marker scanning
- CodeQL JavaScript/TypeScript analysis
- migration safety readiness checks

Existing workflows are not removed:

- `.github/workflows/deploy.yml`
- `.github/workflows/production-checks.yml`

## Security Checks

Security checks cover:

- TypeScript correctness
- production build readiness
- dependency vulnerability gate
- secret scanning readiness
- CodeQL SAST readiness
- migration safety readiness
- branch protection readiness
- Vercel deployment gate readiness

Critical vulnerabilities block production readiness.

High vulnerabilities also block production readiness unless explicitly accepted with:

- reason
- expiration date
- reviewer
- mitigation plan

## Dependency Scanning

Current gate:

- `npm audit --audit-level=high`

Future-ready:

- GitHub Dependabot alerts
- Dependabot PR workflow
- Snyk dependency scanning
- lockfile review for major updates

Dependabot process:

1. Dependabot opens PR.
2. Security checks run.
3. Lockfile diff is reviewed.
4. High or critical findings must be fixed or accepted as temporary risk.
5. Major version upgrades require manual regression review.

## Secret Scanning

Current readiness gate scans for committed markers related to:

- Supabase service role keys
- API keys
- payment provider secrets
- WhatsApp tokens
- SMS provider keys
- encryption keys
- private URLs
- RTSP URLs
- camera credentials
- gateway secrets

Real secrets must never be committed.

Server-only variables must not use `NEXT_PUBLIC`.

Public variables allowed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SANDBOX_MODE`

Server-only examples:

- `SUPABASE_SERVICE_ROLE_KEY`
- `FIELD_ENCRYPTION_KEY_CURRENT`
- `FIELD_HASH_PEPPER`
- `VIDEO_GATEWAY_API_KEY`
- `VIDEO_GATEWAY_SIGNING_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `SMS_API_KEY`
- `EMAIL_API_KEY`
- `OPENAI_API_KEY`
- `AI_OBSERVER_SECRET`

Recommended next step:

- Enable GitHub Secret Scanning or Gitleaks/Semgrep for broader signature coverage.

## CodeQL Readiness

Configured for:

- JavaScript
- TypeScript

Security concern areas:

- injection
- unsafe redirects
- exposed secrets
- unsafe file access
- authentication bypass
- authorization bugs
- insecure deserialization patterns

Optional future providers:

- Snyk Code
- SonarQube
- Semgrep
- GitHub Advanced Security

These are provider-ready, not required for this phase.

## DAST Readiness

DAST should run only against staging and only with non-destructive checks.

Targets:

- login
- parent routes
- manager routes
- admin routes
- camera routes
- API routes
- upload routes
- payment routes

Do not automatically run destructive tests.

Future options:

- OWASP ZAP baseline scan
- Semgrep rules
- Snyk runtime testing

## Vercel Deployment Gate

Production deployment should be allowed only after:

- typecheck passed
- build passed
- security checks passed
- dependency audit passed
- no leaked secrets
- no critical vulnerabilities
- high vulnerabilities fixed or accepted with documented risk

Vercel should be connected to GitHub required checks.

Recommended Vercel policy:

- preview deployments allowed for PR checks
- production deployment only from protected branch
- production environment requires passing GitHub checks
- sensitive environment variables configured only in Vercel dashboard

## Security Headers

`vercel.json` already includes:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Current CSP is production-oriented but still allows inline script/style for Next.js compatibility.

Next tightening step:

- move toward nonce-based scripts
- remove `unsafe-eval`
- review third-party image/media/connect sources
- add CSP report endpoint if needed

## Supabase Migration Safety Checklist

Every migration should be reviewed for:

- `create table if not exists`
- `add column if not exists`
- no invalid enum/check values
- idempotent inserts with `on conflict`
- no unsafe drops
- no broad deletes
- RLS enabled on sensitive tables
- policies created after new sensitive tables
- no public storage buckets for sensitive data
- no parent access to raw AI events
- no direct camera URL exposure
- no plaintext medical data added

Scanner/readiness targets:

- tables without RLS
- tables with RLS but no policies
- sensitive tables with broad access
- parent-accessible tables
- camera tables
- medical tables
- document tables
- audit tables

## Branch Protection Recommendations

Required GitHub branch protection:

- require pull request before merge
- require review before merge
- require passing checks
- require `npm run typecheck`
- require `npm run build`
- require `security-checks`
- require CodeQL/code scanning where enabled
- prevent force push
- restrict direct pushes to `main`
- require conversation resolution

## PR Security Checklist

Every PR should confirm:

- no secrets
- no broad RLS
- no public sensitive buckets
- no raw camera URLs
- no plaintext medical data
- no parent raw AI access
- no disabled auth checks
- no unsafe admin routes
- no destructive migration without review

## Database Tracking Model

Tables:

- `security_pipeline_runs`
- `security_pipeline_findings`
- `security_pipeline_controls`

Findings track:

- finding type
- severity
- source
- status
- owner
- remediation
- accepted risk reason
- accepted risk expiration
- mitigation plan
- resolution status

Statuses:

- `open`
- `triaged`
- `accepted_risk`
- `fixed`
- `verified`

Only admin/security owners should accept risk.

## Audit Events

Security pipeline events should be immutable-audited:

- security scan completed
- security scan failed
- finding created
- finding accepted
- finding resolved
- production readiness changed

Future GitHub webhook/import job should write scan results into `security_pipeline_runs`.

## Remaining External Provider Setup

- Enable GitHub branch protection.
- Enable Dependabot alerts.
- Enable GitHub code scanning alerts.
- Decide whether to use GitHub Secret Scanning, Gitleaks, Semgrep, Snyk or SonarQube.
- Add staging-only DAST after staging data and rate limits are safe.
- Add Supabase schema scanner for RLS and storage bucket exposure.
- Wire GitHub Actions run results into the admin dashboard.

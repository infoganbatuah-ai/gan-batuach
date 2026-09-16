# Deferred release queue — 2026-09-17

Owner: nightly release coordinator (`automation-3`). Production base verified in Vercel: `8113d060`; locally fetched `origin/main` is the same SHA. This is an inventory and handoff, **not** permission to deploy. No production action was taken.

## Supplier window and release gate

- Vercel Pro cycle shown in dashboard: 8 September 10:00–8 October 10:00. On 17 September, included infrastructure credit was $20/$20 and on-demand charge was $1.11. The next scheduled coordinator check is 9 October 00:00 Asia/Jerusalem, after the displayed cycle end; it must verify actual renewed credit before any build.
- Supabase Pro cycle is 13 September–13 October. Dashboard says its Pro quota has not been exceeded; Supabase is not the present credit blocker. Backup and migration readiness still require verification.
- Zero active paying users. All-provider cost and the ₪15 per paying-user ceiling are not established. No release can be certified until that is reconciled.
- Main Vercel project is set to “Only build production”; two other team projects display “Connect Git Repository.” Verify branch push impact again immediately before any push.

## Release candidates

| Item | Current state | Gate / next action |
| --- | --- | --- |
| [PR #57](https://github.com/infoganbatuah-ai/gan-batuach/pull/57), management messaging | Pushed, open, not deployed | Prior exact-head CI green; recheck current head and six gates, Supabase migration order, backup/restore, all-provider cost, and Vercel headroom before merge. |
| [PR #28](https://github.com/infoganbatuah-ai/gan-batuach/pull/28), PUSH 38 | Draft, blocked; local commit `ae0fc714` remains unpublished | Failed gates and private OTA delivery/signing/live qualification prerequisites; do not push or activate until approved and verified. |
| SEO branch `codex/seo-content-completion` | Local merge tip `03ca7e7a`; tree is identical to current `origin/main` | Content is already included upstream; verify no unique work before marking superseded. No branch push needed for release. |
| Detached security/observability `13d1317d` | Local-only commit and overlapping root modifications | Assign owner, reconcile against current base in a scoped worktree, validate role/security and observability changes, then commit/push eligible files. |
| Shared root modifications and untracked files | Mixed owner, uncommitted, not eligible as one snapshot | Inspect each exact path below, assign owner, exclude secrets/artifacts, split into scoped branches, run relevant tests and six CI gates before release. |

## Shared root path inventory

70 `git status --porcelain=v1 -uall` entries at inventory time. Nested `worktrees/` paths are separate checkouts and must be reviewed as worktrees, not added as root files.

```text
 M .github/workflows/security-checks.yml
 M AGENTS.md
 M DIGITAL_OBSERVER_AUTOMATED_QA_RESULTS.md
 M DIGITAL_OBSERVER_CI_TEST_MANIFEST.md
 M app/api/digital-observer/access-settings/route.ts
 M app/api/digital-observer/auth/login/route.ts
 M app/api/digital-observer/billing/route.ts
 M app/api/digital-observer/conversation/route.ts
 M app/api/digital-observer/event-clips/[id]/media/route.ts
 M app/api/digital-observer/events/review/route.ts
 M app/api/digital-observer/identity-candidates/[id]/preview/route.ts
 M app/api/digital-observer/identity-candidates/route.ts
 M app/api/digital-observer/incidents/feedback/route.ts
 M app/api/digital-observer/investigation/route.ts
 M app/api/digital-observer/known-people/route.ts
 M app/api/digital-observer/settings/route.ts
 M app/api/digital-observer/watch-requests/route.ts
 M app/api/digital-observer/watch-rules/route.ts
 M app/api/privacy/requests/route.ts
 M app/api/video-gateway/event-manifest/route.ts
 M app/layout.tsx
 M app/page.tsx
 M app/robots.ts
 M app/safety-standard/page.tsx
 M app/sitemap.ts
 M components/brand-header.tsx
 M components/dashboard-shell.tsx
 M components/digital-observer/observer-app-shell.tsx
 M config/digital-observer-ci-gates.json
 M next.config.ts
 M package.json
 M proxy.ts
 M scripts/qa/build-ci-test-manifest.mjs
 M scripts/qa/check-event-outbox.mjs
 M scripts/qa/run-completion-role-boundary-probes.mjs
 M services/video-gateway/journal-loop.mjs
?? DIGITAL_OBSERVER_OBSERVABILITY_MATRIX.md
?? DIGITAL_OBSERVER_POST_PUSH18_LIVE_VIEW_REPORT.md
?? DIGITAL_OBSERVER_PUSH_25_SECURITY_PRIVACY_REPORT.md
?? DIGITAL_OBSERVER_PUSH_27_OBSERVABILITY_REPORT.md
?? DIGITAL_OBSERVER_SECURITY_CONTROL_MATRIX.md
?? DIGITAL_OBSERVER_SECURITY_DEFERRED_FINDINGS.md
?? DIGITAL_OBSERVER_SLI_SLO_CATALOG.md
?? RELEASE_RECONCILIATION_2026-09-15.md
?? RELEASE_RECONCILIATION_2026-09-16.md
?? RELEASE_RECONCILIATION_2026-09-17.md
?? SEO_CONTENT_AUDIT.md
?? app/api/digital-observer/admin/observability/route.ts
?? app/articles/[slug]/page.tsx
?? app/articles/articles.css
?? app/articles/page.tsx
?? app/dashboard/admin/articles/actions.ts
?? app/dashboard/admin/articles/editorial-admin.css
?? app/dashboard/admin/articles/page.tsx
?? app/digital-observer/admin/observability/page.tsx
?? components/editorial/article-carousel.tsx
?? lib/domain/digital-observer/operational-telemetry.ts
?? lib/editorial/articles.ts
?? lib/editorial/store.ts
?? scripts/install-existing-software-connector-service.mjs
?? scripts/qa/check-digital-observer-observability.mjs
?? scripts/qa/check-digital-observer-security-privacy.mjs
?? supabase/migrations/20260913150000_editorial_articles.sql
?? worktrees/gb-m05/
?? worktrees/gb-m26-auth-fix/
?? worktrees/gb-m26-release/
?? worktrees/gb-m26/
?? worktrees/gb-m27/
?? worktrees/gb-m28/
?? worktrees/gb-m29/
```

## Worktree inventory

| Worktree | Branch | State |
| --- | --- | --- |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach` | `refs/heads/main` | present |
| `/private/tmp/do-push18b-deploy-20260908-a` | `detached` | present |
| `/private/tmp/gan-batuach-ci-horizontal-fix-main` | `refs/heads/codex/ci-horizontal-ack-dedup-20260913` | present |
| `/private/tmp/gan-batuach-deploy-fix` | `detached` | present |
| `/private/tmp/gan-batuach-push23` | `detached` | present |
| `/private/tmp/gan-batuach-push28` | `refs/heads/codex/push-34-closure` | present |
| `/private/tmp/gan-batuach-push35` | `refs/heads/codex/push-35-closure` | present |
| `/private/tmp/gan-batuach-push36` | `refs/heads/codex/push-36-horizontal-scale` | present |
| `/private/tmp/gan-batuach-push37` | `refs/heads/codex/push-37-high-availability` | present |
| `/private/tmp/gan-batuach-push38` | `refs/heads/codex/push-38-reliability-qualification` | present |
| `/private/tmp/gan-batuach-push38-ci-fix` | `refs/heads/codex/push-38-ci-fix-20260913` | present |
| `/private/tmp/gan-batuach-release-queue-20260917` | `refs/heads/codex/release-queue-20260917` | present |
| `/private/tmp/gan-batuach-seo-20260917` | `refs/heads/codex/seo-canonical-positioning-20260917` | present |
| `/private/tmp/gan-batuach-seo-final` | `refs/heads/codex/seo-public-canonical-final` | present |
| `/private/tmp/gan-batuach-seo.sHH6Td` | `refs/heads/codex/seo-content-completion` | present |
| `/private/tmp/gan-batuach-supabase-editorial-source` | `refs/heads/codex/supabase-editorial-migration-source-20260913` | present |
| `/private/tmp/observer-live-ui-release` | `detached` | present |
| `/private/tmp/observer-security-observability-oldbase` | `detached` | present |
| `/private/tmp/push3e-event-contract` | `refs/heads/codex/push3e-event-contract-alignment` | stale |
| `/private/tmp/push3e-release-baseline` | `refs/heads/codex/push3e-release-baseline` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach-worktrees/guard-preview-worktree-20260831` | `refs/heads/codex/digital-guard-engine-eeb919c` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach-worktrees/journal-runtime-commit.YRBAJm` | `refs/heads/codex/event-journal-runtime-20260831` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach-worktrees/observer-evidence-control-gating` | `refs/heads/codex/observer-evidence-control-gating-20260901` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach-worktrees/observer-finish-20260901` | `refs/heads/codex/observer-live-media-hardening-20260904` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m05` | `refs/heads/codex/gb-m25-complaints-sla` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m26` | `refs/heads/codex/gb-m26-platform-subscriptions` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m26-auth-fix` | `refs/heads/codex/gb-m26-admin-auth-fix` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m26-release` | `detached` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m27` | `refs/heads/codex/gb-m27-report-correction` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m28` | `refs/heads/codex/gb-m28-webhook-auth-order` | present |
| `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/gb-m29` | `refs/heads/codex/gb-m29-messaging-threads` | present |

## Non-ancestor branch audit population

88 local and remote refs were not ancestors of local `origin/main` at inventory time. This list is overinclusive: squash-equivalent, backups, and superseded branches are possible. A ref is not an independent release candidate until its diff, owner, and production equivalence are checked.

```text
backup/dangling-d95d323-20260831
backup/local-wip-preserved-20260830
backup/native-root-b715921
backup/ux-pr-before-clean-history-20260827
codex/digital-guard-engine-eeb919c
codex/digital-observer-fcm
codex/digital-observer-reference-ui-checkpoint
codex/dvr-v4-runtime-20260901
codex/dvr-video-gateway-integration
codex/event-journal-runtime-20260831
codex/firebase-fcm
codex/fix-camera-site-default
codex/gb-m10-atomic-onboarding
codex/gb-m11-canonical-classrooms
codex/gb-m18-staff-hiring-lifecycle
codex/gb-m19-attendance-time-correction
codex/gb-m19-multi-garden-staff-context
codex/gb-m20-api-auth-401
codex/gb-m20-inspector-approval
codex/gb-m27-parent-tuition
codex/gb-m27-report-correction
codex/gb-m28-payment-provider
codex/gb-m28-webhook-auth-order
codex/gb-m29-messaging-threads
codex/live-gateway-dashboard-fix
codex/observer-live-evidence-finish-v2-20260901
codex/observer-live-media-hardening-20260904
codex/private-nvr-rtsp-probe
codex/push-38-ci-fix-20260913
codex/push-38-reliability-qualification
codex/push3e-event-contract-alignment
codex/push3e-release-baseline
codex/recover/digital-observer-docs-9d23
codex/recover/digital-observer-qa-075f
codex/recover/digital-observer-reference-gap-bf45
codex/recover/digital-observer-reference-ui-f615
codex/recovered-local-work-20260830
codex/security-gates-dependency-fix
codex/self-contained-fcm-worker
codex/seo-content-completion
codex/supplier-backup-docs-20260829
origin/backup/dangling-d95d323-20260831
origin/backup/dvr-v4-runtime-local-20260901
origin/backup/local-wip-preserved-20260830
origin/backup/native-root-b715921
origin/backup/ux-pr-before-clean-history-20260827
origin/codex/digital-guard-engine-eeb919c
origin/codex/digital-observer-fcm
origin/codex/digital-observer-reference-ui-checkpoint
origin/codex/dvr-v4-runtime-20260901
origin/codex/dvr-video-gateway-integration
origin/codex/event-journal-runtime-20260831
origin/codex/firebase-fcm
origin/codex/fix-camera-site-default
origin/codex/gb-m10-atomic-onboarding
origin/codex/gb-m11-canonical-classrooms
origin/codex/gb-m18-staff-hiring-lifecycle
origin/codex/gb-m19-attendance-time-correction
origin/codex/gb-m19-multi-garden-staff-context
origin/codex/gb-m20-api-auth-401
origin/codex/gb-m20-inspector-approval
origin/codex/gb-m27-parent-tuition
origin/codex/gb-m27-report-correction
origin/codex/gb-m28-payment-provider
origin/codex/gb-m28-webhook-auth-order
origin/codex/gb-m29-messaging-threads
origin/codex/live-gateway-dashboard-fix
origin/codex/observer-analysis-telemetry-release
origin/codex/observer-capabilities-completion
origin/codex/observer-event-evidence-release
origin/codex/observer-live-evidence-finish-20260901
origin/codex/observer-live-evidence-finish-v2-20260901
origin/codex/observer-live-media-hardening-20260904
origin/codex/observer-live-stability-release
origin/codex/private-nvr-rtsp-probe
origin/codex/push-38-ci-fix-20260913
origin/codex/push-38-reliability-qualification
origin/codex/push3e-event-contract-alignment
origin/codex/push3e-release-baseline
origin/codex/recover/digital-observer-docs-9d23
origin/codex/recover/digital-observer-qa-075f
origin/codex/recover/digital-observer-reference-gap-bf45
origin/codex/recover/digital-observer-reference-ui-f615
origin/codex/recovered-local-work-20260830
origin/codex/security-gates-dependency-fix
origin/codex/self-contained-fcm-worker
origin/codex/supabase-egress-20260913
origin/codex/supplier-backup-docs-20260829
```

## Queue rules

- Carry each unresolved candidate forward in the next release ledger until verified deployed, superseded with evidence, or intentionally abandoned by its owner.
- Commit and push scoped completed work when safe; do not stage the mixed root or the nested worktrees wholesale. A push is not proof of production.
- If a branch push cannot be proven free of a chargeable Vercel build or if GitHub/CI cost is unbounded, retain the local commit and state the exact blocker.
- Recheck the canonical `AGENTS.md` and provider dashboards at the release window. The automation schedule is a wakeup, not a provider retry queue.

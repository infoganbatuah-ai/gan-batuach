# SEO brand separation handoff — 2026-09-20

- Owner/task: SEO brand separation and social sharing; branch `codex/seo-brand-separation-20260920`; worktree `worktrees/seo-brand-separation-20260920`; base `eb906ea3` on `origin/integration/development`.
- During implementation, `origin/integration/development` advanced to `8d257ab9` for GB-M31 external delivery and migration receipts. Its changed paths do not overlap this SEO diff. The integration owner must reconcile this branch with that cumulative head before integration and re-run the cumulative gates.
- Scope: public metadata, two 1200×630 logo-based share images, Gan management and Observer video-investigation landing pages, internal links, sitemap, Observer loading-state heading semantics, and a small public-page contrast correction. No schema, provider configuration, dependencies, authentication, private data, or migration changes.
- Product boundary: Gan Batuach is the private kindergarten management/supervision standard; Digital Observer is a standalone home/business camera and incident-analysis product. Garden camera integration remains conditional, with human review and privacy checks. Neither page claims that future AI or camera capabilities are already generally live.

## Search-intent map

| Intent cluster | Canonical public URL | Brand/share image |
| --- | --- | --- |
| גן בטוח, תו תקן פרטי לגני ילדים, בקרה ופיקוח | `/`, `/safety-standard` | Gan Batuach |
| ניהול גני ילדים, מערכת לניהול גן ילדים, רישום, הורים וצוות | `/kindergarten-management` | Gan Batuach |
| בחירת גן, חוות דעת, דירוג, בטיחות, מידע מקצועי | `/articles` and individual article URLs | Gan Batuach for social sharing; article-specific hero retained in Article schema |
| תצפיתן דיגיטלי, ניטור מצלמות, לבית פרטי, לעסקים | `/digital-observer`, `/digital-observer/home`, `/digital-observer/business` | Digital Observer |
| ניתוח וידאו, חקירת וידאו, סקירה אנושית | `/digital-observer/video-investigation` | Digital Observer |
| חיבור אפשרי של מצלמות גן לתהליך הפיקוח | `/ai-observer` | Gan Batuach; links to the separate Observer product |

The map is a content/URL taxonomy, not a claim about search volumes or ranking. Google ignores the `meta keywords` tag; primary terms are used in distinct titles, headings, body text and internal links. Public Observer pages use self-canonical metadata, while authenticated Observer routes inherit `noindex` unless explicitly opted in. The sitemap lists the new canonical URLs. `/kindergarten-directory` intentionally redirects and canonicals to `/gardens`; it is not a separate index target.

## Canonical and production evidence

- The prior 2026-09-17 handoff in `docs/seo-canonical-handoff-2026-09-17.md` records that Google had remembered `gan-batuach.vercel.app/digital-observer` as canonical from an older crawl. A reindex request and validation were started then; that is not proof of completion.
- A 2026-09-20 read-only production inspection found `https://ganbatuach.com/digital-observer` self-canonical. Production had no `og:image` on that page at inspection time. This branch adds explicit, brand-specific Open Graph and Twitter images; no deployment has occurred.
- The old `https://gan-batuach.vercel.app/digital-observer` URL still served the page during this inspection, but its canonical pointed to `https://ganbatuach.com/digital-observer`. Google may continue reporting the old host as a non-indexed alternate while consolidating; do not treat an alternate URL as a separate page that must be indexed. A host-wide redirect was not added without reviewing login/callback impacts and provider routing.
- In the currently available Chrome Search Console session, the Gan Batuach Google account showed no property list. Do not claim the Google-selected canonical or validation outcome has changed until the verified property report is reviewed after release.

## Performance and accessibility evidence

- Production homepage Chrome DevTools trace, desktop unthrottled: LCP 372 ms, CLS 0.07, TTFB 116 ms.
- Production homepage mobile emulation, 390×844, 4× CPU slowdown, Slow 4G: LCP 1,256 ms, CLS 0.00, TTFB 99 ms.
- A repeat mobile trace in a separate browser context after unregistering service workers and clearing Cache Storage recorded homepage LCP 858 ms, CLS 0.00, TTFB 100 ms. It was still a repeat navigation, so this is not a guaranteed first-visit measurement.
- Production Digital Observer mobile emulation under the same settings: LCP 948 ms, CLS 0.00, TTFB 104 ms. Its LCP background image was discovered via CSS, but the tool estimated no actionable metric savings; no preload was added.
- Production homepage mobile Lighthouse (performance excluded by this tool): accessibility 96, best practices 100, SEO 100. The single failed audit was text contrast; this branch darkens the existing soft-button text and public-page status chips without changing layout.
- These are cache-affected lab observations, not field Core Web Vitals or post-release measurements. CrUX field data was unavailable.

## Validation and release state

- `npm run typecheck`, `npm run lint:ci`, `npm run qa:ci:security`, `npm run qa:migrations`, and `npm run qa:release-contract` passed locally. A scoped ESLint invocation still reports pre-existing `any` usage in the Observer pricing page; `lint:ci` reports no regressions.
- `qa:ci:domain` is blocked by missing `DIGITAL_OBSERVER_BENCHMARK_DATASET_CONTRACT.md` in the current integration base. This is an existing cross-product gate gap and must not be bypassed with a placeholder. `qa:digital-observer-product` requires a safe Supabase URL and publishable key that were not present in this isolated worktree.
- The final-source `npm run build` passed after allowing Next.js's local Turbopack port bind. Its generated static HTML was inspected for the homepage, management page, garden camera bridge and six Observer public routes: every tested URL has one H1 and a self-canonical; Gan routes use the Gan logo for Open Graph/Twitter, Observer routes use the Observer logo and explicitly opt into indexing. The article index and article detail are dynamically rendered and were reviewed in source, not production-smoked.
- No migrations are included or applied. No Production deployment, main merge, or Google reindex request was made by this branch.
- Read-only Vercel check on 2026-09-20: the team showed three projects; only `gan-batuach` was Git-connected, while the two auxiliary projects showed “Connect Git Repository” and no Production deployment. The connected project's ignored-build setting was “Only build production”; the repository also carries `git.deploymentEnabled` with wildcard `false` and `main` `true`. Older Preview deployments remain visible in the dashboard, so verify that a new feature-branch push creates **no** new deployment rather than inferring zero usage solely from the ignored-build setting.
- State: implementation validated on this feature worktree, pending remote preservation and integration-owner reconciliation. The six-gate release suite is **not** green because the domain gate lacks its existing benchmark contract, and isolated Observer backend QA was unavailable. Before any remote push, verify Vercel project Git settings, no-preview behavior and current cost/cap evidence; the previous handoff reported exhausted included Vercel credit. If safe preservation or a required gate remains unavailable, record this unit as `BLOCKED` with its commit SHA and exact next action in the development ledger. Production release requires a new explicit owner instruction and all release gates.

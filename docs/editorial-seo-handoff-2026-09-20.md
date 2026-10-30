# Editorial SEO: Gan Batuach and Digital Observer — 2026-09-20

## Scope and ownership

- Branch: `codex/editorial-depth-20260920`, based on `codex/seo-brand-separation-20260920` at `bf6f53b7`.
- Worktree: `worktrees/seo-editorial-depth-20260920`.
- No Production release, `main` merge, Vercel deployment, remote database write or migration in this unit. Owner explicitly wants a consolidated release later; the future date is not release authorization.
- Existing editorial table and public `editorial-images` bucket are reused. New assets are bounded static WebP files, 30 images totaling approximately 2.1 MB in Git. Synthetic illustrations show no real child, camera feed, incident or client.
- The production website remains the previous deployed version until a separately authorized release.

## Search architecture and intent

| Intent cluster | Canonical destination | Boundary |
| --- | --- | --- |
| גן בטוח (brand), management and oversight | `/`, `/kindergarten-management`, `/safety-standard` | Private standard, not government permit or the separate Standards Institute initiative. |
| Choosing a safe kindergarten, reviews, registration, cameras, staff, child data | `/articles` and unique `/articles/[slug]` | 12 original guides deepened; each targets a distinct reader question. |
| תצפיתן דיגיטלי (brand), cameras for home or business, video investigation | `/digital-observer`, product subpages and `/digital-observer/guides/[slug]` | Standalone camera product; not a synonym for kindergarten management. |

This is an intent map, **not** measured search volume or a ranking forecast. Search Console and keyword-planner data are needed to prioritize future queries empirically. Do not promise first place, Google AI Overview inclusion or Google Discover appearance.

## Editorial standard

- Each of 15 guides has a unique title, description, canonical route, representative cover, a distinct supporting image with descriptive Hebrew alt and caption, practical sections, FAQs, primary-source references and a natural product connection.
- Article structured data, breadcrumbs and image URLs are visible on the corresponding page; published and modified dates are separate. FAQ markup mirrors visible Q&A but does not imply FAQ rich-result eligibility.
- The main site and product landing pages continue to use their own logos for social sharing. **Individual articles** use article-specific covers, because a repeated logo is not a representative article image.
- Existing admin revisions take precedence. A byte-for-byte copy of legacy seed text or the legacy shared hero is upgraded to the new seed; genuinely edited admin content is preserved.
- Admin can edit source links and add an inline picture in the body, one per save, with alt and caption. Multiple saves build a multi-image article. This uses existing metadata columns, not a new database table. File upload is capped by existing 6 MB action body limit and 5 MB bucket limit.
- The existing public editorial-media owner is the site editor. Assets are non-sensitive synthetic or licensed editorial imagery, not child data or camera evidence; estimated volume is one bounded upload per save. Keep images while referenced by a published article. Before any cleanup, list unreferenced objects and review them; do not automatically purge Production media or remove an object still referenced by a draft. Record any manual orphan-cleanup decision and retention period in the supplier/data inventory before activation.
- Static bandwidth impact is bounded but not free: the new inline picture is approximately 40–72 KB per article before image optimization. At 10,000 fully read article views, that is roughly 0.4–0.72 GB of additional raw image transfer if uncached; browser/CDN caching may reduce it. The site owner must compare actual Vercel headroom and the all-in ₪15-per-paying-user ledger before release. No new vendor or paid feature is activated by this branch.
- Source review is still an editorial obligation: official pages may change, and content about regulation, privacy and cameras requires periodic recheck before publication.
- Related Gan Batuach Management and Digital Observer task histories were checked for product truth. They still classify real camera/Gateway and some AI behavior as readiness, shadow or unverified for Production. Editorial wording therefore describes planned or conditional capabilities, not a proven live safety service.

## Guidance used

- [Google Search Central: helpful, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Search Central: image SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Google Search Central: Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google Search Central: AI features and websites](https://developers.google.com/search/docs/appearance/ai-features)
- [Bing Webmaster: sitemaps and AI-powered search](https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search)

No special `llms.txt` or unsupported AI-only schema is claimed as a prerequisite. Accessible HTML, indexability, accurate canonical URLs, useful content and valid sitemaps remain the shared foundation.

## Performance baseline and evidence limit

Chrome DevTools MCP trace of **current Production** `https://ganbatuach.com/articles` on 2026-09-20:

- Unthrottled desktop observed LCP 837 ms, CLS 0.00, TTFB 395 ms.
- Emulated 390×844 mobile, Fast 4G and 4× CPU slowdown: LCP 2,415 ms, CLS 0.00, TTFB 258 ms; 1,655 ms of LCP was render delay. No CrUX field data was available for this page.
- Render-blocking insight estimated 0 ms savings; avoid claiming CSS removal is a priority based on this trace.
- The old shared hero was the mobile LCP image. New individual WebP assets are 40–137 KB each; measure the exact integration build before release, then recheck Production after owner-authorized deployment. Local development speed is not a Production Core Web Vitals result.
- The first magazine cover and article hero now use `loading="eager"` and `fetchPriority="high"`; later covers remain lazy. This follows the bundled Next.js 16 image guide, where `priority` is deprecated, and targets the observed low-priority LCP image request. Re-measure after deployment rather than assuming a fixed millisecond gain.
- A scoped local **production build** served without a live Supabase backend, with synthetic loopback values and the same 390×844 / Fast 4G / 4× CPU emulation, produced observed LCP/CLS of 1,904 ms/0.00 on `/articles`, 1,403 ms/0.00 on `/digital-observer/guides`, and 1,087 ms/0.00 on an Observer guide. These are lab observations on loopback with warm browser assets, not directly comparable to Production or a field-data claim.
- Local DOM inspection of a Gan guide and an Observer guide confirmed one H1, two distinct images with alt, Article + Breadcrumb + FAQ JSON-LD, self-canonical URL, article-specific Open Graph image and at least four official source links. The sitemap emitted 12 Gan guides, 3 Observer guides and 30 image entries.
- On the final local build, mobile Lighthouse returned 100 for accessibility, best practices, SEO and agentic browsing on one Gan guide and one Observer guide (0 failed audits in each). These technical audits do not score factual depth or predict rankings. The final `/articles` mobile trace observed LCP 1,250 ms and CLS 0.00 on loopback; LCP discovery passed high fetch priority, non-lazy loading and initial-document discovery.

## Exact branch validation

- PASS: `npm run qa:editorial` (15 guides / 30 distinct, optimized images), `npm run typecheck`, `npm run lint:ci` (no regressions against the repository baseline), `npm run qa:ci:security`, `npm run qa:migrations`, `npm run qa:release-contract`, `npm run build` with synthetic loopback Supabase values, `git diff --check`.
- BLOCKED at the inherited base: `npm run qa:ci:domain` fails in `quality-benchmark` because `DIGITAL_OBSERVER_BENCHMARK_DATASET_CONTRACT.md` is absent. The content change does not create or own that contract. This is **not** six green CI gates; integration/release readiness cannot be claimed.
- NOT TESTED: authenticated admin save/upload against an isolated Supabase database, cumulative Development full-stack role journeys, Search Console affected-URL report, current Production indexing and post-release real-user Web Vitals. No migration was added or applied.

## Release handoff / open verification

1. Run `npm run qa:editorial`, typecheck, lint/CI, build, domain/security/migration/release-contract gates on the exact commit. Record any pre-existing gate blocker rather than relabeling it PASS.
2. Inspect desktop/mobile rendering and a performance trace of a **production build** for `/articles`, a Gan guide, `/digital-observer/guides` and an Observer guide. Verify each has one H1, two images, correct source links, schema, canonical and OG cover.
3. Compare local migration ledger and integration dependencies. This unit adds **no migration** and should not apply any migration to Production.
4. Integration owner may merge into `integration/development` only after the prior SEO branch and this branch are preserved and reconciled; run cumulative local full-stack checks there.
5. On new explicit owner release authorization only: freeze candidate, run all release gates and cost/backup preflight, release once, verify Vercel deployment ID and live URLs, inspect Search Console indexing and submit sitemap as appropriate. Search Console “Alternate page with proper canonical” still needs affected URLs before it can be classified as an error versus intended duplication.

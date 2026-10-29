# Gan Batuach SEO / AEO / AI-search audit — 2026-10-30

## Scope and release state

- Working branch: `codex/seo-aeo-geo-reconciliation-20261030`.
- Base: the then-current `integration/development` commit `aea078ce67cf3061be5f0a6c314545dcc533a85d`.
- This package reconciles the prior brand-split and editorial-depth commits with current development. It is not merged to `main` and is not deployed to Production.
- No new database migration is introduced. The existing editorial migration is `supabase/migrations/20260913150000_editorial_articles.sql`; development application is recorded as `YES`, while Production remains `UNVERIFIED`.
- The local DEVELOPMENT stack confirmed that `editorial_articles` exists with RLS enabled and that the public `editorial-images` bucket accepts an administrator upload, serves the uploaded WebP publicly, and allows cleanup. Anonymous article writes were denied by RLS. No test object remains.

## Executive findings

The production site currently exposes the apex HTTPS domain, a valid robots file and sitemap, but it still serves the older social image and the older, narrower sitemap. The reconciled branch adds the separate Gan Batuach and Digital Observer content systems, 15 long-form guides, 30 unique optimized editorial images, per-article metadata/schema, privacy-safe public garden discovery and a controlled editorial admin path.

The Search Console notice “Alternate page with proper canonical tag” is not, by itself, evidence of an error. Filter/query duplicates may correctly canonicalize to the base directory. The exact affected URLs and Google-selected canonicals remain unverified because the Search Console property/report was not accessible in this task. Unique editorial routes use self-canonicals; the legacy `/kindergarten-directory` route now uses a permanent redirect to `/gardens`.

## Brand and domain architecture

The recommended architecture is one authoritative apex domain:

- Gan Batuach: `https://ganbatuach.com/`, `/articles`, `/safety-standard`, `/kindergarten-management`, `/gardens`.
- Digital Observer: `https://ganbatuach.com/digital-observer` and `/digital-observer/guides`.
- Authenticated product routes remain on the same origin but use explicit `noindex, nofollow, noarchive, nosnippet, noimageindex` metadata.

The subpath architecture keeps company authority and technical maintenance together while maintaining distinct titles, copy, structured data, logos and social images. A separate subdomain is not justified unless the products later require independent infrastructure, ownership or international targeting. Duplicate copies must never be published on both locations.

No `hreflang` is added: there is no complete, equivalent English content set. English interface labels or an English product name are not enough. Add `he-IL` / `en` alternates only after full reciprocal translations exist.

No `llms.txt` is added. Google’s current guidance does not require special AI-search files or “chunking” tactics. The implementation instead improves index eligibility, answer-first summaries, citations, visible author/review dates, internal topic clusters, factual caveats and structured data that matches the visible page.

## Information architecture and keyword ownership

### Gan Batuach

| Cluster | Primary intent | Main destination | Supporting guides |
|---|---|---|---|
| Brand and private standard | גן בטוח, תו תקן לגני ילדים פרטיים, גני ילדים בעלי ניהול ופיקוח | `/`, `/safety-standard` | what-is-gan-batuach, private-kindergarten-inspections |
| Kindergarten management | ניהול גני ילדים, מערכת לניהול גני ילדים, ניהול גן מקצה לקצה | `/kindergarten-management` | kindergarten-management-system, registration, child profile, parent platform |
| Parent selection | איך לבחור גן, גן מומלץ, המלצות וחוות דעת | `/gardens`, `/articles` | parent choice, reviews, quality score |
| Safety and supervision | בקרה ופיקוח לגני ילדים, בדיקת צוות, גן ילדים בטוח | `/safety-standard` | inspections, staff checks, incidents |
| Cameras and privacy | מצלמות בגני ילדים, הרשאות צפייה, פרטיות ילדים | cameras-in-kindergartens | child profile, parent platform |

### Digital Observer

| Cluster | Primary intent | Main destination | Supporting guides / backlog |
|---|---|---|---|
| Home | תצפיתן דיגיטלי לבית, מצלמות לבית פרטי | `/digital-observer/home` | observer-home-cameras |
| Business | תצפיתן לעסקים, בקרה חכמה לעסק | `/digital-observer/business` | observer-business-cameras |
| Investigation | ניתוח וידאו, חקירת וידאו, איתור אירוע בצילום | `/digital-observer/video-investigation` | observer-video-investigation |
| Privacy and trust | פרטיות מצלמות, אבטחת מצלמות, הרשאות | `/digital-observer/trust` | all three guides |
| Integrations | התממשקות מצלמות, API/OEM/שותפים | future public integration page | publish only when supported capabilities and contracts are verified |

Digital Observer pages explicitly state that actual camera compatibility, analysis and availability depend on the site and authorization. They do not claim a capability is active where it has not been verified.

## Editorial quality controls

- 12 Gan Batuach guides and 3 separate Digital Observer guides.
- At least three substantive sections and 280 words per guide; source links, two or more FAQs and a visible answer-first summary.
- 30 unique WebP assets: a unique 1440×810 cover and a unique in-article image for every guide. Each file is under 200 KB.
- Per-article title, description, canonical, large-image preview, article Open Graph/Twitter image, visible publish/review dates and Article/Breadcrumb/FAQ JSON-LD.
- Sources are restricted by automated QA to primary/public domains used by the corpus: Education Ministry, government, Knesset, State Comptroller and Standards Institute. A visible disclaimer distinguishes official requirements from Gan Batuach’s private standard.
- Topic clusters and related-article scoring create meaningful internal links rather than a flat “latest articles” loop.
- Generated illustrations are disclosed as illustrations and are not presented as evidence from a real kindergarten or inspection.

## Privacy and indexing controls

- Exact kindergarten addresses were removed from indexable home, directory and parent-join surfaces.
- Individual garden profiles remain `noindex` until the data model contains explicit publication consent for the profile/address.
- The public profile no longer queries raw child, parent, staff or inspection collections to render public counters or recent reports.
- Private HTML routes are crawlable so search engines can read their `noindex`; `/api/` remains disallowed. Robots is not used as an access-control mechanism.
- The sitemap excludes private routes and contains self-canonical public pages and published editorial routes.

## Provider and domain verification matrix

| Item | Status on 2026-10-30 | Evidence / next dependency |
|---|---|---|
| Apex HTTPS and HTTP redirect | VERIFIED | `https://ganbatuach.com` loads; HTTP redirects to HTTPS. |
| `www` DNS/redirect | BLOCKED | `www.ganbatuach.com` did not resolve. DNS owner must add the supported record and redirect to apex. |
| Search Console verification tag | VERIFIED | Verification meta is present in source and live HTML. |
| Search Console ownership, sitemap acceptance, coverage and URL Inspection | UNVERIFIED | Property/report access unavailable; provider coordinator must verify after deployment. |
| Bing Webmaster Tools | UNVERIFIED | Connect and submit the canonical sitemap after deployment; IndexNow is optional and must be coordinated before activation. |
| Analytics / Tag Manager | UNVERIFIED / NOT ACTIVATED | Do not add tracking until consent, purpose, retention and provider ownership are approved. |
| Production deployment of this branch | NOT DEPLOYED BY DESIGN | Requires the later frozen, owner-authorized consolidated release. |

## Search Console canonical verification after release

For each affected example URL, use URL Inspection and record: user-declared canonical, Google-selected canonical, last crawl, indexing status and whether the URL is a true duplicate. If a filter URL is intentionally duplicate, keep the base canonical and remove it from the sitemap. If a unique article is canonicalized elsewhere, verify its self-canonical, redirect chain, internal links, content uniqueness and rendered HTML before requesting validation.

## Performance evidence and remaining measurement

Earlier local lab measurements on the reconciled content showed LCP around 1.25–1.40 seconds and CLS 0 for representative article pages, compared with an approximately 2.42-second production article LCP in a throttled lab profile. These are directional lab results, not Chrome UX Report field data. Re-run Lighthouse and a rendered-route crawl on the exact final commit before integration and again on the deployed build; then monitor Search Console Core Web Vitals after sufficient real-user traffic exists.

## Integration dependencies and next actions

1. Preserve this branch remotely and add the exact implementation SHA to the development integration ledger.
2. Integration owner merges this unit into `integration/development`, resolves only explicit conflicts and reruns the cumulative gates.
3. Apply no new migration. Reconcile the existing editorial migration against DEVELOPMENT and later against bounded read-only Production history.
4. Provider coordinator fixes/redirects `www`, verifies Search Console/Bing ownership, submits the canonical sitemap and records representative URL Inspection evidence after the consolidated deployment.
5. Keep analytics inactive until privacy/consent ownership is decided.
6. Expand the Digital Observer integration/API cluster only when real supported contracts are available; do not publish speculative capability claims.


# DIGITAL OBSERVER HOME RUNTIME AND PRODUCTION AUDIT

Date: 2026-08-21

## Decision

`LOCAL_FIX_ACCEPTED_PENDING_DEPLOYMENT`

The production site is not an unrelated old build: its protected Digital Observer conversation and identity-candidate endpoints are present and return the expected unauthenticated `401`, and the deployed `sw.js` matched the repository version before this repair. The reported gap was real: mobile CSS hid the primary page action, home navigation omitted billing, core controls were too far down the dashboard, and the shared service worker could cache authenticated navigation and fall back to Gan Batuach content.

The fixes below are local and verified. They have not been pushed or deployed in this task.

## Source And Production Findings

| Check | Finding | Status |
|---|---|---|
| Current production contains the previous Digital Observer release | Protected new APIs exist in production | PASS |
| Production service worker matched the previous repository version | SHA-256 matched before the local repair | PASS |
| Wrong route or unauthenticated redirect explains the report | No; the authenticated home information architecture had real gaps | NOT THE ROOT CAUSE |
| Mobile primary action | `.do-top-actions > .do-button` was hidden below 820px | FIXED LOCALLY |
| Home subscription navigation | Billing existed but was absent from the home sidebar and not prominent on the dashboard | FIXED LOCALLY |
| App/PWA product separation | Authenticated pages could be cached and offline navigation could return Gan Batuach `/` | FIXED LOCALLY |
| Build appeared stalled | Synchronous deletion of a very large generated `.next` tree blocked before `next build` | FIXED LOCALLY |

## Mandatory Reference Checklist

The attached reference screens were treated as the acceptance line for hierarchy, RTL, mobile-first behavior, camera-first presentation, product controls and app-like navigation. Dynamic values remain data-bound and are not copied from the images.

| Requirement | Actual implementation | Evidence | Result |
|---|---|---|---|
| Mobile-first home, not scaled desktop | Sidebar is removed, 5-item bottom navigation is fixed with safe-area padding, header and cards reflow at 390px | `home-dashboard-mobile.png` | PASS |
| Home status is visible immediately | Data-bound monitoring/event hero is the first product section after the trial status | `home-dashboard-mobile.png` | PASS |
| Cameras are a first-class home section | Camera section now appears before management controls and chat; it renders the real/synthetic source rows and honest readiness state | `home-dashboard-mobile.png`, `home-cameras-mobile.png` | PASS |
| Add camera is obvious | Visible `+` action in the mobile header, camera-section action and command center; all route to `/digital-observer/cameras/add` | `home-dashboard-mobile.png`, `home-camera-add-mobile.png` | PASS |
| Observer is central and conversational | Data-bound summary and API-backed natural-language conversation are on the dashboard and `/digital-observer/rules` | `home-dashboard-*.png`, `home-observer-*.png` | PASS |
| Subscription status and editing are reachable | Home navigation and command center link to `/digital-observer/billing`; current package/trial/entitlements come from server runtime | `home-billing-mobile.png` | PASS |
| Monitoring controls are usable | Observer requests are in `/rules`; schedule, quiet hours and safe notification modes are in `/settings` | `home-observer-mobile.png`, `home-settings-mobile.png` | PASS |
| Alerts and event context are usable | Bottom navigation and dashboard link to the data-bound alerts center | `home-alerts-mobile.png` | PASS |
| Business and home stay distinct | Both use their own labels, summaries, site mode and navigation while sharing safe primitives | `business-dashboard-*.png` | PASS |
| No fake live state | Demo camera is explicitly labeled as simulation; live stream requires Gateway/token; billing and external notifications remain disabled | Camera, billing and settings screenshots | PASS |
| No manual browser resize | Screens were loaded directly at 390x844, 820x1180 and 1440x900 | Visual QA report | PASS |
| Exact dynamic content from reference images | Not copied: camera count, events, dates, plan and status reflect the synthetic account runtime | Runtime and visual QA | PASS BY PRODUCT RULE |
| Pixel-level stakeholder approval | Automated layout passed, but final subjective reference approval belongs to Daniel after deployment | This report and screenshots | MANUAL REVIEW AFTER DEPLOYMENT |

## Implemented Files

- `app/digital-observer/dashboard/page.tsx`: camera-first home hierarchy and visible core action center.
- `components/digital-observer/observer-app-shell.tsx`: billing added to home navigation.
- `app/styles/digital-observer-product.css`: responsive action controls and mobile/desktop command layout.
- `components/app-motion-shell.tsx`: service worker registration always checks for the current worker.
- `public/sw.js`: authenticated navigation is network-only; only static assets are cached; offline response is product-aware.
- `scripts/prepare-next-build.mjs` and `scripts/cleanup-next-build-artifacts.mjs`: build cleanup no longer blocks before compilation.
- `scripts/qa/check-digital-observer-product.mjs`: core mobile actions and safe caching are acceptance checks.
- `scripts/qa/capture-digital-observer-ai-experience.mjs`: cameras, alerts, billing and settings were added to visual QA.

## Verification

- `npm run typecheck`: PASS.
- `npm run build`: PASS, 467 static pages generated.
- `npm run qa:digital-observer-product`: PASS, 48/48.
- Visual QA: PASS, 54/54 authenticated home/business route and viewport combinations.
- `git diff --check`: PASS.
- Credentials printed: no.
- Live cameras, biometric processing, live AI, live billing, external messages and emergency calling enabled: no.
- Push or deployment performed in this task: no.

## Evidence

Visual evidence is stored under `qa-evidence/digital-observer-home-reality-audit-1`. The report proves authenticated rendering and route accessibility with synthetic accounts. It does not prove a real camera Gateway, a live AI inference provider, payment processing, external notification delivery or emergency escalation.

## Remaining Decision

Daniel must explicitly approve a new push/deployment before these local fixes can replace the current production experience. After deployment, open the installed PWA once while online so the new service worker takes control, then perform the short stakeholder comparison on the real URL.

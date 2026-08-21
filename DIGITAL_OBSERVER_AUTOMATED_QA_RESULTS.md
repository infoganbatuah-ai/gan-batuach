# DIGITAL OBSERVER AUTOMATED QA RESULTS

Date: 2026-08-21T14:16:25.061Z
Environment: synthetic demo
Passwords or tokens printed: no
Service role used in browser/client QA: no

| Area | Result | Evidence |
|---|---|---|
| Home user login | PASS | Normal Supabase auth session created |
| Home user standalone identity | PASS | Digital Observer membership exists independently from the Gan Batuach role |
| Home user product metadata | PASS | Auth metadata identifies the standalone product |
| Business user login | PASS | Normal Supabase auth session created |
| Business user standalone identity | PASS | Digital Observer membership exists independently from the Gan Batuach role |
| Business user product metadata | PASS | Auth metadata identifies the standalone product |
| Home user synthetic site | PASS | home site visible through user-scoped query |
| Business user synthetic site | PASS | business site visible through user-scoped query |
| Home user camera source binding | PASS | User can read only safe camera source columns |
| Home user event binding | PASS | Synthetic AI events are data-bound |
| Home user billing readiness | PASS | Subscription exists without live billing provider |
| Home user known people privacy | PASS | Synthetic known people are visible without biometric fields |
| Home user identity candidate workflow | PASS | Candidate review metadata is site-scoped and available even when no AI candidate exists |
| Home user identity candidate private columns | PASS | Raw cluster references are not selectable by the browser role |
| Home user event clip retention | PASS | Readiness clips are capped at 48 hours and have no download claim |
| Home user notification isolation | PASS | Only scoped mock notification delivery is visible |
| Business user camera source binding | PASS | User can read only safe camera source columns |
| Business user event binding | PASS | Synthetic AI events are data-bound |
| Business user billing readiness | PASS | Subscription exists without live billing provider |
| Business user known people privacy | PASS | Synthetic known people are visible without biometric fields |
| Business user identity candidate workflow | PASS | Candidate review metadata is site-scoped and available even when no AI candidate exists |
| Business user identity candidate private columns | PASS | Raw cluster references are not selectable by the browser role |
| Business user event clip retention | PASS | Readiness clips are capped at 48 hours and have no download claim |
| Business user notification isolation | PASS | Only scoped mock notification delivery is visible |
| Home user cannot read foreign site | PASS | RLS returned no foreign site rows |
| Home user cannot read foreign cameras | PASS | RLS returned no foreign camera rows |
| Home user cannot read foreign events | PASS | RLS returned no foreign event rows |
| Home user cannot read foreign known people | PASS | RLS returned no foreign known-person rows |
| Home user cannot read foreign identity candidates | PASS | RLS returned no foreign identity-candidate rows |
| Home user cannot read foreign clips | PASS | RLS returned no foreign clip rows |
| Home user cannot read foreign deliveries | PASS | RLS returned no foreign notification rows |
| Business user cannot read foreign site | PASS | RLS returned no foreign site rows |
| Business user cannot read foreign cameras | PASS | RLS returned no foreign camera rows |
| Business user cannot read foreign events | PASS | RLS returned no foreign event rows |
| Business user cannot read foreign known people | PASS | RLS returned no foreign known-person rows |
| Business user cannot read foreign identity candidates | PASS | RLS returned no foreign identity-candidate rows |
| Business user cannot read foreign clips | PASS | RLS returned no foreign clip rows |
| Business user cannot read foreign deliveries | PASS | RLS returned no foreign notification rows |
| Retention is capped for Digital Observer | PASS | All active packages are 48 hours or less |
| No package activates live providers | PASS | Package provider modes remain mock/sandbox/readiness |
| Commercial package matrix is complete | PASS | Home, business and multi-site package rows are present |
| Mobile zoom remains accessible | PASS | Viewport metadata does not disable pinch zoom |
| Observer routes have loading and error states | PASS | Dedicated route-level loading and recovery UI exists |
| Multi-industry templates keep high-risk review guarded | PASS | Site templates are reusable and never enable automatic emergency action |
| Home dashboard exposes core product actions | PASS | Camera, Observer, subscription and monitoring entry points are present in the authenticated dashboard |
| Home navigation exposes subscription management | PASS | Home users can reach billing without using a business-only menu |
| Mobile header keeps primary actions visible | PASS | Primary page action is rendered as an icon button instead of being hidden on mobile |
| Service worker never caches authenticated navigation | PASS | Navigation is network-only and the offline response is product-aware; only static assets are cached |

Final result: PASS
Passed: 48/48

> This runtime QA uses normal Supabase authentication and RLS. It does not validate a real camera gateway, AI provider, billing provider or production notification provider.

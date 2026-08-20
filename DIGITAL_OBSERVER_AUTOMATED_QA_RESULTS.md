# DIGITAL OBSERVER AUTOMATED QA RESULTS

Date: 2026-08-20T22:00:17.982Z
Environment: synthetic demo
Passwords or tokens printed: no
Service role used in browser/client QA: no

| Area | Result | Evidence |
|---|---|---|
| Home user login | PASS | Normal Supabase auth session created |
| Home user standalone identity | PASS | Digital Observer membership exists independently from the Gan Batuach role |
| Home user product metadata | FAIL | Legacy test user is missing product=digital_observer metadata |
| Business user login | PASS | Normal Supabase auth session created |
| Business user standalone identity | PASS | Digital Observer membership exists independently from the Gan Batuach role |
| Business user product metadata | FAIL | Legacy test user is missing product=digital_observer metadata |
| Home user synthetic site | PASS | home site visible through user-scoped query |
| Business user synthetic site | PASS | business site visible through user-scoped query |
| Home user camera source binding | FAIL | No synthetic camera source is linked to this site |
| Home user event binding | FAIL | No synthetic AI event is linked to this site |
| Home user billing readiness | FAIL | No trial or subscription row is linked to this site |
| Home user known people privacy | FAIL | No synthetic known-person readiness row is linked to this site |
| Home user event clip retention | FAIL | No synthetic event clip is linked to this site |
| Home user notification isolation | FAIL | No synthetic notification delivery is linked to this site |
| Business user camera source binding | FAIL | No synthetic camera source is linked to this site |
| Business user event binding | FAIL | No synthetic AI event is linked to this site |
| Business user billing readiness | FAIL | No trial or subscription row is linked to this site |
| Business user known people privacy | FAIL | No synthetic known-person readiness row is linked to this site |
| Business user event clip retention | FAIL | No synthetic event clip is linked to this site |
| Business user notification isolation | FAIL | No synthetic notification delivery is linked to this site |
| Home user cannot read foreign site | PASS | RLS returned no foreign site rows |
| Home user cannot read foreign cameras | PASS | RLS returned no foreign camera rows |
| Home user cannot read foreign events | PASS | RLS returned no foreign event rows |
| Home user cannot read foreign known people | PASS | RLS returned no foreign known-person rows |
| Home user cannot read foreign clips | PASS | RLS returned no foreign clip rows |
| Home user cannot read foreign deliveries | PASS | RLS returned no foreign notification rows |
| Business user cannot read foreign site | PASS | RLS returned no foreign site rows |
| Business user cannot read foreign cameras | PASS | RLS returned no foreign camera rows |
| Business user cannot read foreign events | PASS | RLS returned no foreign event rows |
| Business user cannot read foreign known people | PASS | RLS returned no foreign known-person rows |
| Business user cannot read foreign clips | PASS | RLS returned no foreign clip rows |
| Business user cannot read foreign deliveries | PASS | RLS returned no foreign notification rows |
| Retention is capped for Digital Observer | PASS | All active packages are 48 hours or less |
| No package activates live providers | PASS | Package provider modes remain mock/sandbox/readiness |
| Commercial package matrix is complete | PASS | Home, business and multi-site package rows are present |

Final result: FAIL
Passed: 21/35

> This runtime QA uses normal Supabase authentication and RLS. It does not validate a real camera gateway, AI provider, billing provider or production notification provider.

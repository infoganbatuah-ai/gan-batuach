# DIGITAL OBSERVER AUTOMATED QA RESULTS

Date: 2026-08-20T02:15:04.439Z
Environment: synthetic demo
Passwords or tokens printed: no
Service role used in browser/client QA: no

| Area | Result | Evidence |
|---|---|---|
| Home user login | PASS | Normal Supabase auth session created |
| Home user standalone profile | PASS | network_manager profile without garden assignment |
| Business user login | PASS | Normal Supabase auth session created |
| Business user standalone profile | PASS | network_manager profile without garden assignment |
| Home user synthetic site | PASS | home site visible through user-scoped query |
| Business user synthetic site | PASS | business site visible through user-scoped query |
| Home user camera source binding | FAIL | Database error PGRST205 |
| Home user event binding | FAIL | Synthetic AI events are data-bound |
| Home user billing readiness | FAIL | Database error 42703 |
| Home user known people privacy | FAIL | Database error PGRST205 |
| Home user event clip retention | FAIL | Database error PGRST205 |
| Home user notification isolation | FAIL | Database error PGRST205 |
| Business user camera source binding | FAIL | Database error PGRST205 |
| Business user event binding | FAIL | Synthetic AI events are data-bound |
| Business user billing readiness | FAIL | Database error 42703 |
| Business user known people privacy | FAIL | Database error PGRST205 |
| Business user event clip retention | FAIL | Database error PGRST205 |
| Business user notification isolation | FAIL | Database error PGRST205 |
| Home user cannot read foreign site | PASS | RLS returned no foreign site rows |
| Home user cannot read foreign cameras | FAIL | Database error PGRST205 |
| Home user cannot read foreign events | PASS | RLS returned no foreign event rows |
| Home user cannot read foreign known people | FAIL | Database error PGRST205 |
| Home user cannot read foreign clips | FAIL | Database error PGRST205 |
| Home user cannot read foreign deliveries | FAIL | Database error PGRST205 |
| Business user cannot read foreign site | PASS | RLS returned no foreign site rows |
| Business user cannot read foreign cameras | FAIL | Database error PGRST205 |
| Business user cannot read foreign events | PASS | RLS returned no foreign event rows |
| Business user cannot read foreign known people | FAIL | Database error PGRST205 |
| Business user cannot read foreign clips | FAIL | Database error PGRST205 |
| Business user cannot read foreign deliveries | FAIL | Database error PGRST205 |
| Retention is capped for Digital Observer | FAIL | Database error 42703 |
| No package activates live providers | FAIL | Database error 42703 |
| Commercial package matrix is complete | FAIL | Database error 42703 |

Final result: FAIL
Passed: 10/33

> This runtime QA uses normal Supabase authentication and RLS. It does not validate a real camera gateway, AI provider, billing provider or production notification provider.

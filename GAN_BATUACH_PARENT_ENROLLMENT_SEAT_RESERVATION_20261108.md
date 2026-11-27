# Parent enrollment seat reservation — isolated Development

Task: `GB-PRODUCT-PARENT-ENROLLMENT-SEAT-RESERVATION-20261107`
Source Development SHA: `5c8a9762dc90d839f91885ba79722770f710a429`
Feature branch: `codex/parent-enrollment-seat-status-20261108`

## Exact synthetic journey and protected evidence

The canonical `DEVELOPMENT / INTEGRATION` Product at the source SHA reported `LOCAL_SUPABASE` and `production:false`. The local database guard confirmed the dedicated `gan-batuach-integration` container. A read-only preflight found the one previously submitted synthetic request `7811740b-d8e7-4f0e-b056-122cf2f8a15b`, no reservation, no active Child enrollment, no payment evidence and no accepted external delivery. Garden A was active, public and accepting. Its age-compatible QA A2 Classroom had capacity 15, 3 occupied and 0 reserved seats. No fixture or new request was created in this unit.

One authenticated Garden Manager review and one approval returned HTTP 200. The approval selected the preflighted Classroom and persisted `awaiting_payment`, `payment_status=pending` and exactly one active, request-owned seat reservation. The database readback occurred before the documented idempotent approval retry; the retry returned the same state without extra audit, notification or reservation. The authorized Parent saw the same request through the Parent API. Foreign Parent and Manager, Staff and guest boundary probes denied or omitted the request as required. Active enrollment, payment evidence and accepted external delivery remained zero. No manual activation or real payment occurred.

The original private Product receipt is preserved unchanged at `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/parent-enrollment-seat-reservation-20261107/receipt.json`, SHA-256 `eb15ac14ba81e7e5ce49e90290ecfda45c10777f8e22038d34e43a653354716a`. Its **overall status is BLOCKED**, although all 20 completed checks passed. It captured settled Manager Desktop/Mobile evidence, but the Parent screenshot assertion timed out. This is not a full-run PASS.

## Narrow Product correction

The Parent dashboard's existing `formatStatus` map omitted canonical `awaiting_payment` and `pending`, causing raw enum values to appear in the Child's request card after the legitimate Manager decision. It also omitted the adjacent canonical `waitlisted`, `payment_reconciliation_required`, `activated` and `paid` labels. This feature change adds only those Hebrew display labels. It leaves the unknown-value fallback intact and changes no request API, SQL, RLS, role scope, reservation, enrollment, payment or notification behavior. The label `ממתינה להסדר` describes a request awaiting a manual arrangement; it does not assert that payment was made or activation completed.

TypeScript typecheck passed. Focused enrollment lifecycle checks passed 7/7. Focused ESLint reported 12 existing `no-explicit-any` errors on the Parent page; the unmodified source at the parent commit reports the same 12 errors at shifted line numbers, so the scoped change adds zero lint findings. Exact-head remote CI and the settled Parent Desktop/Mobile read-only capture remain required. The original write receipt must never be rerun to recreate its starting state; post-fix verification must only read the existing approved request and one reservation.

## Boundaries and remaining gates

No schema or migration, Auth, provider, Digital Observer core, main or Production change. No paid supplier or fixed monthly commitment was added. The owner reported zero paying users and a ₪1,000/month prelaunch ceiling; all-in cash burn and ₪15/user compliance remain unverified, so this report does not claim financial approval. Feature publication, six exact-head CI gates, canonical Development integration/ledger, post-merge read-only QA and external owner UX acceptance are pending until separately evidenced. The source-only fix is not evidence of a live payment provider or Production readiness.

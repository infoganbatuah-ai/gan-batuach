# Document expiry QA fixture collision

Task: `GB-DOCUMENT-QA-FIXTURE-COLLISION-20261114`
Source Development SHA: `8e94c0073f9d103815af70122d7ed0ebf5f1d99d`
Scope: one rollback-only SQL assertion; no Product, migration, provider, or Production change.

The legacy `check-management-documents-rls.sql` suite expected the global document-expiry queue to insert exactly one notification on its first call. That queue scans every eligible document in the database, while the test inserts only one *additional* target fixture. In a protected, isolated QA dump (SHA-256 `21800a931151c6fad5a9c9b4c6ef26b2403252a26b2816b213d477423c1326b6`), two other documents were already eligible. The target fixture ID did not exist before the test. The unmodified rollback-only suite reproduced `expiry_notification_not_idempotent` in a uniquely named disposable restored database.

The corrected assertion requires at least one first-call insertion and zero second-call insertions. The immediately following assertion still requires exactly one notification for the target document's dedupe key; the revoked-staff exclusion and all preceding role/RLS assertions remain intact. This tests queue idempotency and the fixture's behavior without assuming an empty QA database. It does not change queue behavior or weaken an access-control test.

The corrected suite passed twice in the disposable restored database with `ON_ERROR_STOP=1` and exit code 0. Each run ended in rollback: documents remained 14, target fixture ID and target notification remained absent. The canonical isolated QA database also retained 14 documents and no target fixture. The disposable database was deleted and its absence verified. The exclusive external `gbi` runtime lease was released. No real user files or Production data were accessed or modified.

This is an isolated synthetic-data regression check. It does not prove live provider delivery, Production RLS, or full Product functionality. The global queue remains bounded by its existing 100-item test limit; if a future QA database has more than 100 eligible documents, the target-specific assertion will correctly fail unless the test is redesigned to control queue ordering in a dedicated fixture database.

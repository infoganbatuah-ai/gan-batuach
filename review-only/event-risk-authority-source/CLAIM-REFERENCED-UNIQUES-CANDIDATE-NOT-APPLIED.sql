-- REVIEW ONLY. No deployable migration. Never run against a database.
-- The first executable block aborts; all candidate DDL is commented out.
BEGIN;
DO $review_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: separate Development write approval and preflight required';
END;
$review_guard$;
ROLLBACK;

/* FUTURE CANDIDATE ONLY, NOT EXECUTABLE FROM THIS FILE.
   Requires separately ordered, non-transactional migration units and all
   gates in CLAIM-REFERENCED-UNIQUES-MIGRATION-PREFLIGHT-20261027.md.
   Check absence/name collision and historical authority before each unit.

CREATE UNIQUE INDEX CONCURRENTLY observer_sites_id_org_draft_uidx
  ON public.observer_sites (id, digital_observer_organization_id);

CREATE UNIQUE INDEX CONCURRENTLY observer_signal_id_site_draft_uidx
  ON public.observer_intelligence_signals (id, observer_site_id);

CREATE UNIQUE INDEX CONCURRENTLY observer_incident_id_site_draft_uidx
  ON public.observer_correlated_events (id, observer_site_id);

CREATE UNIQUE INDEX CONCURRENTLY observer_risk_result_scope_draft_uidx
  ON public.digital_observer_risk_evaluations
    (id, observer_site_id, triggering_event_id, risk_engine_version);
*/

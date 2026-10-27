-- REVIEW ONLY. NEVER execute this file against any database.
-- The executable prefix aborts before the commented candidate queries.
BEGIN READ ONLY;
DO $historical_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_RUN: historical aggregate row access needs separate owner authorization';
END;
$historical_guard$;
ROLLBACK;

/* FUTURE OWNER-AUTHORIZED LOCAL DEVELOPMENT READ ONLY CANDIDATE ONLY.
   Identity/backup preflight must pass outside this file first. Use psql -X
   -v ON_ERROR_STOP=1, never an application or Production connection. Do not
   print or persist user rows, IDs, low-cardinality groups or secrets.
   Four COUNT-only statements; no GROUP BY or row sampling. One transaction;
   stop on any timeout/error. Review actual plan/cost before execution.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '250ms';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL work_mem = '4MB';

-- S1: current Site scope is nullable; garden_id does not establish Model A Tenant.
SELECT count(*) AS site_total,
       count(*) FILTER (WHERE digital_observer_organization_id IS NULL) AS site_tenant_null,
       count(*) FILTER (WHERE digital_observer_organization_id IS NULL AND garden_id IS NOT NULL) AS site_tenant_null_garden_present,
       count(*) FILTER (WHERE digital_observer_organization_id IS NULL AND garden_id IS NULL) AS site_tenant_null_garden_absent
FROM public.observer_sites;

-- S2: Signal's current Site FK; reference existence does not freeze event-time scope.
SELECT count(*) AS signal_total,
       count(*) FILTER (WHERE sig.observer_site_id IS NULL) AS signal_site_null,
       count(*) FILTER (WHERE sig.observer_site_id IS NOT NULL AND site.id IS NULL) AS signal_site_missing,
       count(*) FILTER (WHERE site.id IS NOT NULL AND site.digital_observer_organization_id IS NULL) AS signal_site_tenant_null,
       count(*) FILTER (WHERE sig.observer_site_id IS NULL AND sig.kindergarten_id IS NOT NULL) AS signal_legacy_garden_without_site
FROM public.observer_intelligence_signals AS sig
LEFT JOIN public.observer_sites AS site ON site.id = sig.observer_site_id;

-- S3: Incident's current Site FK; legacy kindergarten scope is not Tenant proof.
SELECT count(*) AS incident_total,
       count(*) FILTER (WHERE incident.observer_site_id IS NULL) AS incident_site_null,
       count(*) FILTER (WHERE incident.observer_site_id IS NOT NULL AND site.id IS NULL) AS incident_site_missing,
       count(*) FILTER (WHERE site.id IS NOT NULL AND site.digital_observer_organization_id IS NULL) AS incident_site_tenant_null,
       count(*) FILTER (WHERE incident.observer_site_id IS NULL AND incident.kindergarten_id IS NOT NULL) AS incident_legacy_garden_without_site
FROM public.observer_correlated_events AS incident
LEFT JOIN public.observer_sites AS site ON site.id = incident.observer_site_id;

-- S4: Risk has non-null references, but current Signal/Incident Site may differ.
SELECT count(*) AS risk_total,
       count(*) FILTER (WHERE site.id IS NULL) AS risk_site_missing,
       count(*) FILTER (WHERE site.id IS NOT NULL AND site.digital_observer_organization_id IS NULL) AS risk_site_tenant_null,
       count(*) FILTER (WHERE sig.id IS NULL) AS risk_signal_missing,
       count(*) FILTER (WHERE sig.id IS NOT NULL AND sig.observer_site_id IS NULL) AS risk_signal_site_null,
       count(*) FILTER (WHERE sig.observer_site_id IS NOT NULL AND sig.observer_site_id <> risk.observer_site_id) AS risk_signal_site_mismatch,
       count(*) FILTER (WHERE incident.id IS NULL) AS risk_incident_missing,
       count(*) FILTER (WHERE incident.id IS NOT NULL AND incident.observer_site_id IS NULL) AS risk_incident_site_null,
       count(*) FILTER (WHERE incident.observer_site_id IS NOT NULL AND incident.observer_site_id <> risk.observer_site_id) AS risk_incident_site_mismatch
FROM public.digital_observer_risk_evaluations AS risk
LEFT JOIN public.observer_sites AS site ON site.id = risk.observer_site_id
LEFT JOIN public.observer_intelligence_signals AS sig ON sig.id = risk.triggering_event_id
LEFT JOIN public.observer_correlated_events AS incident ON incident.id = risk.incident_id;

ROLLBACK;
*/

-- REVIEW QUERY ONLY — NOT RUN. Read-only, no repair, no DDL, no exports.
-- Run only after separate authorization against the exact isolated target.
-- Inspect counts first; pseudonymous references below are for restricted
-- remediation review, not public logs or PR comments.
WITH scope AS (
  SELECT r.id AS risk_id, r.observer_site_id AS risk_site,
         i.observer_site_id AS incident_site,
         s.observer_site_id AS signal_site,
         i.id IS NULL AS incident_missing,
         s.id IS NULL AS signal_missing
  FROM public.digital_observer_risk_evaluations AS r
  LEFT JOIN public.observer_correlated_events AS i ON i.id = r.incident_id
  LEFT JOIN public.observer_intelligence_signals AS s ON s.id = r.triggering_event_id
)
SELECT count(*) AS risk_rows,
       count(*) FILTER (WHERE incident_missing) AS missing_incident,
       count(*) FILTER (WHERE signal_missing) AS missing_signal,
       count(*) FILTER (WHERE risk_site IS DISTINCT FROM incident_site AND NOT incident_missing)
         AS risk_incident_site_mismatch,
       count(*) FILTER (WHERE risk_site IS DISTINCT FROM signal_site AND NOT signal_missing)
         AS risk_signal_site_mismatch,
       count(*) FILTER (WHERE incident_site IS DISTINCT FROM signal_site
                        AND NOT incident_missing AND NOT signal_missing)
         AS incident_signal_site_mismatch
FROM scope;

-- Run only in a restricted evidence channel if counts above are nonzero.
-- The truncated hash is an investigation handle, not a reversible row ID.
SELECT left(md5(r.id::text), 16) AS risk_ref,
       (r.observer_site_id IS DISTINCT FROM i.observer_site_id) AS incident_mismatch,
       (r.observer_site_id IS DISTINCT FROM s.observer_site_id) AS signal_mismatch
FROM public.digital_observer_risk_evaluations AS r
JOIN public.observer_correlated_events AS i ON i.id = r.incident_id
JOIN public.observer_intelligence_signals AS s ON s.id = r.triggering_event_id
WHERE r.observer_site_id IS DISTINCT FROM i.observer_site_id
   OR r.observer_site_id IS DISTINCT FROM s.observer_site_id
ORDER BY r.created_at
LIMIT 100;

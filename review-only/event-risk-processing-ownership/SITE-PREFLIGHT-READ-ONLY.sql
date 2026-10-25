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

-- Home-scope shape only; this does not define Tenant or prove ownership.
-- A missing organization is expected to be possible, not auto-repaired.
SELECT count(*) AS eligible_nongarden_sites,
       count(*) FILTER (WHERE owner_profile_id IS NULL) AS missing_owner_profile,
       count(*) FILTER (WHERE digital_observer_organization_id IS NULL)
         AS no_organization,
       count(*) FILTER (WHERE digital_observer_organization_id IS NOT NULL)
         AS has_organization
FROM public.observer_sites
WHERE garden_id IS NULL AND site_type IS DISTINCT FROM 'kindergarten';

-- Candidate Tenant classification only, never an automatic backfill rule.
-- Keep categories disjoint: missing refs, ambiguous Tenant, cross-Tenant,
-- same-Tenant Site mismatch, valid candidate chain.
WITH classified AS (
  SELECT CASE
    WHEN i.id IS NULL OR s.id IS NULL OR rs.id IS NULL
      OR ins.id IS NULL OR ss.id IS NULL THEN 'MISSING_REFERENCE'
    WHEN rs.digital_observer_organization_id IS NULL
      OR ins.digital_observer_organization_id IS NULL
      OR ss.digital_observer_organization_id IS NULL THEN 'AMBIGUOUS_TENANT'
    WHEN rs.digital_observer_organization_id IS DISTINCT FROM ins.digital_observer_organization_id
      OR rs.digital_observer_organization_id IS DISTINCT FROM ss.digital_observer_organization_id
      THEN 'CROSS_TENANT_CANDIDATE'
    WHEN r.observer_site_id IS DISTINCT FROM i.observer_site_id
      OR r.observer_site_id IS DISTINCT FROM s.observer_site_id
      THEN 'SITE_MISMATCH'
    ELSE 'VALID_CANDIDATE'
  END AS category
  FROM public.digital_observer_risk_evaluations AS r
  LEFT JOIN public.observer_correlated_events AS i ON i.id = r.incident_id
  LEFT JOIN public.observer_intelligence_signals AS s ON s.id = r.triggering_event_id
  LEFT JOIN public.observer_sites AS rs ON rs.id = r.observer_site_id
  LEFT JOIN public.observer_sites AS ins ON ins.id = i.observer_site_id
  LEFT JOIN public.observer_sites AS ss ON ss.id = s.observer_site_id
)
SELECT category, count(*) AS rows FROM classified GROUP BY category ORDER BY category;

-- Approved/delivered enrollment coverage for the proposed composite FK.
SELECT count(*) AS scoped_enrollments,
       count(*) FILTER (WHERE e.tenant_id IS NULL) AS missing_enrollment_tenant,
       count(*) FILTER (WHERE s.digital_observer_organization_id IS NULL)
         AS ambiguous_site_tenant,
       count(*) FILTER (WHERE e.tenant_id IS NOT NULL
         AND s.digital_observer_organization_id IS NOT NULL
         AND e.tenant_id IS DISTINCT FROM s.digital_observer_organization_id)
         AS enrollment_site_tenant_mismatch
FROM public.video_gateway_device_enrollments AS e
LEFT JOIN public.observer_sites AS s ON s.id = e.observer_site_id
WHERE e.status IN ('approved', 'delivered')
  AND (s.garden_id IS NULL OR s.id IS NULL);

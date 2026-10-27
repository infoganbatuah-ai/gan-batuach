-- REVIEW ONLY. Never apply to Development or Production. Direct execution aborts.
-- Candidate depends on the separately guarded Home acceptance and correlation
-- contracts. Existing rows require an independently reviewed, non-ambiguous
-- migration; this file provides no backfill and no caller grants.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: live correlation, authority and backfill unverified';
END $guard$;

ALTER TABLE observer_home_review.event_bindings
  ADD COLUMN incident_id uuid REFERENCES public.observer_correlated_events(id)
  ON DELETE RESTRICT;
-- NOT VALID avoids pretending legacy receipts were reconciled; PostgreSQL
-- still enforces this constraint for every new proposed binding row.
ALTER TABLE observer_home_review.event_bindings
  ADD CONSTRAINT event_binding_incident_required
  CHECK (incident_id IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION observer_home_review.bind_accepted_event_v1(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $bind$
DECLARE
  a observer_home_review.event_acceptances%ROWTYPE;
  b observer_home_review.event_bindings%ROWTYPE;
  l public.observer_correlated_event_links%ROWTYPE;
  i public.observer_correlated_events%ROWTYPE;
  new_binding_ref uuid := pg_catalog.gen_random_uuid();
  new_audit_ref uuid := pg_catalog.gen_random_uuid();
  inserted_count integer;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'HOME_EVENT_ID_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT * INTO a FROM observer_home_review.event_acceptances
    WHERE event_id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOME_EVENT_ACCEPTANCE_UNVERIFIED' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM observer_home_review.registration_versions v
    WHERE v.registration_id=a.registration_id AND v.version=a.registration_version
      AND v.tenant_id=a.tenant_id AND v.site_id=a.site_id
      AND v.source_id=a.source_id AND v.owner_profile_id=a.owner_profile_id
      AND v.authority_ref=a.authority_ref
  ) THEN
    RAISE EXCEPTION 'HOME_EVENT_AUTHORITY_HISTORY_CONFLICT' USING ERRCODE='P0001';
  END IF;
  -- The source-defined correlation must be unique for this source type/id.
  -- STRICT rejects absence and ambiguity; no arbitrary first-row choice.
  BEGIN
    SELECT * INTO STRICT l FROM public.observer_correlated_event_links
      WHERE source_type='observer_intelligence_signal' AND source_id=p_event_id
      FOR SHARE;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RAISE EXCEPTION 'HOME_INCIDENT_LINK_UNVERIFIED' USING ERRCODE='P0001';
  END;
  SELECT * INTO i FROM public.observer_correlated_events
    WHERE id=l.correlated_event_id FOR SHARE;
  IF NOT FOUND OR l.observer_site_id IS DISTINCT FROM a.site_id
    OR i.observer_site_id IS DISTINCT FROM a.site_id
    OR i.primary_camera_source_id IS DISTINCT FROM a.source_id
    OR NOT (i.related_event_ids @> ARRAY[p_event_id]) THEN
    RAISE EXCEPTION 'HOME_INCIDENT_SCOPE_UNVERIFIED' USING ERRCODE='P0001';
  END IF;
  INSERT INTO observer_home_review.event_bindings
    (event_id,registration_id,registration_version,tenant_id,site_id,
     source_id,owner_profile_id,authority_ref,acceptance_ref,incident_id,
     binding_ref,binding_audit_ref)
  VALUES
    (a.event_id,a.registration_id,a.registration_version,a.tenant_id,a.site_id,
     a.source_id,a.owner_profile_id,a.authority_ref,a.acceptance_ref,i.id,
     new_binding_ref,new_audit_ref)
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  SELECT * INTO b FROM observer_home_review.event_bindings WHERE event_id=p_event_id;
  IF NOT FOUND OR b.registration_id IS DISTINCT FROM a.registration_id
    OR b.registration_version IS DISTINCT FROM a.registration_version
    OR b.tenant_id IS DISTINCT FROM a.tenant_id OR b.site_id IS DISTINCT FROM a.site_id
    OR b.source_id IS DISTINCT FROM a.source_id
    OR b.owner_profile_id IS DISTINCT FROM a.owner_profile_id
    OR b.authority_ref IS DISTINCT FROM a.authority_ref
    OR b.acceptance_ref IS DISTINCT FROM a.acceptance_ref
    OR b.incident_id IS DISTINCT FROM i.id THEN
    RAISE EXCEPTION 'HOME_EVENT_BINDING_CONFLICT' USING ERRCODE='P0001';
  END IF;
  IF inserted_count=1 THEN
    INSERT INTO observer_home_review.registration_audit
      (audit_ref,action,registration_id,version,event_id)
    VALUES (new_audit_ref,'BOUND',a.registration_id,a.registration_version,a.event_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM observer_home_review.registration_audit q
    WHERE q.audit_ref=b.binding_audit_ref AND q.action='BOUND'
      AND q.registration_id=b.registration_id AND q.version=b.registration_version
      AND q.event_id=b.event_id
  ) THEN
    RAISE EXCEPTION 'HOME_EVENT_MANDATORY_AUDIT_MISSING' USING ERRCODE='P0001';
  END IF;
  RETURN b.binding_ref;
END $bind$;
REVOKE ALL ON FUNCTION observer_home_review.bind_accepted_event_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
-- No COMMIT, live adapter, Data API exposure, broad grant or historical rewrite.

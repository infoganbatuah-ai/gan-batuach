-- OFFLINE PROPOSAL ONLY. Never source or migrate this file.
-- A deliberately aborted transaction precedes every definition. There is no COMMIT.
-- The three bodies below depend on DRAFT-NOT-APPLIED.sql and a separately
-- verified, authoritative Model A Site -> customer Tenant mapping. Neither
-- prerequisite is deployed. These bodies are NOT qualified for application.
BEGIN;
DO $draft_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: separate migration and ownership approval required';
END;
$draft_guard$;

-- PROPOSED BODY 1/7. Caller: server-side service_role only. One SQL function
-- call is one transaction. The PK serializes contenders; a failed contender
-- receives BUSY and must not calculate. Physical CPU exactly-once is not claimed.
CREATE FUNCTION public.claim_event_risk_v1(
  p_signal_id uuid, p_engine_version text, p_owner_nonce uuid, p_lease_seconds integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp AS $claim$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_signal public.observer_intelligence_signals%ROWTYPE;
  v_site public.observer_sites%ROWTYPE;
  v_org public.digital_observer_organizations%ROWTYPE;
  v_link public.observer_correlated_event_links%ROWTYPE;
  v_incident public.observer_correlated_events%ROWTYPE;
  v_claim public.observer_event_risk_claims%ROWTYPE;
  v_event_type text;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'RISK_CALLER_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_signal_id IS NULL OR p_owner_nonce IS NULL OR p_engine_version IS NULL
     OR p_engine_version <> 'do-risk-v1'
     OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'RISK_CLAIM_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_signal FROM public.observer_intelligence_signals
    WHERE id = p_signal_id FOR UPDATE;
  IF NOT FOUND OR v_signal.observer_site_id IS NULL
     OR v_signal.source_type <> 'system' OR v_signal.signal_type <> 'ai_camera'
     OR v_signal.metadata->>'observation_provenance' <> 'REAL_CAMERA_AI'
     OR v_signal.metadata->>'validated_event' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RISK_EVENT_UNTRUSTED' USING ERRCODE = '23514';
  END IF;
  v_event_type := v_signal.metadata->>'event_type';
  IF v_event_type NOT IN ('person_entered','person_exited') THEN
    RAISE EXCEPTION 'RISK_EVENT_TYPE_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_site FROM public.observer_sites
    WHERE id = v_signal.observer_site_id FOR SHARE;
  IF NOT FOUND OR v_site.garden_id IS NOT NULL
     OR v_site.site_type = 'kindergarten'
     OR v_site.active IS DISTINCT FROM true
     OR v_site.monitoring_enabled IS DISTINCT FROM true
     OR v_site.metadata->>'observer_monitoring_consent' IS DISTINCT FROM 'true'
     OR v_site.digital_observer_organization_id IS NULL THEN
    RAISE EXCEPTION 'RISK_TENANT_MAPPING_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_org FROM public.digital_observer_organizations
    WHERE id = v_site.digital_observer_organization_id FOR SHARE;
  IF NOT FOUND OR v_org.active IS DISTINCT FROM true
     OR v_org.organization_type NOT IN ('family','business') THEN
    RAISE EXCEPTION 'RISK_TENANT_MAPPING_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.digital_observer_camera_sources c
    WHERE c.id::text = v_signal.metadata->>'camera_source_id'
      AND c.observer_site_id = v_site.id
  ) THEN
    RAISE EXCEPTION 'RISK_SOURCE_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_link FROM public.observer_correlated_event_links
    WHERE source_type = 'observer_intelligence_signal' AND source_id = p_signal_id
    FOR SHARE;
  IF NOT FOUND AND v_event_type = 'person_exited' THEN
    RETURN pg_catalog.jsonb_build_object('kind','NOT_APPLICABLE');
  END IF;
  IF NOT FOUND OR v_link.observer_site_id IS DISTINCT FROM v_site.id THEN
    RAISE EXCEPTION 'RISK_LINK_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_incident FROM public.observer_correlated_events
    WHERE id = v_link.correlated_event_id FOR SHARE;
  IF NOT FOUND OR v_incident.observer_site_id IS DISTINCT FROM v_site.id
     OR v_incident.provenance IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR v_incident.primary_camera_source_id::text
        IS DISTINCT FROM v_signal.metadata->>'camera_source_id' THEN
    RAISE EXCEPTION 'RISK_INCIDENT_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;

  -- Re-sample after potentially waiting on canonical row locks; a timestamp
  -- sampled at function entry could issue an already-expired lease.
  v_now := pg_catalog.clock_timestamp();

  INSERT INTO public.observer_event_risk_claims (
    signal_id, risk_engine_version, tenant_id, observer_site_id, incident_id,
    owner_nonce, owner_epoch, lease_expires_at
  ) VALUES (
    p_signal_id, p_engine_version, v_site.digital_observer_organization_id,
    v_site.id, v_incident.id, p_owner_nonce, 1,
    v_now + pg_catalog.make_interval(secs => p_lease_seconds)
  ) ON CONFLICT (signal_id, risk_engine_version) DO NOTHING
  RETURNING * INTO v_claim;
  IF FOUND THEN
    -- Mandatory bounded security/ownership audit. A failed audit aborts the
    -- claim transaction; nonce is deliberately absent from metadata.
    INSERT INTO public.immutable_audit_events (
      event_type,event_category,actor_role,target_type,target_id,incident_id,
      metadata,risk_level
    ) VALUES (
      'observer_event_risk_claim_acquired_v1','observer','service_role',
      'observer_intelligence_signal',p_signal_id,v_incident.id,
      pg_catalog.jsonb_build_object('site_id',v_site.id,'tenant_id',v_site.digital_observer_organization_id,
        'risk_engine_version',p_engine_version,'owner_epoch',1),'medium'
    );
    RETURN pg_catalog.jsonb_build_object('kind','OWNED','owner_epoch',1,
      'lease_expires_at',v_claim.lease_expires_at);
  END IF;

  SELECT * INTO v_claim FROM public.observer_event_risk_claims
    WHERE signal_id = p_signal_id AND risk_engine_version = p_engine_version
    FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  IF NOT FOUND OR v_claim.tenant_id IS DISTINCT FROM v_site.digital_observer_organization_id
     OR v_claim.observer_site_id IS DISTINCT FROM v_site.id
     OR v_claim.incident_id IS DISTINCT FROM v_incident.id THEN
    RAISE EXCEPTION 'RISK_CLAIM_SCOPE_CONFLICT' USING ERRCODE = '23514';
  END IF;
  IF v_claim.status = 'COMPLETED' THEN
    RETURN pg_catalog.jsonb_build_object('kind','COMPLETED',
      'evaluation_id',v_claim.risk_evaluation_id);
  END IF;
  IF v_claim.status NOT IN ('CLAIMED','RISK_PERSISTED','EFFECTS_PENDING') THEN
    RAISE EXCEPTION 'RISK_CLAIM_STATE_INVALID' USING ERRCODE = '23514';
  END IF;
  IF v_claim.lease_expires_at > v_now THEN
    RETURN pg_catalog.jsonb_build_object('kind','BUSY',
      'retry_after',v_claim.lease_expires_at);
  END IF;
  IF v_claim.owner_nonce = p_owner_nonce OR v_claim.owner_epoch = 9223372036854775807 THEN
    RAISE EXCEPTION 'RISK_OWNER_TOKEN_INVALID' USING ERRCODE = '23514';
  END IF;
  UPDATE public.observer_event_risk_claims SET
    owner_nonce = p_owner_nonce, owner_epoch = v_claim.owner_epoch + 1,
    lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
    updated_at = v_now
  WHERE signal_id = p_signal_id AND risk_engine_version = p_engine_version
    AND owner_epoch = v_claim.owner_epoch AND lease_expires_at <= v_now
  RETURNING * INTO v_claim;
  IF NOT FOUND THEN RAISE EXCEPTION 'RISK_OWNER_RACE' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.immutable_audit_events (
    event_type,event_category,actor_role,target_type,target_id,incident_id,
    metadata,risk_level
  ) VALUES (
    'observer_event_risk_claim_recovered_v1','observer','service_role',
    'observer_intelligence_signal',p_signal_id,v_incident.id,
    pg_catalog.jsonb_build_object('site_id',v_site.id,'tenant_id',v_site.digital_observer_organization_id,
      'risk_engine_version',p_engine_version,'owner_epoch',v_claim.owner_epoch),'medium'
  );
  RETURN pg_catalog.jsonb_build_object(
    'kind',CASE WHEN v_claim.risk_evaluation_id IS NULL THEN 'OWNED' ELSE 'RESUME_EFFECTS' END,
    'owner_epoch',v_claim.owner_epoch,'lease_expires_at',v_claim.lease_expires_at,
    'evaluation_id',v_claim.risk_evaluation_id);
END;
$claim$;

-- PROPOSED BODY 2/7. Conditional UPDATE is the fencing point. The caller
-- must still prove the server-generated nonce and epoch; a stale owner cannot
-- renew after takeover or lease expiry. Routine renewals are not individually
-- audited to avoid unbounded event volume; acquisition/takeover is audited,
-- while rejected attempts require bounded server-side security logging.
-- No standalone lease authorizes writes.
CREATE FUNCTION public.renew_event_risk_lease_v1(
  p_signal_id uuid, p_engine_version text, p_owner_nonce uuid,
  p_owner_epoch bigint, p_lease_seconds integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp AS $renew$
DECLARE
  v_claim public.observer_event_risk_claims%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'RISK_CALLER_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_signal_id IS NULL OR p_owner_nonce IS NULL OR p_owner_epoch IS NULL
     OR p_owner_epoch < 1 OR p_engine_version IS DISTINCT FROM 'do-risk-v1'
     OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'RISK_RENEW_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE public.observer_event_risk_claims c SET
    lease_expires_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => p_lease_seconds),
    updated_at = pg_catalog.clock_timestamp()
  WHERE c.signal_id = p_signal_id AND c.risk_engine_version = p_engine_version
    AND c.owner_nonce = p_owner_nonce AND c.owner_epoch = p_owner_epoch
    AND c.lease_expires_at > pg_catalog.clock_timestamp()
    AND c.status IN ('CLAIMED','RISK_PERSISTED','EFFECTS_PENDING')
    AND EXISTS (
      SELECT 1 FROM public.observer_sites s
      WHERE s.id = c.observer_site_id
        AND s.digital_observer_organization_id = c.tenant_id
        AND s.garden_id IS NULL AND s.site_type <> 'kindergarten'
        AND s.active = true AND s.monitoring_enabled = true
        AND s.metadata->>'observer_monitoring_consent' = 'true'
    )
    AND EXISTS (
      SELECT 1 FROM public.observer_intelligence_signals e
      WHERE e.id = c.signal_id AND e.observer_site_id = c.observer_site_id
        AND e.source_type = 'system' AND e.signal_type = 'ai_camera'
        AND e.metadata->>'observation_provenance' = 'REAL_CAMERA_AI'
        AND e.metadata->>'validated_event' = 'true'
        AND EXISTS (
          SELECT 1 FROM public.digital_observer_camera_sources camera
          WHERE camera.id::text = e.metadata->>'camera_source_id'
            AND camera.observer_site_id = c.observer_site_id
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.observer_correlated_event_links l
      WHERE l.source_type = 'observer_intelligence_signal'
        AND l.source_id = c.signal_id AND l.correlated_event_id = c.incident_id
        AND l.observer_site_id = c.observer_site_id
    )
    AND EXISTS (
      SELECT 1 FROM public.observer_correlated_events i
      WHERE i.id = c.incident_id AND i.observer_site_id = c.observer_site_id
        AND i.provenance = 'REAL_CAMERA_AI'
    )
    AND EXISTS (
      SELECT 1 FROM public.digital_observer_organizations o
      WHERE o.id = c.tenant_id AND o.active = true
        AND o.organization_type IN ('family','business')
    )
  RETURNING * INTO v_claim;
  IF NOT FOUND THEN RAISE EXCEPTION 'RISK_OWNER_FENCED_OR_SCOPE_LOST' USING ERRCODE = '42501'; END IF;
  RETURN pg_catalog.jsonb_build_object('kind','RENEWED',
    'owner_epoch',v_claim.owner_epoch,'lease_expires_at',v_claim.lease_expires_at);
END;
$renew$;

-- PROPOSED BODY 7/7. The acquisition function is the single takeover path;
-- this wrapper refuses a fresh/live claim, then delegates to the same atomic
-- lock/epoch transition. Races resolve as BUSY, never as a second owner.
CREATE FUNCTION public.recover_expired_event_risk_v1(
  p_signal_id uuid, p_engine_version text, p_owner_nonce uuid, p_lease_seconds integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp AS $recover$
DECLARE
  v_claim public.observer_event_risk_claims%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'RISK_CALLER_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_claim FROM public.observer_event_risk_claims
    WHERE signal_id = p_signal_id AND risk_engine_version = p_engine_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'RISK_RECOVERY_CLAIM_MISSING' USING ERRCODE = '23514'; END IF;
  -- The acquisition body revalidates the entire canonical scope before it
  -- returns BUSY or COMPLETED. Never leak claim state from this pre-read.
  RETURN public.claim_event_risk_v1(
    p_signal_id,p_engine_version,p_owner_nonce,p_lease_seconds);
END;
$recover$;

-- Exact-function ACL sketch. Deployed default privileges grant new public
-- functions to anon/authenticated/service_role. Revoke in the SAME future
-- creation transaction, before any commit. Do not alter shared default ACL.
REVOKE ALL ON FUNCTION public.claim_event_risk_v1(uuid,text,uuid,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_event_risk_lease_v1(uuid,text,uuid,bigint,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_expired_event_risk_v1(uuid,text,uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_risk_v1(uuid,text,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_event_risk_lease_v1(uuid,text,uuid,bigint,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_expired_event_risk_v1(uuid,text,uuid,integer) TO service_role;

-- Operations 3-6 are deliberately NOT defined: immutable Risk persistence,
-- frozen effect plan, fenced effect write, and completion still require exact
-- field-by-field semantic duplicate validation, Incident CAS, audit and
-- notification writer changes. See SEVEN-RPC-IMPLEMENTATION.md.

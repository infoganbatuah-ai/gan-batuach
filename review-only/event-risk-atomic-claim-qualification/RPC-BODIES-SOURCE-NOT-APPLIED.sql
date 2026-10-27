-- OFFLINE PROPOSAL ONLY. Never source or migrate this file.
-- A deliberately aborted transaction precedes every definition. There is no COMMIT.
-- The three bodies below depend on DRAFT-NOT-APPLIED.sql, the separately
-- guarded Home acceptance schema, a frozen Incident binding, and a separately
-- verified, authoritative Model A Site -> customer Tenant mapping. None of
-- those prerequisites is deployed. These bodies are NOT qualified to apply.
BEGIN;
DO $draft_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: separate migration and ownership approval required';
END;
$draft_guard$;

-- BLOCKED additive dependency, not a deployable migration: the sole proposed
-- event_bindings.incident_id definition and NOT VALID new-write constraint
-- live in ../event-risk-authority-source/FROZEN-INCIDENT-BINDING-NOT-APPLIED.sql.
-- The Home acceptance writer must populate the server-derived Incident ID in
-- the same transaction as canonical association. Never infer/backfill old rows.
-- Install neither body until the dependency and caller permissions are reviewed.

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
  v_registration observer_home_review.registration_identities%ROWTYPE;
  v_version observer_home_review.registration_versions%ROWTYPE;
  v_acceptance observer_home_review.event_acceptances%ROWTYPE;
  v_binding observer_home_review.event_bindings%ROWTYPE;
  v_camera public.digital_observer_camera_sources%ROWTYPE;
  v_receipt_count bigint;
  v_expected_metadata jsonb;
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

  -- Read the immutable receipt only to identify the registration lock. The
  -- second read below is authoritative. Every registration writer and revoker
  -- must acquire this same identity lock before touching an accepted event.
  SELECT * INTO v_acceptance FROM observer_home_review.event_acceptances
    WHERE event_id = p_signal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RISK_EVENT_ACCEPTANCE_MISSING' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_registration FROM observer_home_review.registration_identities
    WHERE registration_id = v_acceptance.registration_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RISK_REGISTRATION_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_acceptance FROM observer_home_review.event_acceptances
    WHERE event_id = p_signal_id;
  IF NOT FOUND OR v_acceptance.registration_id IS DISTINCT FROM v_registration.registration_id
    OR v_registration.revoked IS DISTINCT FROM false
    OR v_registration.owner_epoch IS DISTINCT FROM v_acceptance.owner_epoch
    OR v_acceptance.tenant_id IS DISTINCT FROM v_registration.tenant_id
    OR v_acceptance.site_id IS DISTINCT FROM v_registration.site_id
    OR v_acceptance.source_id IS DISTINCT FROM v_registration.source_id
    OR v_acceptance.owner_profile_id IS DISTINCT FROM v_registration.owner_profile_id THEN
    RAISE EXCEPTION 'RISK_EVENT_ACCEPTANCE_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_version FROM observer_home_review.registration_versions
    WHERE registration_id = v_acceptance.registration_id
      AND version = v_acceptance.registration_version;
  IF NOT FOUND OR v_version.tenant_id IS DISTINCT FROM v_acceptance.tenant_id
    OR v_version.site_id IS DISTINCT FROM v_acceptance.site_id
    OR v_version.source_id IS DISTINCT FROM v_acceptance.source_id
    OR v_version.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id
    OR v_version.authority_ref IS DISTINCT FROM v_acceptance.authority_ref THEN
    RAISE EXCEPTION 'RISK_REGISTRATION_VERSION_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_binding FROM observer_home_review.event_bindings
    WHERE event_id = p_signal_id;
  IF NOT FOUND OR v_binding.registration_id IS DISTINCT FROM v_acceptance.registration_id
    OR v_binding.registration_version IS DISTINCT FROM v_acceptance.registration_version
    OR v_binding.tenant_id IS DISTINCT FROM v_acceptance.tenant_id
    OR v_binding.site_id IS DISTINCT FROM v_acceptance.site_id
    OR v_binding.source_id IS DISTINCT FROM v_acceptance.source_id
    OR v_binding.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id
    OR v_binding.authority_ref IS DISTINCT FROM v_acceptance.authority_ref
    OR v_binding.acceptance_ref IS DISTINCT FROM v_acceptance.acceptance_ref THEN
    RAISE EXCEPTION 'RISK_EVENT_BINDING_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT pg_catalog.count(*) INTO v_receipt_count
    FROM observer_home_review.registration_audit q
    WHERE q.action = 'ACCEPTED' AND q.event_id = p_signal_id
      AND q.registration_id = v_acceptance.registration_id
      AND q.version = v_acceptance.registration_version
      AND q.owner_epoch = v_acceptance.owner_epoch;
  IF v_receipt_count <> 1 THEN
    RAISE EXCEPTION 'RISK_EVENT_ACCEPTANCE_AUDIT_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT pg_catalog.count(*) INTO v_receipt_count
    FROM observer_home_review.registration_audit q
    WHERE q.action = 'BOUND' AND q.audit_ref = v_binding.binding_audit_ref
      AND q.event_id = p_signal_id
      AND q.registration_id = v_acceptance.registration_id
      AND q.version = v_acceptance.registration_version;
  IF v_receipt_count <> 1 THEN
    RAISE EXCEPTION 'RISK_EVENT_BINDING_AUDIT_INVALID' USING ERRCODE = '23514';
  END IF;
  -- The current reviewed acceptance writer only authorizes person_entered.
  -- Do not let the old no-link person_exited/NOT_APPLICABLE return bypass this
  -- receipt gate; exit support requires its own reviewed acceptance contract.
  IF pg_catalog.jsonb_typeof(v_acceptance.observation_snapshot) IS DISTINCT FROM 'object'
    OR NOT (v_acceptance.observation_snapshot ?& ARRAY[
      'siteId','sourceId','cameraId','streamId','eventType','severity',
      'confidence','occurredAt','trackId','evidenceKind','recordingRequired',
      'modelProvenance','verificationEvidence'])
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_acceptance.observation_snapshot)) <> 13
    OR v_acceptance.observation_snapshot->>'eventType' IS DISTINCT FROM 'person_entered'
    OR v_acceptance.observation_snapshot->>'cameraId' IS DISTINCT FROM v_acceptance.source_id::text
    OR v_acceptance.observation_snapshot->>'siteId' IS DISTINCT FROM v_acceptance.site_id::text THEN
    RAISE EXCEPTION 'RISK_EVENT_OBSERVATION_UNVERIFIED' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_signal FROM public.observer_intelligence_signals
    WHERE id = p_signal_id FOR UPDATE;
  IF NOT FOUND OR v_signal.observer_site_id IS NULL
     OR v_signal.source_type <> 'system' OR v_signal.signal_type <> 'ai_camera'
     OR v_signal.metadata->>'observation_provenance' <> 'REAL_CAMERA_AI'
     OR v_signal.metadata->>'validated_event' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RISK_EVENT_UNTRUSTED' USING ERRCODE = '23514';
  END IF;
  v_expected_metadata := pg_catalog.jsonb_build_object(
    'camera_source_id',v_acceptance.source_id,
    'stream_id',v_acceptance.observation_snapshot->>'streamId',
    'event_type',v_acceptance.observation_snapshot->>'eventType',
    'track_id',v_acceptance.observation_snapshot->>'trackId',
    'first_seen',v_acceptance.observation_snapshot->>'occurredAt',
    'evidence_kind',v_acceptance.observation_snapshot->>'evidenceKind',
    'recording_required',v_acceptance.observation_snapshot->'recordingRequired',
    'model_provenance',v_acceptance.observation_snapshot->'modelProvenance',
    'verification_evidence',v_acceptance.observation_snapshot->'verificationEvidence',
    'validated_event',true,'observation_provenance','REAL_CAMERA_AI');
  IF v_signal.observer_site_id IS DISTINCT FROM v_acceptance.site_id
    OR v_signal.source_id::text IS DISTINCT FROM v_acceptance.observation_snapshot->>'sourceId'
    OR v_signal.severity IS DISTINCT FROM v_acceptance.observation_snapshot->>'severity'
    OR v_signal.confidence IS DISTINCT FROM pg_catalog.round((v_acceptance.observation_snapshot->>'confidence')::numeric,4)
    OR v_signal.created_at IS DISTINCT FROM (v_acceptance.observation_snapshot->>'occurredAt')::timestamptz
    OR v_signal.metadata IS DISTINCT FROM v_expected_metadata THEN
    RAISE EXCEPTION 'RISK_SIGNAL_ACCEPTANCE_CONFLICT' USING ERRCODE = '23514';
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
     OR v_site.digital_observer_organization_id IS NULL
     OR v_site.id IS DISTINCT FROM v_acceptance.site_id
     OR v_site.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id
     OR v_site.digital_observer_organization_id IS DISTINCT FROM v_acceptance.tenant_id THEN
    RAISE EXCEPTION 'RISK_TENANT_MAPPING_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_org FROM public.digital_observer_organizations
    WHERE id = v_site.digital_observer_organization_id FOR SHARE;
  IF NOT FOUND OR v_org.active IS DISTINCT FROM true
     OR v_org.organization_type NOT IN ('family','business')
     OR v_org.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id THEN
    RAISE EXCEPTION 'RISK_TENANT_MAPPING_UNVERIFIED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_camera FROM public.digital_observer_camera_sources
    WHERE id = v_acceptance.source_id FOR SHARE;
  IF NOT FOUND OR v_camera.observer_site_id IS DISTINCT FROM v_site.id THEN
    RAISE EXCEPTION 'RISK_SOURCE_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_link FROM public.observer_correlated_event_links
    WHERE source_type = 'observer_intelligence_signal' AND source_id = p_signal_id
    FOR SHARE;
  IF NOT FOUND OR v_link.observer_site_id IS DISTINCT FROM v_site.id THEN
    RAISE EXCEPTION 'RISK_LINK_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_incident FROM public.observer_correlated_events
    WHERE id = v_link.correlated_event_id FOR SHARE;
  IF NOT FOUND OR v_incident.observer_site_id IS DISTINCT FROM v_site.id
     OR v_incident.provenance IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR v_incident.primary_camera_source_id IS DISTINCT FROM v_acceptance.source_id
     OR v_binding.incident_id IS DISTINCT FROM v_incident.id THEN
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

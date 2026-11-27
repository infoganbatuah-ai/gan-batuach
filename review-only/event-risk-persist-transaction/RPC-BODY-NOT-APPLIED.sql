-- Review-only proposal: direct execution always aborts. No COMMIT, no GRANT.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: isolated synthetic runner only';
END $review_guard$;

-- New proposed receipt: not a deployed object. An audit id and Risk id are
-- transactionally coupled to the claim, not inferred from a 23505 response.
CREATE TABLE public.observer_event_risk_persistence_receipts (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  risk_evaluation_id uuid NOT NULL REFERENCES public.digital_observer_risk_evaluations(id),
  owner_epoch bigint NOT NULL CHECK (owner_epoch > 0),
  incident_generation bigint NOT NULL CHECK (incident_generation >= 0),
  previous_evaluation_id uuid,
  audit_event_id uuid NOT NULL UNIQUE REFERENCES public.immutable_audit_events(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (signal_id, risk_engine_version),
  FOREIGN KEY (signal_id, risk_engine_version)
    REFERENCES public.observer_event_risk_claims(signal_id, risk_engine_version)
);
REVOKE ALL ON public.observer_event_risk_persistence_receipts FROM PUBLIC, anon, authenticated;

-- p_result is a strict, snake_case RiskEvaluation payload, excluding server-
-- derived identity/scope, previous reference, metadata and generated id.
-- expected_incident_generation is an Incident-wide CAS precondition only for
-- the first insertion. It is not advanced by this writer.
CREATE FUNCTION public.persist_event_risk_v1(
  p_signal_id uuid, p_engine_version text, p_owner_nonce uuid,
  p_owner_epoch bigint, p_result jsonb
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp AS $persist$
DECLARE
  v_claim public.observer_event_risk_claims%ROWTYPE;
  v_signal public.observer_intelligence_signals%ROWTYPE;
  v_site public.observer_sites%ROWTYPE;
  v_org public.digital_observer_organizations%ROWTYPE;
  v_link public.observer_correlated_event_links%ROWTYPE;
  v_incident public.observer_correlated_events%ROWTYPE;
  v_row public.digital_observer_risk_evaluations%ROWTYPE;
  v_receipt public.observer_event_risk_persistence_receipts%ROWTYPE;
  v_expected jsonb;
  v_existing jsonb;
  v_audit_id uuid;
  v_result_id uuid;
  v_now timestamptz;
  v_fields text[] := ARRAY[
    'risk_score','peak_risk_score','risk_band','evaluation_confidence',
    'contributing_factors','mitigating_factors','matched_rules',
    'baseline_context','explanation','recommended_decision','action_intents',
    'risk_engine_version','factor_version','decision_version',
    'input_fingerprint','evaluated_at','expected_incident_generation',
    'expected_previous_evaluation_id'
  ];
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'RISK_CALLER_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_signal_id IS NULL OR p_engine_version IS DISTINCT FROM 'do-risk-v1'
     OR p_owner_nonce IS NULL OR p_owner_epoch IS NULL OR p_owner_epoch < 1
     OR p_result IS NULL OR pg_catalog.jsonb_typeof(p_result) <> 'object'
     OR NOT (p_result ?& v_fields)
     OR (p_result - v_fields) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'RISK_PERSIST_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  -- A NULL JSON value must not inherit a source-table default silently.
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_result) AS f(k,v)
             WHERE v = 'null'::jsonb AND k <> 'expected_previous_evaluation_id') THEN
    RAISE EXCEPTION 'RISK_PERSIST_NULL_FIELD' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_signal FROM public.observer_intelligence_signals
    WHERE id = p_signal_id FOR UPDATE;
  SELECT * INTO v_site FROM public.observer_sites
    WHERE id = v_signal.observer_site_id FOR SHARE;
  SELECT * INTO v_org FROM public.digital_observer_organizations
    WHERE id = v_site.digital_observer_organization_id FOR SHARE;
  SELECT * INTO v_link FROM public.observer_correlated_event_links
    WHERE source_type = 'observer_intelligence_signal' AND source_id = p_signal_id
    FOR SHARE;
  SELECT * INTO v_incident FROM public.observer_correlated_events
    WHERE id = v_link.correlated_event_id FOR UPDATE;
  -- Match claim-acquisition lock order (Signal→Site→Org→link→Incident→claim).
  -- Re-sample the clock only after waiting on locks; stale leases fail closed.
  SELECT * INTO v_claim FROM public.observer_event_risk_claims
    WHERE signal_id = p_signal_id AND risk_engine_version = p_engine_version
    FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  IF NOT FOUND OR v_claim.owner_nonce IS DISTINCT FROM p_owner_nonce
     OR v_claim.owner_epoch IS DISTINCT FROM p_owner_epoch
     OR v_claim.lease_expires_at <= v_now
     OR v_claim.status NOT IN ('CLAIMED','RISK_PERSISTED') THEN
    RAISE EXCEPTION 'RISK_OWNER_FENCE_REJECTED' USING ERRCODE = '40001';
  END IF;
  IF v_signal.id IS NULL OR v_site.id IS NULL OR v_org.id IS NULL
     OR v_link.source_id IS NULL OR v_incident.id IS NULL
     OR v_signal.source_type IS DISTINCT FROM 'system'
     OR v_signal.signal_type IS DISTINCT FROM 'ai_camera'
     OR coalesce(v_signal.metadata->>'event_type','')
          NOT IN ('person_entered','person_exited')
     OR v_signal.observer_site_id IS DISTINCT FROM v_site.id
     OR v_site.digital_observer_organization_id IS DISTINCT FROM v_org.id
     OR v_site.active IS DISTINCT FROM true
     OR v_site.monitoring_enabled IS DISTINCT FROM true
     OR v_site.metadata->>'observer_monitoring_consent' IS DISTINCT FROM 'true'
     OR v_site.garden_id IS NOT NULL OR v_site.site_type IS NULL
     OR v_site.site_type = 'kindergarten'
     OR v_org.active IS DISTINCT FROM true
     OR coalesce(v_org.organization_type,'') NOT IN ('family','business')
     OR v_claim.observer_site_id IS DISTINCT FROM v_site.id
     OR v_claim.tenant_id IS DISTINCT FROM v_org.id
     OR v_claim.incident_id IS DISTINCT FROM v_incident.id
     OR v_link.observer_site_id IS DISTINCT FROM v_site.id
     OR v_link.correlated_event_id IS DISTINCT FROM v_incident.id
     OR v_incident.observer_site_id IS DISTINCT FROM v_site.id
     OR v_incident.provenance IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR v_signal.metadata->>'observation_provenance' IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR v_signal.metadata->>'validated_event' IS DISTINCT FROM 'true'
     OR v_signal.metadata->>'camera_source_id' IS DISTINCT FROM v_incident.primary_camera_source_id::text
     OR NOT EXISTS (
       SELECT 1 FROM public.digital_observer_camera_sources c
       WHERE c.id = v_incident.primary_camera_source_id
         AND c.observer_site_id = v_site.id
     ) THEN
    RAISE EXCEPTION 'RISK_CANONICAL_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;

  IF p_result->>'risk_engine_version' IS DISTINCT FROM p_engine_version THEN
    RAISE EXCEPTION 'RISK_ENGINE_VERSION_CONFLICT' USING ERRCODE = '23514';
  END IF;
  IF p_result->>'input_fingerprint' !~ '^[a-f0-9]{64}$'
     OR pg_catalog.jsonb_typeof(p_result->'action_intents') <> 'array'
     OR pg_catalog.jsonb_typeof(p_result->'contributing_factors') <> 'array'
     OR pg_catalog.jsonb_typeof(p_result->'mitigating_factors') <> 'array'
     OR pg_catalog.jsonb_typeof(p_result->'matched_rules') <> 'array'
     OR pg_catalog.jsonb_typeof(p_result->'baseline_context') <> 'object'
     OR pg_catalog.jsonb_typeof(p_result->'explanation') <> 'object' THEN
    RAISE EXCEPTION 'RISK_PERSIST_SHAPE_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Conversion through source row types establishes PostgreSQL numeric,
  -- timestamp, array and JSONB normalization before semantic comparison.
  v_row := pg_catalog.jsonb_populate_record(NULL::public.digital_observer_risk_evaluations,
    p_result - 'expected_incident_generation' - 'expected_previous_evaluation_id');
  IF v_row.risk_score IS NULL OR v_row.peak_risk_score IS NULL
     OR v_row.risk_band IS NULL OR v_row.evaluation_confidence IS NULL
     OR v_row.contributing_factors IS NULL OR v_row.mitigating_factors IS NULL
     OR v_row.matched_rules IS NULL OR v_row.baseline_context IS NULL
     OR v_row.explanation IS NULL OR v_row.recommended_decision IS NULL
     OR v_row.action_intents IS NULL OR v_row.factor_version IS NULL
     OR v_row.decision_version IS NULL OR v_row.input_fingerprint IS NULL
     OR v_row.evaluated_at IS NULL OR v_row.risk_engine_version IS NULL THEN
    RAISE EXCEPTION 'RISK_PERSIST_REQUIRED_FIELD_MISSING' USING ERRCODE = '22023';
  END IF;

  -- Existing unique key and receipt must both agree. A naked 23505 is never
  -- interpreted as semantic equivalence. The Incident lock serializes this
  -- key against a second Event targeting the same Incident generation.
  SELECT * INTO v_receipt FROM public.observer_event_risk_persistence_receipts
    WHERE signal_id = p_signal_id AND risk_engine_version = p_engine_version;
  IF v_claim.risk_evaluation_id IS NOT NULL OR v_receipt.signal_id IS NOT NULL THEN
    IF v_claim.status <> 'RISK_PERSISTED'
       OR v_claim.risk_evaluation_id IS NULL OR v_receipt.signal_id IS NULL
       OR v_receipt.risk_evaluation_id IS DISTINCT FROM v_claim.risk_evaluation_id
       OR v_receipt.tenant_id IS DISTINCT FROM v_claim.tenant_id
       OR v_receipt.observer_site_id IS DISTINCT FROM v_claim.observer_site_id
       OR v_receipt.incident_id IS DISTINCT FROM v_claim.incident_id
       OR v_receipt.incident_generation IS DISTINCT FROM
          (p_result->>'expected_incident_generation')::bigint
       OR v_receipt.previous_evaluation_id IS DISTINCT FROM
          (p_result->>'expected_previous_evaluation_id')::uuid
       OR v_receipt.audit_event_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.immutable_audit_events a
           WHERE a.id = v_receipt.audit_event_id
             AND a.event_type = 'observer_event_risk_persisted_v1'
             AND a.target_id = p_signal_id AND a.incident_id = v_claim.incident_id
             AND a.metadata->>'tenant_id' = v_claim.tenant_id::text
             AND a.metadata->>'site_id' = v_claim.observer_site_id::text
             AND a.metadata->>'risk_evaluation_id' = v_claim.risk_evaluation_id::text
             AND a.metadata->>'risk_engine_version' = p_engine_version
             AND a.metadata->>'owner_epoch' = v_receipt.owner_epoch::text)
    THEN RAISE EXCEPTION 'RISK_RECEIPT_CONFLICT' USING ERRCODE = '23514'; END IF;
    SELECT * INTO v_row FROM public.digital_observer_risk_evaluations
      WHERE id = v_claim.risk_evaluation_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RISK_ROW_MISSING' USING ERRCODE = '23514'; END IF;
  ELSE
    IF v_claim.status <> 'CLAIMED'
       OR v_incident.risk_projection_generation
          IS DISTINCT FROM (p_result->>'expected_incident_generation')::bigint
       OR v_incident.latest_risk_evaluation_id IS DISTINCT FROM
          (p_result->>'expected_previous_evaluation_id')::uuid THEN
      RAISE EXCEPTION 'RISK_INCIDENT_GENERATION_STALE' USING ERRCODE = '40001';
    END IF;
    -- The previous Risk reference is server-derived, never caller-supplied.
    -- A duplicate unique row with no matching receipt is a conflict.
    IF EXISTS (SELECT 1 FROM public.digital_observer_risk_evaluations r
       WHERE (r.incident_id = v_incident.id AND r.triggering_event_id = p_signal_id
              AND r.risk_engine_version = p_engine_version)
          OR (r.incident_id = v_incident.id
              AND r.input_fingerprint = v_row.input_fingerprint)) THEN
      RAISE EXCEPTION 'RISK_PREEXISTING_ROW_UNRECEIPTED' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.digital_observer_risk_evaluations (
      observer_site_id,incident_id,triggering_event_id,risk_score,peak_risk_score,
      risk_band,evaluation_confidence,contributing_factors,mitigating_factors,
      matched_rules,baseline_context,explanation,recommended_decision,
      action_intents,risk_engine_version,factor_version,decision_version,
      input_fingerprint,previous_evaluation_id,evaluated_at,metadata
    ) VALUES (
      v_site.id,v_incident.id,p_signal_id,v_row.risk_score,v_row.peak_risk_score,
      v_row.risk_band,v_row.evaluation_confidence,v_row.contributing_factors,
      v_row.mitigating_factors,v_row.matched_rules,v_row.baseline_context,
      v_row.explanation,v_row.recommended_decision,v_row.action_intents,
      p_engine_version,v_row.factor_version,v_row.decision_version,
      v_row.input_fingerprint,v_incident.latest_risk_evaluation_id,
      v_row.evaluated_at,
      '{"deterministic":true,"no_llm":true,"real_provenance_only":true,"external_action_executed":false}'::jsonb
    ) RETURNING * INTO v_row;
    INSERT INTO public.immutable_audit_events (
      event_type,event_category,actor_role,target_type,target_id,incident_id,
      metadata,risk_level
    ) VALUES (
      'observer_event_risk_persisted_v1','observer','service_role',
      'observer_intelligence_signal',p_signal_id,v_incident.id,
      pg_catalog.jsonb_build_object('tenant_id',v_claim.tenant_id,
        'site_id',v_site.id,'risk_evaluation_id',v_row.id,
        'risk_engine_version',p_engine_version,'owner_epoch',p_owner_epoch),
      'medium'
    ) RETURNING id INTO v_audit_id;
    INSERT INTO public.observer_event_risk_persistence_receipts (
      signal_id,risk_engine_version,tenant_id,observer_site_id,incident_id,
      risk_evaluation_id,owner_epoch,incident_generation,previous_evaluation_id,
      audit_event_id
    ) VALUES (p_signal_id,p_engine_version,v_claim.tenant_id,v_site.id,v_incident.id,
      v_row.id,p_owner_epoch,v_incident.risk_projection_generation,
      v_incident.latest_risk_evaluation_id,v_audit_id);
    UPDATE public.observer_event_risk_claims SET
      risk_evaluation_id = v_row.id,status = 'RISK_PERSISTED',updated_at = v_now
    WHERE signal_id = p_signal_id AND risk_engine_version = p_engine_version
      AND owner_nonce = p_owner_nonce AND owner_epoch = p_owner_epoch
      AND lease_expires_at > pg_catalog.clock_timestamp() AND status = 'CLAIMED'
      AND risk_evaluation_id IS NULL
    RETURNING risk_evaluation_id INTO v_result_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'RISK_OWNER_FENCE_REJECTED' USING ERRCODE = '40001'; END IF;
  END IF;

  -- Include every source-defined semantic field, not merely ID/fingerprint.
  v_expected := pg_catalog.jsonb_build_object(
    'observer_site_id',v_site.id,'incident_id',v_incident.id,
    'triggering_event_id',p_signal_id,'risk_score',
    (p_result->>'risk_score')::integer,
    'peak_risk_score',(p_result->>'peak_risk_score')::integer,
    'risk_band',p_result->>'risk_band',
    'evaluation_confidence',(p_result->>'evaluation_confidence')::numeric(5,4),
    'contributing_factors',p_result->'contributing_factors',
    'mitigating_factors',p_result->'mitigating_factors',
    'matched_rules',p_result->'matched_rules',
    'baseline_context',p_result->'baseline_context',
    'explanation',p_result->'explanation',
    'recommended_decision',p_result->>'recommended_decision',
    'action_intents',p_result->'action_intents',
    'risk_engine_version',p_engine_version,
    'factor_version',p_result->>'factor_version',
    'decision_version',p_result->>'decision_version',
    'input_fingerprint',p_result->>'input_fingerprint',
    'previous_evaluation_id',(p_result->>'expected_previous_evaluation_id')::uuid,
    'evaluated_at',(p_result->>'evaluated_at')::timestamptz,
    'metadata','{"deterministic":true,"no_llm":true,"real_provenance_only":true,"external_action_executed":false}'::jsonb
  );
  v_existing := pg_catalog.to_jsonb(v_row) - 'id' - 'created_at';
  IF v_existing <> v_expected THEN
    RAISE EXCEPTION 'RISK_SEMANTIC_CONFLICT' USING ERRCODE = '23514';
  END IF;
  RETURN v_row.id;
END;
$persist$;
REVOKE ALL ON FUNCTION public.persist_event_risk_v1(uuid,text,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Third downstream writer, review-only. No migration, no COMMIT, no live GRANT.
-- Direct execution aborts before any object can be created.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: third writer review only';
END $review_guard$;

-- Proposed delta to the source DRAFT-NOT-APPLIED.sql:142-163 receipt inventory.
-- Exactly one canonical target is supported: EVENT_INCIDENT_LINK. All other
-- effect keys fail closed in the function. No external delivery is implied.
CREATE TABLE public.observer_event_risk_effect_receipts (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  effect_key text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  risk_evaluation_id uuid NOT NULL,
  owner_epoch bigint NOT NULL CHECK (owner_epoch > 0),
  effect_fingerprint text NOT NULL CHECK (effect_fingerprint ~ '^[a-f0-9]{64}$'),
  recipient_snapshot_digest text,
  target_link_id uuid NOT NULL REFERENCES public.observer_correlated_event_links(id),
  target_row_digest text NOT NULL CHECK (target_row_digest ~ '^[a-f0-9]{64}$'),
  target_row_digest_algorithm text NOT NULL
    CHECK (target_row_digest_algorithm = 'pg-link-jsonb-v1'),
  mandatory_audit_id uuid NOT NULL UNIQUE REFERENCES public.immutable_audit_events(id),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (signal_id,risk_engine_version,effect_key),
  FOREIGN KEY (signal_id,risk_engine_version)
    REFERENCES public.observer_event_risk_effect_plans(signal_id,risk_engine_version),
  CHECK (effect_key = 'EVENT_INCIDENT_LINK'),
  CHECK (recipient_snapshot_digest IS NULL),
  CHECK (effect_fingerprint = target_row_digest)
);
ALTER TABLE public.observer_event_risk_effect_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.observer_event_risk_effect_receipts
  FROM PUBLIC, anon, authenticated, service_role;

-- The exact seven-RPC inventory signature is retained. p_effect_fingerprint
-- is a precondition, never caller authority; it must equal the locked target
-- row digest and the previously frozen plan fingerprint. Recipient digest is
-- NULL for this non-recipient effect. Invoker ACL remains a live blocker.
CREATE FUNCTION public.record_event_risk_effect_v1(
  p_signal_id uuid,p_engine_version text,p_owner_nonce uuid,
  p_owner_epoch bigint,p_effect_key text,p_effect_fingerprint text,
  p_recipient_snapshot_digest text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog,pg_temp AS $record_link_effect$
DECLARE
  v_signal public.observer_intelligence_signals%ROWTYPE;
  v_site public.observer_sites%ROWTYPE;
  v_org public.digital_observer_organizations%ROWTYPE;
  v_link public.observer_correlated_event_links%ROWTYPE;
  v_incident public.observer_correlated_events%ROWTYPE;
  v_claim public.observer_event_risk_claims%ROWTYPE;
  v_risk public.digital_observer_risk_evaluations%ROWTYPE;
  v_plan public.observer_event_risk_effect_plans%ROWTYPE;
  v_authority public.observer_event_risk_plan_authority%ROWTYPE;
  v_receipt public.observer_event_risk_effect_receipts%ROWTYPE;
  v_digest text;
  v_snapshot_digest text;
  v_snapshot_fingerprint text;
  v_audit_id uuid;
  v_now timestamptz;
  v_reused boolean := false;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'EFFECT_CALLER_DENIED' USING ERRCODE='42501';
  END IF;
  IF p_effect_key IS DISTINCT FROM 'EVENT_INCIDENT_LINK' THEN
    RAISE EXCEPTION 'EFFECT_UNSUPPORTED' USING ERRCODE='0A000';
  END IF;
  IF p_signal_id IS NULL OR p_engine_version IS DISTINCT FROM 'do-risk-v1'
     OR p_owner_nonce IS NULL OR p_owner_epoch IS NULL OR p_owner_epoch < 1
     OR p_effect_fingerprint IS NULL
     OR p_effect_fingerprint !~ '^[a-f0-9]{64}$'
     OR p_recipient_snapshot_digest IS NOT NULL THEN
    RAISE EXCEPTION 'EFFECT_INPUT_INVALID' USING ERRCODE='22023';
  END IF;

  -- Identical canonical lock order to claim, Risk and plan proposals.
  SELECT * INTO v_signal FROM public.observer_intelligence_signals
    WHERE id=p_signal_id FOR UPDATE;
  SELECT * INTO v_site FROM public.observer_sites
    WHERE id=v_signal.observer_site_id FOR SHARE;
  SELECT * INTO v_org FROM public.digital_observer_organizations
    WHERE id=v_site.digital_observer_organization_id FOR SHARE;
  SELECT * INTO v_link FROM public.observer_correlated_event_links
    WHERE source_type='observer_intelligence_signal' AND source_id=p_signal_id
    FOR SHARE;
  SELECT * INTO v_incident FROM public.observer_correlated_events
    WHERE id=v_link.correlated_event_id FOR UPDATE;
  SELECT * INTO v_claim FROM public.observer_event_risk_claims
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  IF v_claim.signal_id IS NULL OR v_claim.owner_nonce IS DISTINCT FROM p_owner_nonce
     OR v_claim.owner_epoch IS DISTINCT FROM p_owner_epoch
     OR v_claim.lease_expires_at <= v_now
     OR v_claim.status IS DISTINCT FROM 'EFFECTS_PENDING'
     OR v_claim.risk_evaluation_id IS NULL THEN
    RAISE EXCEPTION 'EFFECT_OWNER_FENCE_REJECTED' USING ERRCODE='40001';
  END IF;
  IF v_signal.id IS NULL OR v_site.id IS NULL OR v_org.id IS NULL
     OR v_link.id IS NULL OR v_incident.id IS NULL
     OR v_signal.observer_site_id IS DISTINCT FROM v_claim.observer_site_id
     OR v_site.digital_observer_organization_id IS DISTINCT FROM v_claim.tenant_id
     OR v_org.id IS DISTINCT FROM v_claim.tenant_id
     OR v_org.active IS DISTINCT FROM true
     OR coalesce(v_org.organization_type,'') NOT IN ('family','business')
     OR v_site.active IS DISTINCT FROM true
     OR v_site.monitoring_enabled IS DISTINCT FROM true
     OR v_site.garden_id IS NOT NULL OR v_site.site_type IS NULL
     OR v_site.site_type='kindergarten'
     OR v_site.metadata->>'observer_monitoring_consent' IS DISTINCT FROM 'true'
     OR v_signal.source_type IS DISTINCT FROM 'system'
     OR v_signal.signal_type IS DISTINCT FROM 'ai_camera'
     OR v_signal.metadata->>'observation_provenance' IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR v_signal.metadata->>'validated_event' IS DISTINCT FROM 'true'
     OR v_signal.metadata->>'camera_source_id' IS DISTINCT FROM
          v_incident.primary_camera_source_id::text
     OR v_link.observer_site_id IS DISTINCT FROM v_site.id
     OR v_link.correlated_event_id IS DISTINCT FROM v_incident.id
     OR v_incident.observer_site_id IS DISTINCT FROM v_site.id
     OR v_incident.id IS DISTINCT FROM v_claim.incident_id
     OR v_incident.provenance IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR NOT EXISTS (SELECT 1 FROM public.digital_observer_camera_sources c
           WHERE c.id=v_incident.primary_camera_source_id
             AND c.observer_site_id=v_site.id) THEN
    RAISE EXCEPTION 'EFFECT_CANONICAL_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_risk FROM public.digital_observer_risk_evaluations
    WHERE id=v_claim.risk_evaluation_id FOR SHARE;
  SELECT * INTO v_plan FROM public.observer_event_risk_effect_plans
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version;
  IF v_risk.id IS NULL OR v_plan.signal_id IS NULL
     OR v_risk.observer_site_id IS DISTINCT FROM v_site.id
     OR v_risk.incident_id IS DISTINCT FROM v_incident.id
     OR v_risk.triggering_event_id IS DISTINCT FROM p_signal_id
     OR v_risk.risk_engine_version IS DISTINCT FROM p_engine_version
     OR v_plan.tenant_id IS DISTINCT FROM v_claim.tenant_id
     OR v_plan.observer_site_id IS DISTINCT FROM v_site.id
     OR v_plan.camera_source_id IS DISTINCT FROM v_incident.primary_camera_source_id
     OR v_plan.incident_id IS DISTINCT FROM v_incident.id
     OR v_plan.risk_evaluation_id IS DISTINCT FROM v_risk.id
     OR v_plan.recipient_snapshot_digest_algorithm IS DISTINCT FROM 'pg-jsonb-text-v1'
     OR v_plan.recipient_snapshot_digest !~ '^[a-f0-9]{64}$'
     OR pg_catalog.jsonb_typeof(v_plan.expected_effect_keys) IS DISTINCT FROM 'array'
     OR NOT (v_plan.expected_effect_keys ? p_effect_key)
     OR pg_catalog.jsonb_typeof(v_plan.expected_fingerprints) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'EFFECT_PLAN_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_authority FROM public.observer_event_risk_plan_authority
    WHERE authority_id=v_plan.authority_id;
  v_snapshot_digest := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_plan.recipient_snapshot::text,'UTF8')),'hex');
  v_snapshot_fingerprint := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to((v_plan.recipient_snapshot - 'fingerprint')::text,'UTF8')),'hex');
  IF v_authority.authority_id IS NULL
     OR v_authority.signal_id IS DISTINCT FROM p_signal_id
     OR v_authority.risk_engine_version IS DISTINCT FROM p_engine_version
     OR v_authority.tenant_id IS DISTINCT FROM v_claim.tenant_id
     OR v_authority.observer_site_id IS DISTINCT FROM v_site.id
     OR v_authority.incident_id IS DISTINCT FROM v_incident.id
     OR v_authority.risk_evaluation_id IS DISTINCT FROM v_risk.id
     OR v_authority.camera_source_id IS DISTINCT FROM v_incident.primary_camera_source_id
     OR v_authority.producer_contract_version IS DISTINCT FROM 'server-decision-v1'
     OR v_authority.ownership_evidence_ref IS DISTINCT FROM v_plan.ownership_evidence_ref
     OR v_authority.recipient_settings_version IS DISTINCT FROM v_plan.recipient_settings_version
     OR v_authority.recipient_policy_version IS DISTINCT FROM v_plan.recipient_policy_version
     OR v_authority.decision_code IS DISTINCT FROM v_plan.decision_code
     OR v_plan.decision_code IS DISTINCT FROM v_risk.recommended_decision
     OR v_authority.recipient_snapshot_schema_version
          IS DISTINCT FROM v_plan.recipient_snapshot_schema_version
     OR v_authority.recipient_snapshot_captured_at
          IS DISTINCT FROM v_plan.recipient_snapshot_captured_at
     OR v_authority.required_evidence_references
          IS DISTINCT FROM v_plan.required_evidence_references
     OR v_authority.media_fault_audit_required
          IS DISTINCT FROM v_plan.media_fault_audit_required
     OR v_authority.expected_fingerprints IS DISTINCT FROM v_plan.expected_fingerprints
     OR v_authority.recipient_snapshot IS DISTINCT FROM v_plan.recipient_snapshot
     OR v_plan.recipient_snapshot_digest IS DISTINCT FROM v_snapshot_digest
     OR v_plan.recipient_snapshot_fingerprint IS DISTINCT FROM v_snapshot_fingerprint
     OR v_plan.recipient_snapshot->>'fingerprint' IS DISTINCT FROM v_snapshot_fingerprint
     OR NOT EXISTS (SELECT 1 FROM public.immutable_audit_events a
         WHERE a.id=v_plan.audit_event_id
           AND a.event_type='observer_event_risk_effect_plan_frozen_v1'
           AND a.target_id=p_signal_id
           AND a.incident_id=v_incident.id
           AND a.metadata->>'tenant_id'=v_claim.tenant_id::text
           AND a.metadata->>'site_id'=v_site.id::text
           AND a.metadata->>'risk_evaluation_id'=v_risk.id::text
           AND a.metadata->>'authority_id'=v_authority.authority_id::text
           AND a.metadata->>'snapshot_digest'=v_plan.recipient_snapshot_digest) THEN
    RAISE EXCEPTION 'EFFECT_PLAN_AUTHORITY_INVALID' USING ERRCODE='23514';
  END IF;

  -- The canonical link exists before Risk computation. Hash the *actual*
  -- locked target row, not a caller-supplied evidence ID or synthetic receipt.
  v_digest := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(pg_catalog.to_jsonb(v_link)::text,'UTF8')),'hex');
  IF p_effect_fingerprint IS DISTINCT FROM v_digest
     OR v_plan.expected_fingerprints->>p_effect_key IS DISTINCT FROM v_digest THEN
    RAISE EXCEPTION 'EFFECT_TARGET_SEMANTIC_CONFLICT' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_receipt FROM public.observer_event_risk_effect_receipts
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version
      AND effect_key=p_effect_key;
  IF v_receipt.signal_id IS NULL THEN
    INSERT INTO public.immutable_audit_events (
      event_type,event_category,actor_role,target_type,target_id,incident_id,
      metadata,risk_level
    ) VALUES (
      'observer_event_risk_link_effect_recorded_v1','observer','service_role',
      'observer_correlated_event_link',v_link.id,v_incident.id,
      pg_catalog.jsonb_build_object('signal_id',p_signal_id,'tenant_id',v_claim.tenant_id,
        'site_id',v_site.id,'risk_evaluation_id',v_risk.id,
        'plan_digest',v_plan.recipient_snapshot_digest,'target_digest',v_digest,
        'owner_epoch',p_owner_epoch),'medium'
    ) RETURNING id INTO v_audit_id;
    INSERT INTO public.observer_event_risk_effect_receipts (
      signal_id,risk_engine_version,effect_key,tenant_id,observer_site_id,
      risk_evaluation_id,owner_epoch,effect_fingerprint,recipient_snapshot_digest,
      target_link_id,target_row_digest,target_row_digest_algorithm,mandatory_audit_id
    ) VALUES (
      p_signal_id,p_engine_version,p_effect_key,v_claim.tenant_id,v_site.id,
      v_risk.id,p_owner_epoch,v_digest,NULL,v_link.id,v_digest,
      'pg-link-jsonb-v1',v_audit_id
    ) RETURNING * INTO v_receipt;
  ELSE
    v_reused := true;
  END IF;
  IF v_receipt.tenant_id IS DISTINCT FROM v_claim.tenant_id
     OR v_receipt.observer_site_id IS DISTINCT FROM v_site.id
     OR v_receipt.risk_evaluation_id IS DISTINCT FROM v_risk.id
     OR v_receipt.target_link_id IS DISTINCT FROM v_link.id
     OR v_receipt.owner_epoch < 1 OR v_receipt.owner_epoch > p_owner_epoch
     OR v_receipt.effect_fingerprint IS DISTINCT FROM v_digest
     OR v_receipt.target_row_digest IS DISTINCT FROM v_digest
     OR v_receipt.target_row_digest_algorithm IS DISTINCT FROM 'pg-link-jsonb-v1'
     OR v_receipt.recipient_snapshot_digest IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.immutable_audit_events a
       WHERE a.id=v_receipt.mandatory_audit_id
         AND a.event_type='observer_event_risk_link_effect_recorded_v1'
         AND a.target_id=v_link.id AND a.incident_id=v_incident.id
         AND a.metadata->>'signal_id'=p_signal_id::text
         AND a.metadata->>'tenant_id'=v_claim.tenant_id::text
         AND a.metadata->>'site_id'=v_site.id::text
         AND a.metadata->>'risk_evaluation_id'=v_risk.id::text
         AND a.metadata->>'plan_digest'=v_plan.recipient_snapshot_digest
         AND a.metadata->>'target_digest'=v_digest
         AND a.metadata->>'owner_epoch'=v_receipt.owner_epoch::text) THEN
    RAISE EXCEPTION 'EFFECT_RECEIPT_SEMANTIC_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN pg_catalog.jsonb_build_object('kind','LINK_EFFECT_RECORDED',
    'effect_key',p_effect_key,'target_id',v_link.id,
    'target_digest',v_digest,'reused',v_reused);
END;
$record_link_effect$;
REVOKE ALL ON FUNCTION public.record_event_risk_effect_v1(
  uuid,text,uuid,bigint,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

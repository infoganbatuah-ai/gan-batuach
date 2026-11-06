-- Review-only second writer. Direct execution always aborts; no COMMIT or GRANT.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: synthetic authority and migration approval required';
END $review_guard$;

-- PROPOSED AUTHORITY CONTRACT, NOT DEPLOYED. No actual producer exists.
-- A future independently authorized decision-time producer must insert this
-- immutable row from trusted settings/recipient/evidence sources, not from the
-- worker, client, p_plan, current mutable notification settings or an email.
CREATE TABLE public.observer_event_risk_plan_authority (
  authority_id uuid PRIMARY KEY,
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  camera_source_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  risk_evaluation_id uuid NOT NULL,
  ownership_evidence_ref text NOT NULL,
  producer_contract_version text NOT NULL,
  decision_code text NOT NULL,
  recipient_settings_version text NOT NULL,
  recipient_policy_version text NOT NULL,
  recipient_snapshot_schema_version integer NOT NULL,
  recipient_snapshot_captured_at timestamptz NOT NULL,
  recipient_snapshot jsonb NOT NULL,
  required_evidence_references jsonb NOT NULL,
  watch_rule_ids jsonb NOT NULL,
  expected_fingerprints jsonb NOT NULL,
  media_fault_audit_required boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (signal_id,risk_engine_version),
  FOREIGN KEY (signal_id,risk_engine_version)
    REFERENCES public.observer_event_risk_claims(signal_id,risk_engine_version)
);

-- Source DRAFT-NOT-APPLIED.sql:89-127 field inventory, with explicit proposed
-- authority/audit/keys/digest-algorithm deltas. Nothing here is deployed.
CREATE TABLE public.observer_event_risk_effect_plans (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  risk_evaluation_id uuid NOT NULL,
  camera_source_id uuid NOT NULL,
  ownership_evidence_ref text NOT NULL,
  recipient_settings_version text NOT NULL,
  recipient_policy_version text NOT NULL,
  decision_code text NOT NULL,
  recipient_snapshot_schema_version integer NOT NULL,
  recipient_snapshot_captured_at timestamptz NOT NULL,
  recipient_snapshot jsonb NOT NULL,
  recipient_snapshot_fingerprint text NOT NULL,
  recipient_snapshot_digest text NOT NULL,
  required_evidence_references jsonb NOT NULL,
  expected_fingerprints jsonb NOT NULL,
  media_fault_audit_required boolean NOT NULL,
  authority_id uuid NOT NULL REFERENCES public.observer_event_risk_plan_authority(authority_id),
  expected_effect_keys jsonb NOT NULL,
  recipient_snapshot_digest_algorithm text NOT NULL,
  audit_event_id uuid NOT NULL UNIQUE REFERENCES public.immutable_audit_events(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (signal_id,risk_engine_version),
  FOREIGN KEY (signal_id,risk_engine_version)
    REFERENCES public.observer_event_risk_claims(signal_id,risk_engine_version),
  CHECK (recipient_snapshot_schema_version = 1),
  CHECK (recipient_snapshot_fingerprint ~ '^[a-f0-9]{64}$'),
  CHECK (recipient_snapshot_digest ~ '^[a-f0-9]{64}$'),
  CHECK (recipient_snapshot_digest_algorithm = 'pg-jsonb-text-v1')
);
ALTER TABLE public.observer_event_risk_plan_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observer_event_risk_effect_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.observer_event_risk_plan_authority
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.observer_event_risk_effect_plans
  FROM PUBLIC, anon, authenticated, service_role;

-- Exact inventory signature. p_plan may contain only an opaque authority_id;
-- no caller JSON supplies recipients, settings, decision or evidence facts.
CREATE FUNCTION public.start_event_risk_effects_v1(
  p_signal_id uuid,p_engine_version text,p_owner_nonce uuid,
  p_owner_epoch bigint,p_plan jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp AS $start_effects$
DECLARE
  v_signal public.observer_intelligence_signals%ROWTYPE;
  v_site public.observer_sites%ROWTYPE;
  v_org public.digital_observer_organizations%ROWTYPE;
  v_link public.observer_correlated_event_links%ROWTYPE;
  v_incident public.observer_correlated_events%ROWTYPE;
  v_claim public.observer_event_risk_claims%ROWTYPE;
  v_risk public.digital_observer_risk_evaluations%ROWTYPE;
  v_risk_receipt public.observer_event_risk_persistence_receipts%ROWTYPE;
  v_authority public.observer_event_risk_plan_authority%ROWTYPE;
  v_saved public.observer_event_risk_effect_plans%ROWTYPE;
  v_authority_id uuid;
  v_now timestamptz;
  v_snapshot jsonb;
  v_content jsonb;
  v_fingerprint text;
  v_digest text;
  v_keys text[] := ARRAY['EVENT_INCIDENT_LINK','RISK_DECISION'];
  v_ref text;
  v_prev text := '';
  v_rec jsonb;
  v_channel jsonb;
  v_channel_prev text;
  v_level jsonb;
  v_level_prev text;
  v_watch jsonb;
  v_evidence jsonb;
  v_inapp text[] := ARRAY[]::text[];
  v_audit_id uuid;
  v_expected jsonb;
  v_reused boolean := false;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLAN_CALLER_DENIED' USING ERRCODE='42501';
  END IF;
  IF p_signal_id IS NULL OR p_engine_version IS DISTINCT FROM 'do-risk-v1'
     OR p_owner_nonce IS NULL OR p_owner_epoch IS NULL OR p_owner_epoch < 1
     OR p_plan IS NULL OR pg_catalog.jsonb_typeof(p_plan) <> 'object'
     OR NOT (p_plan ? 'authority_id')
     OR (p_plan - 'authority_id') <> '{}'::jsonb
     OR pg_catalog.jsonb_typeof(p_plan->'authority_id') <> 'string' THEN
    RAISE EXCEPTION 'PLAN_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  v_authority_id := (p_plan->>'authority_id')::uuid;

  -- Same canonical lock order as acquisition and the first Risk writer.
  SELECT * INTO v_signal FROM public.observer_intelligence_signals
    WHERE id=p_signal_id FOR UPDATE;
  SELECT * INTO v_site FROM public.observer_sites
    WHERE id=v_signal.observer_site_id FOR SHARE;
  SELECT * INTO v_org FROM public.digital_observer_organizations
    WHERE id=v_site.digital_observer_organization_id FOR SHARE;
  SELECT * INTO v_link FROM public.observer_correlated_event_links
    WHERE source_type='observer_intelligence_signal' AND source_id=p_signal_id FOR SHARE;
  SELECT * INTO v_incident FROM public.observer_correlated_events
    WHERE id=v_link.correlated_event_id FOR UPDATE;
  SELECT * INTO v_claim FROM public.observer_event_risk_claims
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();
  IF v_claim.signal_id IS NULL OR v_claim.owner_nonce IS DISTINCT FROM p_owner_nonce
     OR v_claim.owner_epoch IS DISTINCT FROM p_owner_epoch
     OR v_claim.lease_expires_at <= v_now
     OR v_claim.status NOT IN ('RISK_PERSISTED','EFFECTS_PENDING')
     OR v_claim.risk_evaluation_id IS NULL THEN
    RAISE EXCEPTION 'PLAN_OWNER_FENCE_REJECTED' USING ERRCODE='40001';
  END IF;
  IF v_signal.id IS NULL OR v_site.id IS NULL OR v_org.id IS NULL
     OR v_link.source_id IS NULL OR v_incident.id IS NULL
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
     OR v_signal.metadata->>'camera_source_id' IS DISTINCT FROM v_incident.primary_camera_source_id::text
     OR v_link.observer_site_id IS DISTINCT FROM v_site.id
     OR v_link.correlated_event_id IS DISTINCT FROM v_incident.id
     OR v_incident.observer_site_id IS DISTINCT FROM v_site.id
     OR v_incident.id IS DISTINCT FROM v_claim.incident_id
     OR v_incident.provenance IS DISTINCT FROM 'REAL_CAMERA_AI'
     OR NOT EXISTS (SELECT 1 FROM public.digital_observer_camera_sources c
           WHERE c.id=v_incident.primary_camera_source_id
             AND c.observer_site_id=v_site.id) THEN
    RAISE EXCEPTION 'PLAN_CANONICAL_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_risk FROM public.digital_observer_risk_evaluations
    WHERE id=v_claim.risk_evaluation_id FOR SHARE;
  SELECT * INTO v_risk_receipt FROM public.observer_event_risk_persistence_receipts
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version FOR SHARE;
  IF v_risk.id IS NULL OR v_risk_receipt.signal_id IS NULL
     OR v_risk_receipt.risk_evaluation_id IS DISTINCT FROM v_risk.id
     OR v_risk_receipt.tenant_id IS DISTINCT FROM v_claim.tenant_id
     OR v_risk_receipt.observer_site_id IS DISTINCT FROM v_site.id
     OR v_risk_receipt.incident_id IS DISTINCT FROM v_incident.id
     OR v_risk.observer_site_id IS DISTINCT FROM v_site.id
     OR v_risk.incident_id IS DISTINCT FROM v_incident.id
     OR v_risk.triggering_event_id IS DISTINCT FROM p_signal_id
     OR v_risk.risk_engine_version IS DISTINCT FROM p_engine_version THEN
    RAISE EXCEPTION 'PLAN_RISK_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_authority FROM public.observer_event_risk_plan_authority
    WHERE authority_id=v_authority_id;
  IF v_authority.authority_id IS NULL
     OR v_authority.signal_id IS DISTINCT FROM p_signal_id
     OR v_authority.risk_engine_version IS DISTINCT FROM p_engine_version
     OR v_authority.tenant_id IS DISTINCT FROM v_claim.tenant_id
     OR v_authority.observer_site_id IS DISTINCT FROM v_site.id
     OR v_authority.camera_source_id IS DISTINCT FROM v_incident.primary_camera_source_id
     OR v_authority.incident_id IS DISTINCT FROM v_incident.id
     OR v_authority.risk_evaluation_id IS DISTINCT FROM v_risk.id
     OR v_authority.producer_contract_version IS DISTINCT FROM 'server-decision-v1'
     OR v_authority.decision_code IS DISTINCT FROM v_risk.recommended_decision
     OR length(v_authority.ownership_evidence_ref) NOT BETWEEN 1 AND 256
     OR length(v_authority.recipient_settings_version) NOT BETWEEN 1 AND 128
     OR length(v_authority.recipient_policy_version) NOT BETWEEN 1 AND 128
     OR v_authority.recipient_snapshot_schema_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PLAN_AUTHORITY_UNVERIFIED' USING ERRCODE='23514';
  END IF;
  v_snapshot := v_authority.recipient_snapshot;
  v_content := v_snapshot - 'fingerprint';
  IF pg_catalog.jsonb_typeof(v_snapshot) <> 'object'
     OR NOT (v_snapshot ?& ARRAY['schemaVersion','scope','decisionCode',
       'severity','settingsVersion','policyVersion','capturedAt','recipients','fingerprint'])
     OR (v_snapshot - ARRAY['schemaVersion','scope','decisionCode',
       'severity','settingsVersion','policyVersion','capturedAt','recipients','fingerprint']) <> '{}'::jsonb
     OR v_snapshot->'schemaVersion' IS DISTINCT FROM '1'::jsonb
     OR v_snapshot->'scope' IS DISTINCT FROM pg_catalog.jsonb_build_object(
       'tenantId',v_claim.tenant_id,'siteId',v_site.id,
       'sourceId',v_incident.primary_camera_source_id,'eventId',p_signal_id,
       'incidentId',v_incident.id,'riskDecisionId',v_risk.id)
     OR v_snapshot->>'decisionCode' IS DISTINCT FROM v_authority.decision_code
     OR v_snapshot->>'severity' IS DISTINCT FROM v_risk.risk_band
     OR v_snapshot->>'settingsVersion' IS DISTINCT FROM v_authority.recipient_settings_version
     OR v_snapshot->>'policyVersion' IS DISTINCT FROM v_authority.recipient_policy_version
     OR (v_snapshot->>'capturedAt')::timestamptz
          IS DISTINCT FROM v_authority.recipient_snapshot_captured_at
     OR pg_catalog.jsonb_typeof(v_snapshot->'recipients') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_snapshot->'recipients') > 100 THEN
    RAISE EXCEPTION 'PLAN_SNAPSHOT_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  -- Versioned database serialization. This deliberately does NOT claim
  -- equivalence to the source Node JSON.stringify/localeCompare fingerprint.
  v_fingerprint := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_content::text,'UTF8')),'hex');
  v_digest := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_snapshot::text,'UTF8')),'hex');
  IF v_snapshot->>'fingerprint' IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'PLAN_SNAPSHOT_FINGERPRINT_INVALID' USING ERRCODE='23514';
  END IF;

  FOR v_rec IN SELECT value FROM pg_catalog.jsonb_array_elements(v_snapshot->'recipients') LOOP
    v_ref := v_rec->>'recipientRef';
    IF pg_catalog.jsonb_typeof(v_rec) <> 'object'
       OR v_ref IS NULL OR length(v_ref) NOT BETWEEN 1 AND 128
       OR v_ref COLLATE "C" <= v_prev COLLATE "C"
       OR (v_rec - ARRAY['recipientRef','channels']) <> '{}'::jsonb
       OR pg_catalog.jsonb_typeof(v_rec->'channels') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_rec->'channels') > 4 THEN
      RAISE EXCEPTION 'PLAN_RECIPIENT_SHAPE_INVALID' USING ERRCODE='23514';
    END IF;
    v_prev := v_ref;
    v_channel_prev := '';
    FOR v_channel IN SELECT value FROM pg_catalog.jsonb_array_elements(v_rec->'channels') LOOP
      IF pg_catalog.jsonb_typeof(v_channel) <> 'object'
         OR coalesce(v_channel->>'channel','') NOT IN ('in_app','email','sms','push')
         OR v_channel->>'channel' COLLATE "C" <= v_channel_prev COLLATE "C"
         OR (v_channel - ARRAY['channel','enabled','severityLevels']) <> '{}'::jsonb
         OR pg_catalog.jsonb_typeof(v_channel->'enabled') IS DISTINCT FROM 'boolean'
         OR pg_catalog.jsonb_typeof(v_channel->'severityLevels') IS DISTINCT FROM 'array'
         OR pg_catalog.jsonb_array_length(v_channel->'severityLevels') > 16 THEN
        RAISE EXCEPTION 'PLAN_CHANNEL_SHAPE_INVALID' USING ERRCODE='23514';
      END IF;
      v_channel_prev := v_channel->>'channel';
      v_level_prev := '';
      FOR v_level IN SELECT value FROM pg_catalog.jsonb_array_elements(v_channel->'severityLevels') LOOP
        IF pg_catalog.jsonb_typeof(v_level) IS DISTINCT FROM 'string'
           OR length(v_level #>> '{}') NOT BETWEEN 1 AND 32
           OR (v_level #>> '{}') COLLATE "C" <= v_level_prev COLLATE "C" THEN
          RAISE EXCEPTION 'PLAN_CHANNEL_SHAPE_INVALID' USING ERRCODE='23514';
        END IF;
        v_level_prev := v_level #>> '{}';
      END LOOP;
      IF v_channel->>'channel'='in_app'
         AND v_channel->'enabled'='true'::jsonb
         AND (pg_catalog.jsonb_array_length(v_channel->'severityLevels')=0
              OR v_channel->'severityLevels' ? (v_snapshot->>'severity')) THEN
        v_inapp := pg_catalog.array_append(v_inapp,v_ref);
      END IF;
    END LOOP;
  END LOOP;
  IF pg_catalog.jsonb_typeof(v_authority.watch_rule_ids) <> 'array'
     OR pg_catalog.jsonb_array_length(v_authority.watch_rule_ids) > 32 THEN
    RAISE EXCEPTION 'PLAN_WATCH_IDS_INVALID' USING ERRCODE='23514';
  END IF;
  v_prev := '';
  FOR v_watch IN SELECT value FROM pg_catalog.jsonb_array_elements(v_authority.watch_rule_ids) LOOP
    v_ref := v_watch #>> '{}';
    IF pg_catalog.jsonb_typeof(v_watch) <> 'string'
       OR v_ref IS NULL OR length(v_ref) NOT BETWEEN 1 AND 128
       OR v_ref COLLATE "C" <= v_prev COLLATE "C" THEN
      RAISE EXCEPTION 'PLAN_WATCH_IDS_INVALID' USING ERRCODE='23514';
    END IF;
    v_keys := pg_catalog.array_append(v_keys,'WATCH_RULE:'||v_ref);
    v_prev := v_ref;
  END LOOP;
  v_keys := v_keys || ARRAY['INCIDENT_RISK_PROJECTION','VERIFICATION_RESULT',
    'DECISION_INTENT','INCIDENT_VERIFICATION_PROJECTION','RECIPIENT_PLAN'];
  FOREACH v_ref IN ARRAY v_inapp LOOP
    v_keys := pg_catalog.array_append(v_keys,'IN_APP_JOURNAL:'||v_ref);
  END LOOP;
  v_keys := pg_catalog.array_append(v_keys,'MANDATORY_DECISION_AUDIT');
  IF v_authority.media_fault_audit_required THEN
    v_keys := pg_catalog.array_append(v_keys,'MEDIA_FAULT_AUDIT');
  END IF;
  v_keys := pg_catalog.array_append(v_keys,'GUARD_ELIGIBILITY');
  IF pg_catalog.jsonb_typeof(v_authority.required_evidence_references) <> 'array'
     OR pg_catalog.jsonb_array_length(v_authority.required_evidence_references) NOT BETWEEN 1 AND 32
     OR pg_catalog.jsonb_typeof(v_authority.expected_fingerprints) <> 'object'
     OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_authority.expected_fingerprints))
          <> pg_catalog.array_length(v_keys,1) THEN
    RAISE EXCEPTION 'PLAN_EVIDENCE_OR_EFFECTS_INVALID' USING ERRCODE='23514';
  END IF;
  v_prev := '';
  FOR v_evidence IN SELECT value FROM pg_catalog.jsonb_array_elements(v_authority.required_evidence_references) LOOP
    v_ref := v_evidence #>> '{}';
    IF pg_catalog.jsonb_typeof(v_evidence) <> 'string'
       OR v_ref IS NULL OR length(v_ref) NOT BETWEEN 1 AND 256
       OR v_ref COLLATE "C" <= v_prev COLLATE "C" THEN
      RAISE EXCEPTION 'PLAN_EVIDENCE_OR_EFFECTS_INVALID' USING ERRCODE='23514';
    END IF;
    v_prev := v_ref;
  END LOOP;
  FOREACH v_ref IN ARRAY v_keys LOOP
    IF pg_catalog.jsonb_typeof(v_authority.expected_fingerprints->v_ref) <> 'string'
       OR v_authority.expected_fingerprints->>v_ref !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'PLAN_EVIDENCE_OR_EFFECTS_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;

  SELECT * INTO v_saved FROM public.observer_event_risk_effect_plans
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version;
  IF v_saved.signal_id IS NULL THEN
    IF v_claim.status <> 'RISK_PERSISTED' THEN
      RAISE EXCEPTION 'PLAN_MISSING_AFTER_CHECKPOINT' USING ERRCODE='23514';
    END IF;
    INSERT INTO public.immutable_audit_events (
      event_type,event_category,actor_role,target_type,target_id,incident_id,
      metadata,risk_level
    ) VALUES (
      'observer_event_risk_effect_plan_frozen_v1','observer','service_role',
      'observer_intelligence_signal',p_signal_id,v_incident.id,
      pg_catalog.jsonb_build_object('tenant_id',v_claim.tenant_id,'site_id',v_site.id,
        'risk_evaluation_id',v_risk.id,'authority_id',v_authority_id,
        'snapshot_digest',v_digest,'owner_epoch',p_owner_epoch),'medium'
    ) RETURNING id INTO v_audit_id;
    INSERT INTO public.observer_event_risk_effect_plans (
      signal_id,risk_engine_version,tenant_id,observer_site_id,incident_id,
      risk_evaluation_id,camera_source_id,ownership_evidence_ref,
      recipient_settings_version,recipient_policy_version,decision_code,
      recipient_snapshot_schema_version,recipient_snapshot_captured_at,
      recipient_snapshot,recipient_snapshot_fingerprint,recipient_snapshot_digest,
      required_evidence_references,expected_fingerprints,media_fault_audit_required,
      authority_id,expected_effect_keys,recipient_snapshot_digest_algorithm,audit_event_id
    ) VALUES (
      p_signal_id,p_engine_version,v_claim.tenant_id,v_site.id,v_incident.id,
      v_risk.id,v_incident.primary_camera_source_id,v_authority.ownership_evidence_ref,
      v_authority.recipient_settings_version,v_authority.recipient_policy_version,
      v_authority.decision_code,1,v_authority.recipient_snapshot_captured_at,
      v_snapshot,v_fingerprint,v_digest,v_authority.required_evidence_references,
      v_authority.expected_fingerprints,v_authority.media_fault_audit_required,
      v_authority_id,pg_catalog.to_jsonb(v_keys),'pg-jsonb-text-v1',v_audit_id
    ) RETURNING * INTO v_saved;
    UPDATE public.observer_event_risk_claims SET
      status='EFFECTS_PENDING',updated_at=v_now
    WHERE signal_id=p_signal_id AND risk_engine_version=p_engine_version
      AND owner_nonce=p_owner_nonce AND owner_epoch=p_owner_epoch
      AND lease_expires_at>pg_catalog.clock_timestamp()
      AND status='RISK_PERSISTED' AND risk_evaluation_id=v_risk.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_OWNER_FENCE_REJECTED' USING ERRCODE='40001'; END IF;
  ELSE
    v_reused := true;
    IF v_claim.status <> 'EFFECTS_PENDING' THEN
      RAISE EXCEPTION 'PLAN_CHECKPOINT_CONFLICT' USING ERRCODE='23514';
    END IF;
  END IF;

  -- Exact full-row semantic comparison. New columns cause fail-closed mismatch.
  v_expected := pg_catalog.jsonb_build_object(
    'signal_id',p_signal_id,'risk_engine_version',p_engine_version,
    'tenant_id',v_claim.tenant_id,'observer_site_id',v_site.id,
    'incident_id',v_incident.id,'risk_evaluation_id',v_risk.id,
    'camera_source_id',v_incident.primary_camera_source_id,
    'ownership_evidence_ref',v_authority.ownership_evidence_ref,
    'recipient_settings_version',v_authority.recipient_settings_version,
    'recipient_policy_version',v_authority.recipient_policy_version,
    'decision_code',v_authority.decision_code,
    'recipient_snapshot_schema_version',1,
    'recipient_snapshot_captured_at',v_authority.recipient_snapshot_captured_at,
    'recipient_snapshot',v_snapshot,'recipient_snapshot_fingerprint',v_fingerprint,
    'recipient_snapshot_digest',v_digest,
    'required_evidence_references',v_authority.required_evidence_references,
    'expected_fingerprints',v_authority.expected_fingerprints,
    'media_fault_audit_required',v_authority.media_fault_audit_required,
    'authority_id',v_authority_id,'expected_effect_keys',pg_catalog.to_jsonb(v_keys),
    'recipient_snapshot_digest_algorithm','pg-jsonb-text-v1');
  IF (pg_catalog.to_jsonb(v_saved) - 'created_at' - 'audit_event_id') <> v_expected
     OR NOT EXISTS (SELECT 1 FROM public.immutable_audit_events a
         WHERE a.id=v_saved.audit_event_id
           AND a.event_type='observer_event_risk_effect_plan_frozen_v1'
           AND a.target_id=p_signal_id AND a.incident_id=v_incident.id
           AND a.metadata->>'tenant_id'=v_claim.tenant_id::text
           AND a.metadata->>'site_id'=v_site.id::text
           AND a.metadata->>'risk_evaluation_id'=v_risk.id::text
           AND a.metadata->>'authority_id'=v_authority_id::text
           AND a.metadata->>'snapshot_digest'=v_digest) THEN
    RAISE EXCEPTION 'PLAN_SEMANTIC_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN pg_catalog.jsonb_build_object('kind','EFFECTS_PENDING',
    'snapshot_digest',v_digest,'reused',v_reused);
END;
$start_effects$;
REVOKE ALL ON FUNCTION public.start_event_risk_effects_v1(uuid,text,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

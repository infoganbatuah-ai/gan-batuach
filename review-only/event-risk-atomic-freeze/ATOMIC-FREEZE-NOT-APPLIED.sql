-- REVIEW ONLY. Direct execution always aborts. Not a migration or PR #259/#260 replacement.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: isolated canonical-v1 atomic-freeze candidate';
END $review_guard$;

-- Fixture-only private schema. No link to a real source-of-authority reader exists.
CREATE SCHEMA review_atomic;
REVOKE ALL ON SCHEMA review_atomic FROM PUBLIC;

CREATE TABLE review_atomic.frozen_decision (
  event_id uuid NOT NULL,
  engine_version text NOT NULL CHECK (engine_version = 'do-risk-v1'),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  risk_decision_id uuid NOT NULL,
  ownership_evidence_ref text NOT NULL CHECK (length(ownership_evidence_ref) BETWEEN 1 AND 256),
  settings_authority_ref text NOT NULL CHECK (length(settings_authority_ref) BETWEEN 1 AND 256),
  digest_algorithm text NOT NULL CHECK (digest_algorithm = 'canonical-v1'),
  snapshot_content jsonb NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (event_id,engine_version)
);
CREATE TABLE review_atomic.mandatory_audit (
  audit_event_id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  engine_version text NOT NULL,
  digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (event_id,engine_version)
    REFERENCES review_atomic.frozen_decision(event_id,engine_version)
);

CREATE FUNCTION review_atomic.deny_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $immutable$
BEGIN
  RAISE EXCEPTION 'FROZEN_RECORD_IMMUTABLE' USING ERRCODE='42501';
END;
$immutable$;
CREATE TRIGGER frozen_no_change BEFORE UPDATE OR DELETE ON review_atomic.frozen_decision
  FOR EACH ROW EXECUTE FUNCTION review_atomic.deny_mutation();
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON review_atomic.mandatory_audit
  FOR EACH ROW EXECUTE FUNCTION review_atomic.deny_mutation();

-- This verifies structure/digest and atomic behavior only. The caller is NOT
-- an independently proven authority. Real use requires a dedicated server-only
-- identity and trusted consistent read before this candidate can be installed.
CREATE FUNCTION review_atomic.freeze_canonical_v1(p_record jsonb)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $freeze$
DECLARE
  v_event uuid; v_engine text; v_tenant uuid; v_site uuid; v_source uuid;
  v_incident uuid; v_risk uuid; v_audit uuid; v_ownership_ref text;
  v_settings_ref text; v_content jsonb; v_expected jsonb; v_existing review_atomic.frozen_decision%ROWTYPE;
  v_inserted boolean;
BEGIN
  IF pg_catalog.jsonb_typeof(p_record) IS DISTINCT FROM 'object'
     OR NOT (p_record ?& ARRAY['tenantId','siteId','sourceId','eventId','incidentId',
       'riskDecisionId','engineVersion','ownershipEvidenceRef','settingsAuthorityRef',
       'digestAlgorithm','content','fingerprint','digest','auditEventId'])
     OR (p_record - ARRAY['tenantId','siteId','sourceId','eventId','incidentId',
       'riskDecisionId','engineVersion','ownershipEvidenceRef','settingsAuthorityRef',
       'digestAlgorithm','content','fingerprint','digest','auditEventId']) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'FREEZE_RECORD_SHAPE_INVALID' USING ERRCODE='22023';
  END IF;
  v_engine := p_record->>'engineVersion';
  IF v_engine IS DISTINCT FROM 'do-risk-v1'
     OR p_record->>'digestAlgorithm' IS DISTINCT FROM 'canonical-v1' THEN
    RAISE EXCEPTION 'FREEZE_ALGORITHM_OR_ENGINE_DENIED' USING ERRCODE='22023';
  END IF;
  v_tenant := (p_record->>'tenantId')::uuid;
  v_site := (p_record->>'siteId')::uuid;
  v_source := (p_record->>'sourceId')::uuid;
  v_event := (p_record->>'eventId')::uuid;
  v_incident := (p_record->>'incidentId')::uuid;
  v_risk := (p_record->>'riskDecisionId')::uuid;
  v_audit := (p_record->>'auditEventId')::uuid;
  v_ownership_ref := p_record->>'ownershipEvidenceRef';
  v_settings_ref := p_record->>'settingsAuthorityRef';
  IF v_tenant IS NULL OR v_site IS NULL OR v_source IS NULL OR v_event IS NULL
     OR v_incident IS NULL OR v_risk IS NULL OR v_audit IS NULL
     OR length(v_ownership_ref) NOT BETWEEN 1 AND 256
     OR length(v_settings_ref) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'FREEZE_SCOPE_OR_EVIDENCE_INVALID' USING ERRCODE='22023';
  END IF;
  v_content := p_record->'content';
  IF v_content->'scope' IS DISTINCT FROM pg_catalog.jsonb_build_object(
       'tenantId',v_tenant,'siteId',v_site,'sourceId',v_source,
       'eventId',v_event,'incidentId',v_incident,'riskDecisionId',v_risk) THEN
    RAISE EXCEPTION 'FREEZE_SCOPE_MISMATCH' USING ERRCODE='23514';
  END IF;
  v_expected := review_digest.snapshot_digests_v1(v_content,v_tenant,v_site);
  IF p_record->>'fingerprint' IS DISTINCT FROM v_expected->>'fingerprint'
     OR p_record->>'digest' IS DISTINCT FROM v_expected->>'digest' THEN
    RAISE EXCEPTION 'FREEZE_DIGEST_MISMATCH' USING ERRCODE='23514';
  END IF;

  INSERT INTO review_atomic.frozen_decision
    (event_id,engine_version,tenant_id,site_id,source_id,incident_id,risk_decision_id,
     ownership_evidence_ref,settings_authority_ref,digest_algorithm,snapshot_content,
     fingerprint,digest,audit_event_id)
  VALUES (v_event,v_engine,v_tenant,v_site,v_source,v_incident,v_risk,
    v_ownership_ref,v_settings_ref,'canonical-v1',v_content,
    v_expected->>'fingerprint',v_expected->>'digest',v_audit)
  ON CONFLICT (event_id,engine_version) DO NOTHING RETURNING true INTO v_inserted;

  IF v_inserted IS TRUE THEN
    -- No exception handler: any audit failure rolls back the frozen INSERT in
    -- the same statement/transaction. A retry may then acquire the empty key.
    INSERT INTO review_atomic.mandatory_audit(audit_event_id,event_id,engine_version,digest)
      VALUES (v_audit,v_event,v_engine,v_expected->>'digest');
    RETURN 'INSERTED';
  END IF;
  SELECT * INTO v_existing FROM review_atomic.frozen_decision
    WHERE event_id=v_event AND engine_version=v_engine FOR SHARE;
  IF NOT FOUND OR v_existing.tenant_id IS DISTINCT FROM v_tenant
     OR v_existing.site_id IS DISTINCT FROM v_site
     OR v_existing.source_id IS DISTINCT FROM v_source
     OR v_existing.incident_id IS DISTINCT FROM v_incident
     OR v_existing.risk_decision_id IS DISTINCT FROM v_risk
     OR v_existing.ownership_evidence_ref IS DISTINCT FROM v_ownership_ref
     OR v_existing.settings_authority_ref IS DISTINCT FROM v_settings_ref
     OR v_existing.digest_algorithm IS DISTINCT FROM 'canonical-v1'
     OR v_existing.snapshot_content IS DISTINCT FROM v_content
     OR v_existing.fingerprint IS DISTINCT FROM v_expected->>'fingerprint'
     OR v_existing.digest IS DISTINCT FROM v_expected->>'digest'
     OR v_existing.audit_event_id IS DISTINCT FROM v_audit THEN
    RAISE EXCEPTION 'FREEZE_REPLAY_CONFLICT' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM review_atomic.mandatory_audit a
       WHERE a.audit_event_id=v_audit AND a.event_id=v_event
         AND a.engine_version=v_engine AND a.digest=v_existing.digest) THEN
    RAISE EXCEPTION 'FREEZE_AUDIT_MISSING' USING ERRCODE='23514';
  END IF;
  RETURN 'REPLAY_IDENTICAL';
END;
$freeze$;

REVOKE ALL ON FUNCTION review_atomic.deny_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION review_atomic.freeze_canonical_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA review_atomic FROM PUBLIC;
-- No GRANT to anon, authenticated, service_role or any live role in this candidate.

// Pinned review-only delta to the guarded EVENT_INCIDENT_LINK receipt writer.
// The returned SQL still aborts before DDL. No live writer or grant is changed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const PINNED_RECEIPT_SHA256 =
  "a3ad63006db5d31b000f741b72d86d5a89a2690ae64832283e451c8561f2ee06";

export function adaptHomeEffectReceiptFence(source) {
  assert.equal(createHash("sha256").update(source).digest("hex"), PINNED_RECEIPT_SHA256);
  assert.match(source, /DRAFT_NOT_APPLIED/);
  let sql = source;
  let edits = 0;
  function once(before, after) {
    assert.equal(sql.split(before).length - 1, 1,
      `Effect Receipt anchor mismatch: ${before.slice(0, 80)}`);
    sql = sql.replace(before, after);
    edits++;
  }
  once("  v_signal public.observer_intelligence_signals%ROWTYPE;",
    `  v_signal public.observer_intelligence_signals%ROWTYPE;
  v_registration observer_home_review.registration_identities%ROWTYPE;
  v_version observer_home_review.registration_versions%ROWTYPE;
  v_acceptance observer_home_review.event_acceptances%ROWTYPE;
  v_binding observer_home_review.event_bindings%ROWTYPE;
  v_home_audit_count bigint;
  v_home_metadata jsonb;`);
  once("  -- Identical canonical lock order to claim, Risk and plan proposals.\n  SELECT * INTO v_signal",
    `  -- Read immutable acceptance only to select the identity lock. Lock the
  -- identity before Signal, as claim/Risk/plan/revocation do, then re-read.
  SELECT * INTO v_acceptance FROM observer_home_review.event_acceptances
    WHERE event_id=p_signal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EFFECT_HOME_ACCEPTANCE_MISSING' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_registration FROM observer_home_review.registration_identities
    WHERE registration_id=v_acceptance.registration_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EFFECT_HOME_REGISTRATION_MISSING' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_acceptance FROM observer_home_review.event_acceptances
    WHERE event_id=p_signal_id;
  -- Historical acceptance remains evidence even after a later revocation.
  -- An epoch rollback or changed registration association is never valid.
  IF NOT FOUND OR v_acceptance.registration_id IS DISTINCT FROM v_registration.registration_id
     OR v_registration.owner_epoch IS NULL OR v_acceptance.owner_epoch IS NULL
     OR v_registration.owner_epoch < v_acceptance.owner_epoch THEN
    RAISE EXCEPTION 'EFFECT_HOME_ACCEPTANCE_CONFLICT' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_version FROM observer_home_review.registration_versions
    WHERE registration_id=v_acceptance.registration_id
      AND version=v_acceptance.registration_version;
  IF NOT FOUND OR v_version.tenant_id IS DISTINCT FROM v_acceptance.tenant_id
     OR v_version.site_id IS DISTINCT FROM v_acceptance.site_id
     OR v_version.source_id IS DISTINCT FROM v_acceptance.source_id
     OR v_version.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id
     OR v_version.authority_ref IS DISTINCT FROM v_acceptance.authority_ref THEN
    RAISE EXCEPTION 'EFFECT_HOME_VERSION_CONFLICT' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_binding FROM observer_home_review.event_bindings
    WHERE event_id=p_signal_id;
  IF NOT FOUND OR v_binding.registration_id IS DISTINCT FROM v_acceptance.registration_id
     OR v_binding.registration_version IS DISTINCT FROM v_acceptance.registration_version
     OR v_binding.tenant_id IS DISTINCT FROM v_acceptance.tenant_id
     OR v_binding.site_id IS DISTINCT FROM v_acceptance.site_id
     OR v_binding.source_id IS DISTINCT FROM v_acceptance.source_id
     OR v_binding.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id
     OR v_binding.authority_ref IS DISTINCT FROM v_acceptance.authority_ref
     OR v_binding.acceptance_ref IS DISTINCT FROM v_acceptance.acceptance_ref
     OR v_binding.incident_id IS NULL THEN
    RAISE EXCEPTION 'EFFECT_HOME_BINDING_CONFLICT' USING ERRCODE='23514';
  END IF;
  SELECT pg_catalog.count(*) INTO v_home_audit_count
    FROM observer_home_review.registration_audit q
    WHERE q.action='ACCEPTED' AND q.event_id=p_signal_id
      AND q.registration_id=v_acceptance.registration_id
      AND q.version=v_acceptance.registration_version
      AND q.owner_epoch=v_acceptance.owner_epoch;
  IF v_home_audit_count <> 1 THEN
    RAISE EXCEPTION 'EFFECT_HOME_ACCEPTANCE_AUDIT_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT pg_catalog.count(*) INTO v_home_audit_count
    FROM observer_home_review.registration_audit q
    WHERE q.action='BOUND' AND q.audit_ref=v_binding.binding_audit_ref
      AND q.event_id=p_signal_id AND q.registration_id=v_acceptance.registration_id
      AND q.version=v_acceptance.registration_version;
  IF v_home_audit_count <> 1 THEN
    RAISE EXCEPTION 'EFFECT_HOME_BINDING_AUDIT_INVALID' USING ERRCODE='23514';
  END IF;
  IF pg_catalog.jsonb_typeof(v_acceptance.observation_snapshot) IS DISTINCT FROM 'object'
     OR v_acceptance.observation_snapshot->>'eventType' IS DISTINCT FROM 'person_entered'
     OR v_acceptance.observation_snapshot->>'siteId' IS DISTINCT FROM v_acceptance.site_id::text
     OR v_acceptance.observation_snapshot->>'cameraId' IS DISTINCT FROM v_acceptance.source_id::text THEN
    RAISE EXCEPTION 'EFFECT_HOME_OBSERVATION_CONFLICT' USING ERRCODE='23514';
  END IF;

  -- Continue canonical Signal→Site→Org→link→Incident→claim order.
  SELECT * INTO v_signal`);
  once("     OR v_incident.id IS DISTINCT FROM v_claim.incident_id",
    `     OR v_incident.id IS DISTINCT FROM v_claim.incident_id
     OR v_claim.tenant_id IS DISTINCT FROM v_acceptance.tenant_id
     OR v_claim.observer_site_id IS DISTINCT FROM v_acceptance.site_id
     OR v_binding.incident_id IS DISTINCT FROM v_incident.id
     OR v_acceptance.site_id IS DISTINCT FROM v_site.id
     OR v_acceptance.tenant_id IS DISTINCT FROM v_org.id
     OR v_acceptance.owner_profile_id IS DISTINCT FROM v_site.owner_profile_id
     OR v_acceptance.owner_profile_id IS DISTINCT FROM v_org.owner_profile_id
     OR v_acceptance.source_id IS DISTINCT FROM v_incident.primary_camera_source_id
     OR v_signal.source_id::text IS DISTINCT FROM v_acceptance.observation_snapshot->>'sourceId'
     OR v_signal.severity IS DISTINCT FROM v_acceptance.observation_snapshot->>'severity'
     OR v_signal.confidence IS DISTINCT FROM
        pg_catalog.round((v_acceptance.observation_snapshot->>'confidence')::numeric,4)
     OR v_signal.created_at IS DISTINCT FROM
        (v_acceptance.observation_snapshot->>'occurredAt')::timestamptz
     OR NOT (v_incident.related_event_ids @> ARRAY[p_signal_id])`);
  once("  SELECT * INTO v_risk FROM public.digital_observer_risk_evaluations",
    `  v_home_metadata := pg_catalog.jsonb_build_object(
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
  IF v_signal.metadata IS DISTINCT FROM v_home_metadata THEN
    RAISE EXCEPTION 'EFFECT_HOME_SIGNAL_CONFLICT' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_risk FROM public.digital_observer_risk_evaluations`);
  once("  IF v_receipt.signal_id IS NULL THEN\n    INSERT INTO public.immutable_audit_events",
    `  IF v_receipt.signal_id IS NULL THEN
    -- Fresh write only: identity lock still held. Revocation/transfer that
    -- committed first must deny; if we win, revocation waits for commit.
    IF v_registration.revoked IS DISTINCT FROM false
       OR v_registration.owner_epoch IS DISTINCT FROM v_acceptance.owner_epoch
       OR v_registration.tenant_id IS DISTINCT FROM v_acceptance.tenant_id
       OR v_registration.site_id IS DISTINCT FROM v_acceptance.site_id
       OR v_registration.source_id IS DISTINCT FROM v_acceptance.source_id
       OR v_registration.owner_profile_id IS DISTINCT FROM v_acceptance.owner_profile_id THEN
      RAISE EXCEPTION 'EFFECT_HOME_AUTHORITY_REVOKED_OR_CHANGED' USING ERRCODE='23514';
    END IF;
    INSERT INTO public.immutable_audit_events`);
  assert.equal(edits, 5);
  assert.doesNotMatch(sql, /^\s*COMMIT\s*;/im);
  return { sql, editCount: edits };
}

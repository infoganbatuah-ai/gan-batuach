-- REVIEW ONLY. Depends on the separately guarded Home registration proposal.
-- Direct execution aborts before creating anything. No COMMIT or caller grant.
BEGIN;
DO $not_applied$
BEGIN
  RAISE EXCEPTION 'NOT_APPLIED: caller authority, retention, deployed schema and isolated review required';
END;
$not_applied$;

-- Conditional narrow writer: first-qualified Home registration, fresh
-- person_entered/line_crossing only. No transfer, historical first acceptance,
-- general camera event, live adapter, or Guard activation.
-- SECURITY INVOKER is intentional. No role receives EXECUTE here. A future
-- trusted server caller and exact table privileges require separate review.
CREATE FUNCTION observer_home_review.accept_live_home_signal_v1(
  p_registration_id uuid,
  p_observation jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $accept$
DECLARE
  r observer_home_review.registration_identities%ROWTYPE;
  v observer_home_review.registration_versions%ROWTYPE;
  a observer_home_review.event_acceptances%ROWTYPE;
  s public.observer_intelligence_signals%ROWTYPE;
  event_source_id uuid;
  camera_source_id uuid;
  requested_site_id uuid;
  occurred_at timestamptz;
  confidence_value numeric;
  verified_source uuid;
  audit_ref uuid;
  acceptance_ref uuid;
  binding_ref uuid;
BEGIN
  IF p_registration_id IS NULL OR p_observation IS NULL
    OR pg_catalog.jsonb_typeof(p_observation) <> 'object'
    OR pg_catalog.octet_length(p_observation::text) > 4096
    OR NOT (p_observation ?& ARRAY[
      'siteId','sourceId','cameraId','streamId','eventType','severity',
      'confidence','occurredAt','trackId','evidenceKind','recordingRequired',
      'modelProvenance','verificationEvidence'
    ])
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_observation)) <> 13
  THEN
    RAISE EXCEPTION 'HOME_OBSERVATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_typeof(p_observation->'siteId') <> 'string'
    OR pg_catalog.jsonb_typeof(p_observation->'sourceId') <> 'string'
    OR pg_catalog.jsonb_typeof(p_observation->'cameraId') <> 'string'
    OR pg_catalog.jsonb_typeof(p_observation->'streamId') <> 'string'
    OR pg_catalog.jsonb_typeof(p_observation->'trackId') <> 'string'
    OR pg_catalog.jsonb_typeof(p_observation->'confidence') <> 'number'
    OR pg_catalog.jsonb_typeof(p_observation->'recordingRequired') <> 'boolean'
    OR pg_catalog.jsonb_typeof(p_observation->'occurredAt') <> 'string'
    OR p_observation->>'eventType' <> 'person_entered'
    OR p_observation->>'evidenceKind' <> 'line_crossing'
    OR p_observation->>'severity' NOT IN ('info','medium','critical')
    OR pg_catalog.length(p_observation->>'streamId') NOT BETWEEN 1 AND 160
    OR pg_catalog.length(p_observation->>'trackId') NOT BETWEEN 1 AND 120
    OR pg_catalog.jsonb_typeof(p_observation->'modelProvenance') NOT IN ('object','null')
    OR pg_catalog.jsonb_typeof(p_observation->'verificationEvidence') NOT IN ('object','null')
  THEN
    RAISE EXCEPTION 'HOME_OBSERVATION_INVALID' USING ERRCODE = '22023';
  END IF;
  requested_site_id := (p_observation->>'siteId')::uuid;
  event_source_id := (p_observation->>'sourceId')::uuid;
  camera_source_id := (p_observation->>'cameraId')::uuid;
  occurred_at := (p_observation->>'occurredAt')::timestamptz;
  confidence_value := (p_observation->>'confidence')::numeric;
  IF confidence_value NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION 'HOME_OBSERVATION_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Serialize both first acceptance and same-registration replay before
  -- reading the canonical Signal. Otherwise two new callers can both see
  -- absence and the loser would observe only a unique-key collision.
  SELECT * INTO r FROM observer_home_review.registration_identities
    WHERE registration_id=p_registration_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED' USING ERRCODE='P0001';
  END IF;

  -- Retry first: never rebind an accepted event to the current Site/owner.
  SELECT * INTO s FROM public.observer_intelligence_signals
    WHERE source_type='system' AND source_id=event_source_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO a FROM observer_home_review.event_acceptances
      WHERE event_id=s.id FOR SHARE;
    IF NOT FOUND OR a.registration_id IS DISTINCT FROM p_registration_id
      OR a.observation_snapshot IS DISTINCT FROM p_observation
      OR a.site_id IS DISTINCT FROM requested_site_id
      OR a.source_id IS DISTINCT FROM camera_source_id
      OR s.observer_site_id IS DISTINCT FROM a.site_id
      OR s.metadata->>'camera_source_id' IS DISTINCT FROM a.source_id::text
      OR s.source_type <> 'system' OR s.signal_type <> 'ai_camera'
      OR s.severity IS DISTINCT FROM p_observation->>'severity'
      OR s.confidence IS DISTINCT FROM pg_catalog.round(confidence_value,4)
      OR s.created_at IS DISTINCT FROM occurred_at
      OR s.metadata->>'stream_id' IS DISTINCT FROM p_observation->>'streamId'
      OR s.metadata->>'event_type' IS DISTINCT FROM p_observation->>'eventType'
      OR s.metadata->>'track_id' IS DISTINCT FROM p_observation->>'trackId'
      OR s.metadata->>'first_seen' IS DISTINCT FROM p_observation->>'occurredAt'
      OR s.metadata->>'evidence_kind' IS DISTINCT FROM p_observation->>'evidenceKind'
      OR s.metadata->'recording_required' IS DISTINCT FROM p_observation->'recordingRequired'
      OR s.metadata->'model_provenance' IS DISTINCT FROM p_observation->'modelProvenance'
      OR s.metadata->'verification_evidence' IS DISTINCT FROM p_observation->'verificationEvidence'
      OR s.metadata->>'observation_provenance' <> 'REAL_CAMERA_AI'
      OR s.metadata->'validated_event' IS DISTINCT FROM 'true'::jsonb
    THEN
      RAISE EXCEPTION 'HOME_EVENT_REPLAY_CONFLICT_OR_UNRECEIPTED' USING ERRCODE='P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM observer_home_review.event_bindings b
      JOIN observer_home_review.registration_audit q
        ON q.audit_ref=b.binding_audit_ref AND q.action='BOUND'
        AND q.event_id=b.event_id AND q.registration_id=b.registration_id
      WHERE b.event_id=s.id AND b.registration_id=a.registration_id
        AND b.registration_version=a.registration_version
        AND b.tenant_id=a.tenant_id AND b.site_id=a.site_id
        AND b.source_id=a.source_id
    ) OR NOT EXISTS (
      SELECT 1 FROM observer_home_review.registration_audit q
      WHERE q.action='ACCEPTED' AND q.event_id=s.id
        AND q.registration_id=a.registration_id AND q.version=a.registration_version
    ) THEN
      RAISE EXCEPTION 'HOME_EVENT_MANDATORY_EFFECT_MISSING' USING ERRCODE='P0001';
    END IF;
    RETURN s.id;
  END IF;

  -- The existing row lock also serializes a future qualified version change;
  -- transfer remains denied rather than inferred.
  IF r.source_id IS DISTINCT FROM camera_source_id
    OR r.site_id IS DISTINCT FROM requested_site_id
    OR r.current_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v FROM observer_home_review.registration_versions
    WHERE registration_id=r.registration_id AND version=1 FOR SHARE;
  IF NOT FOUND OR v.tenant_id IS DISTINCT FROM r.tenant_id
    OR v.site_id IS DISTINCT FROM r.site_id OR v.source_id IS DISTINCT FROM r.source_id
    OR v.owner_profile_id IS DISTINCT FROM r.owner_profile_id THEN
    RAISE EXCEPTION 'HOME_REGISTRATION_VERSION_UNVERIFIED' USING ERRCODE='P0001';
  END IF;
  -- Hold the current Source, Site and Tenant rows through acceptance. A
  -- concurrent mapping update must wait, or acceptance must observe it and
  -- fail; a read-only EXISTS check would leave a transfer race.
  SELECT c.id INTO verified_source FROM public.digital_observer_camera_sources c
    JOIN public.observer_sites t ON t.id=c.observer_site_id
    JOIN public.digital_observer_organizations o
      ON o.id=t.digital_observer_organization_id
    WHERE c.id=r.source_id AND c.observer_site_id=r.site_id
      AND c.status='connected' AND c.source_mode='live'
      AND t.id=r.site_id AND t.site_type='home' AND t.garden_id IS NULL
      AND t.active AND t.monitoring_enabled
      AND t.metadata->'observer_monitoring_consent'='true'::jsonb
      AND t.owner_profile_id=r.owner_profile_id
      AND o.id=r.tenant_id AND o.owner_profile_id=r.owner_profile_id AND o.active
    FOR SHARE OF c,t,o;
  IF NOT FOUND OR verified_source IS DISTINCT FROM r.source_id THEN
    RAISE EXCEPTION 'HOME_CURRENT_SOURCE_SCOPE_UNVERIFIED' USING ERRCODE='P0001';
  END IF;
  IF occurred_at < v.qualified_at
    OR occurred_at < pg_catalog.clock_timestamp() - interval '60 seconds'
    OR occurred_at > pg_catalog.clock_timestamp() + interval '5 seconds' THEN
    RAISE EXCEPTION 'HOME_EVENT_TIME_UNVERIFIED' USING ERRCODE='P0001';
  END IF;

  -- A source-key collision without a receipt is never interpreted as equal.
  INSERT INTO public.observer_intelligence_signals
    (source_type,source_id,signal_type,observer_site_id,severity,confidence,
     created_at,review_status,human_review_required,parent_visible,metadata)
  VALUES
    ('system',event_source_id,'ai_camera',r.site_id,
     p_observation->>'severity',confidence_value,occurred_at,'needs_review',true,false,
     pg_catalog.jsonb_build_object(
       'camera_source_id',r.source_id,'stream_id',p_observation->>'streamId',
       'event_type','person_entered','track_id',p_observation->>'trackId',
       'first_seen',p_observation->>'occurredAt',
       'evidence_kind','line_crossing','recording_required',p_observation->'recordingRequired',
       'model_provenance',p_observation->'modelProvenance',
       'verification_evidence',p_observation->'verificationEvidence',
       'validated_event',true,'observation_provenance','REAL_CAMERA_AI'
     ))
  ON CONFLICT (source_type,source_id) WHERE source_id IS NOT NULL DO NOTHING
  RETURNING * INTO s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOME_SIGNAL_SOURCE_COLLISION_RETRY' USING ERRCODE='P0001';
  END IF;
  -- The canonical trigger may create or attach an Incident on Signal INSERT.
  -- Never assert an Incident association solely from metadata or Site lookup.
  IF NOT EXISTS (
    SELECT 1 FROM public.observer_correlated_event_links l
    JOIN public.observer_correlated_events i ON i.id=l.correlated_event_id
    WHERE l.source_type='observer_intelligence_signal' AND l.source_id=s.id
      AND l.observer_site_id=r.site_id AND i.observer_site_id=r.site_id
      AND i.primary_camera_source_id=r.source_id
      AND i.related_event_ids @> ARRAY[s.id]
  ) THEN
    RAISE EXCEPTION 'HOME_INCIDENT_SCOPE_UNVERIFIED' USING ERRCODE='P0001';
  END IF;

  audit_ref := pg_catalog.gen_random_uuid();
  acceptance_ref := pg_catalog.gen_random_uuid();
  INSERT INTO observer_home_review.event_acceptances
    (event_id,tenant_id,site_id,source_id,owner_profile_id,registration_id,
     registration_version,authority_ref,acceptance_ref,observation_snapshot)
  VALUES
    (s.id,r.tenant_id,r.site_id,r.source_id,r.owner_profile_id,r.registration_id,
     v.version,v.authority_ref,acceptance_ref,p_observation);
  INSERT INTO observer_home_review.registration_audit
    (audit_ref,action,registration_id,version,event_id)
  VALUES (audit_ref,'ACCEPTED',r.registration_id,v.version,s.id);
  binding_ref := observer_home_review.bind_accepted_event_v1(s.id);
  IF binding_ref IS NULL THEN
    RAISE EXCEPTION 'HOME_BINDING_UNVERIFIED' USING ERRCODE='P0001';
  END IF;
  RETURN s.id;
END;
$accept$;
REVOKE ALL ON FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- No GRANT, data adapter, transfer, historical backfill, migration or COMMIT.

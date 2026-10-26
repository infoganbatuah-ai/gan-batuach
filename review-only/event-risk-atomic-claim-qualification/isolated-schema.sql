-- Synthetic PostgreSQL 17 fixture only. Never apply to LOCAL_SUPABASE.
-- A direct execution always aborts before creating roles or tables.
BEGIN;
DO $qa_fixture_guard$
BEGIN
  RAISE EXCEPTION 'ISOLATED_FIXTURE_ONLY: use the network-disabled disposable runner';
END;
$qa_fixture_guard$;

-- The runner removes the guard in memory only after verifying local Docker isolation.
CREATE ROLE service_role LOGIN BYPASSRLS;
CREATE ROLE anon LOGIN;
CREATE ROLE authenticated LOGIN;

CREATE TABLE public.digital_observer_organizations (
  id uuid PRIMARY KEY, active boolean NOT NULL, organization_type text NOT NULL,
  owner_profile_id uuid NOT NULL
);
CREATE TABLE public.observer_sites (
  id uuid PRIMARY KEY, garden_id uuid, site_type text NOT NULL,
  active boolean NOT NULL, monitoring_enabled boolean NOT NULL,
  metadata jsonb NOT NULL, digital_observer_organization_id uuid,
  owner_profile_id uuid NOT NULL
);
CREATE TABLE public.digital_observer_camera_sources (
  id uuid PRIMARY KEY, observer_site_id uuid NOT NULL
);
CREATE TABLE public.observer_intelligence_signals (
  id uuid PRIMARY KEY, observer_site_id uuid NOT NULL,
  source_type text NOT NULL, signal_type text NOT NULL, metadata jsonb NOT NULL
);
CREATE TABLE public.observer_correlated_events (
  id uuid PRIMARY KEY, observer_site_id uuid NOT NULL,
  provenance text NOT NULL, primary_camera_source_id uuid NOT NULL
);
CREATE TABLE public.observer_correlated_event_links (
  source_type text NOT NULL, source_id uuid NOT NULL,
  observer_site_id uuid NOT NULL, correlated_event_id uuid NOT NULL,
  PRIMARY KEY (source_type, source_id)
);
CREATE TABLE public.observer_event_risk_claims (
  signal_id uuid NOT NULL, risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL, observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL, status text NOT NULL DEFAULT 'CLAIMED',
  owner_nonce uuid NOT NULL, owner_epoch bigint NOT NULL,
  lease_expires_at timestamptz NOT NULL, risk_evaluation_id uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (signal_id, risk_engine_version),
  CHECK (owner_epoch > 0),
  CHECK (status IN ('CLAIMED','RISK_PERSISTED','EFFECTS_PENDING','COMPLETED'))
);
CREATE TABLE public.immutable_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL, event_category text NOT NULL,
  actor_role text NOT NULL, target_type text NOT NULL,
  target_id uuid NOT NULL, incident_id uuid NOT NULL,
  metadata jsonb NOT NULL, risk_level text NOT NULL
);

-- Shape-compatible Home receipt fixture, NOT a source of live ownership.
-- The real proposed schema and writer remain separately guarded and absent
-- from Development; these rows exercise only the claim-time SQL boundary.
CREATE SCHEMA observer_home_review;
CREATE TABLE observer_home_review.registration_identities (
  registration_id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  site_id uuid NOT NULL, source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL, owner_epoch bigint NOT NULL,
  revoked boolean NOT NULL
);
CREATE TABLE observer_home_review.registration_versions (
  registration_id uuid NOT NULL, version bigint NOT NULL,
  tenant_id uuid NOT NULL, site_id uuid NOT NULL,
  source_id uuid NOT NULL, owner_profile_id uuid NOT NULL,
  authority_ref uuid NOT NULL, PRIMARY KEY (registration_id,version)
);
CREATE TABLE observer_home_review.event_acceptances (
  event_id uuid PRIMARY KEY, registration_id uuid NOT NULL,
  registration_version bigint NOT NULL, tenant_id uuid NOT NULL,
  site_id uuid NOT NULL, source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL, authority_ref uuid NOT NULL,
  acceptance_ref uuid NOT NULL UNIQUE, owner_epoch bigint NOT NULL,
  observation_snapshot jsonb NOT NULL
);
CREATE TABLE observer_home_review.event_bindings (
  event_id uuid PRIMARY KEY, registration_id uuid NOT NULL,
  registration_version bigint NOT NULL, tenant_id uuid NOT NULL,
  site_id uuid NOT NULL, source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL, authority_ref uuid NOT NULL,
  acceptance_ref uuid NOT NULL, binding_audit_ref uuid NOT NULL UNIQUE,
  incident_id uuid NOT NULL
);
CREATE TABLE observer_home_review.registration_audit (
  audit_ref uuid PRIMARY KEY, action text NOT NULL,
  registration_id uuid NOT NULL, version bigint,
  event_id uuid, owner_epoch bigint
);

INSERT INTO public.digital_observer_organizations VALUES
  ('11111111-1111-4111-8111-111111111111', true, 'family', '12121212-1212-4212-8212-121212121212'),
  ('22222222-2222-4222-8222-222222222222', true, 'business', '23232323-2323-4232-8232-232323232323');
INSERT INTO public.observer_sites VALUES
  ('33333333-3333-4333-8333-333333333333', NULL, 'home', true, true,
   '{"observer_monitoring_consent":"true"}', '11111111-1111-4111-8111-111111111111',
   '12121212-1212-4212-8212-121212121212'),
  ('44444444-4444-4444-8444-444444444444', NULL, 'business', true, true,
   '{"observer_monitoring_consent":"true"}', '22222222-2222-4222-8222-222222222222',
   '23232323-2323-4232-8232-232323232323');
INSERT INTO public.digital_observer_camera_sources VALUES
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333'),
  ('66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444');
INSERT INTO public.observer_intelligence_signals VALUES
  ('77777777-7777-4777-8777-777777777777', '33333333-3333-4333-8333-333333333333',
   'system', 'ai_camera', '{"observation_provenance":"REAL_CAMERA_AI","validated_event":true,"event_type":"person_entered","camera_source_id":"55555555-5555-4555-8555-555555555555"}'),
  ('88888888-8888-4888-8888-888888888888', '33333333-3333-4333-8333-333333333333',
   'system', 'ai_camera', '{"observation_provenance":"REAL_CAMERA_AI","validated_event":true,"event_type":"person_entered","camera_source_id":"55555555-5555-4555-8555-555555555555"}'),
  ('99999999-9999-4999-8999-999999999999', '33333333-3333-4333-8333-333333333333',
   'system', 'ai_camera', '{"observation_provenance":"REAL_CAMERA_AI","validated_event":true,"event_type":"person_entered","camera_source_id":"55555555-5555-4555-8555-555555555555"}');
ALTER TABLE public.observer_intelligence_signals
  ADD COLUMN source_id uuid,
  ADD COLUMN severity text NOT NULL DEFAULT 'medium',
  ADD COLUMN confidence numeric NOT NULL DEFAULT 0.9,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT transaction_timestamp();
UPDATE public.observer_intelligence_signals SET source_id=id,
  metadata=metadata || pg_catalog.jsonb_build_object(
    'stream_id','synthetic-stream','track_id','synthetic-track',
    'first_seen',created_at::text,'evidence_kind','line_crossing',
    'recording_required',false,'model_provenance',NULL,
    'verification_evidence',NULL);
INSERT INTO public.observer_correlated_events VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333',
   'REAL_CAMERA_AI', '55555555-5555-4555-8555-555555555555'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333',
   'REAL_CAMERA_AI', '55555555-5555-4555-8555-555555555555');
INSERT INTO public.observer_correlated_event_links VALUES
  ('observer_intelligence_signal', '77777777-7777-4777-8777-777777777777',
   '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('observer_intelligence_signal', '88888888-8888-4888-8888-888888888888',
   '33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('observer_intelligence_signal', '99999999-9999-4999-8999-999999999999',
   '33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

INSERT INTO observer_home_review.registration_identities VALUES
  ('13131313-1313-4313-8313-131313131313',
   '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   '55555555-5555-4555-8555-555555555555',
   '12121212-1212-4212-8212-121212121212',0,false);
INSERT INTO observer_home_review.registration_versions VALUES
  ('13131313-1313-4313-8313-131313131313',1,
   '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   '55555555-5555-4555-8555-555555555555',
   '12121212-1212-4212-8212-121212121212',
   '14141414-1414-4414-8414-141414141414');
INSERT INTO observer_home_review.event_acceptances
  (event_id,registration_id,registration_version,tenant_id,site_id,source_id,
   owner_profile_id,authority_ref,acceptance_ref,owner_epoch,observation_snapshot)
SELECT s.id,'13131313-1313-4313-8313-131313131313',1,
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  '12121212-1212-4212-8212-121212121212',
  '14141414-1414-4414-8414-141414141414',pg_catalog.gen_random_uuid(),0,
  pg_catalog.jsonb_build_object(
    'siteId',s.observer_site_id,'sourceId',s.source_id,
    'cameraId',s.metadata->>'camera_source_id',
    'streamId',s.metadata->>'stream_id',
    'eventType',s.metadata->>'event_type',
    'severity',s.severity,'confidence',s.confidence,
    'occurredAt',s.created_at::text,'trackId',s.metadata->>'track_id',
    'evidenceKind',s.metadata->>'evidence_kind',
    'recordingRequired',s.metadata->'recording_required',
    'modelProvenance',s.metadata->'model_provenance',
    'verificationEvidence',s.metadata->'verification_evidence')
FROM public.observer_intelligence_signals s;
INSERT INTO observer_home_review.event_bindings
  (event_id,registration_id,registration_version,tenant_id,site_id,source_id,
   owner_profile_id,authority_ref,acceptance_ref,binding_audit_ref,incident_id)
SELECT a.event_id,a.registration_id,a.registration_version,a.tenant_id,a.site_id,
  a.source_id,a.owner_profile_id,a.authority_ref,a.acceptance_ref,
  pg_catalog.gen_random_uuid(),l.correlated_event_id
FROM observer_home_review.event_acceptances a
JOIN public.observer_correlated_event_links l ON l.source_id=a.event_id
  AND l.source_type='observer_intelligence_signal';
INSERT INTO observer_home_review.registration_audit
  (audit_ref,action,registration_id,version,event_id,owner_epoch)
SELECT pg_catalog.gen_random_uuid(),'ACCEPTED',a.registration_id,a.registration_version,
  a.event_id,a.owner_epoch FROM observer_home_review.event_acceptances a;
INSERT INTO observer_home_review.registration_audit
  (audit_ref,action,registration_id,version,event_id,owner_epoch)
SELECT b.binding_audit_ref,'BOUND',b.registration_id,b.registration_version,
  b.event_id,0 FROM observer_home_review.event_bindings b;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA observer_home_review TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA observer_home_review TO service_role;
-- Synthetic privilege only. A real dedicated risk caller and its inability to
-- mutate owner state remain an unapproved ACL/design dependency.
GRANT UPDATE(owner_epoch) ON observer_home_review.registration_identities TO service_role;

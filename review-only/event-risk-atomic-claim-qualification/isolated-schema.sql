-- Synthetic PostgreSQL 17 fixture only. Never apply to LOCAL_SUPABASE.
CREATE ROLE service_role LOGIN BYPASSRLS;
CREATE ROLE anon LOGIN;
CREATE ROLE authenticated LOGIN;

CREATE TABLE public.digital_observer_organizations (
  id uuid PRIMARY KEY, active boolean NOT NULL, organization_type text NOT NULL
);
CREATE TABLE public.observer_sites (
  id uuid PRIMARY KEY, garden_id uuid, site_type text NOT NULL,
  active boolean NOT NULL, monitoring_enabled boolean NOT NULL,
  metadata jsonb NOT NULL, digital_observer_organization_id uuid
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

INSERT INTO public.digital_observer_organizations VALUES
  ('11111111-1111-4111-8111-111111111111', true, 'family'),
  ('22222222-2222-4222-8222-222222222222', true, 'business');
INSERT INTO public.observer_sites VALUES
  ('33333333-3333-4333-8333-333333333333', NULL, 'home', true, true,
   '{"observer_monitoring_consent":"true"}', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444', NULL, 'business', true, true,
   '{"observer_monitoring_consent":"true"}', '22222222-2222-4222-8222-222222222222');
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

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

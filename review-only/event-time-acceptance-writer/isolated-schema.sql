-- Synthetic fixture only. Direct execution aborts before creating anything.
BEGIN;
DO $fixture_guard$
BEGIN
  RAISE EXCEPTION 'ISOLATED_FIXTURE_ONLY';
END;
$fixture_guard$;

CREATE ROLE anon LOGIN;
CREATE ROLE authenticated LOGIN;
CREATE ROLE service_role LOGIN BYPASSRLS;
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.digital_observer_organizations (
  id uuid PRIMARY KEY, owner_profile_id uuid NOT NULL, active boolean NOT NULL
);
CREATE TABLE public.observer_sites (
  id uuid PRIMARY KEY, digital_observer_organization_id uuid,
  owner_profile_id uuid, garden_id uuid, site_type text NOT NULL,
  active boolean NOT NULL, monitoring_enabled boolean NOT NULL, metadata jsonb NOT NULL
);
CREATE TABLE public.digital_observer_camera_sources (
  id uuid PRIMARY KEY, observer_site_id uuid NOT NULL,
  status text NOT NULL, source_mode text NOT NULL
);
CREATE TABLE public.observer_intelligence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL, source_id uuid, signal_type text NOT NULL,
  observer_site_id uuid, severity text NOT NULL,
  confidence numeric(5,4), created_at timestamptz NOT NULL,
  review_status text NOT NULL, human_review_required boolean NOT NULL,
  parent_visible boolean NOT NULL, metadata jsonb NOT NULL
);
CREATE UNIQUE INDEX observer_intelligence_signals_source_unique
  ON public.observer_intelligence_signals(source_type,source_id)
  WHERE source_id IS NOT NULL;
CREATE TABLE public.observer_correlated_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), observer_site_id uuid,
  primary_camera_source_id uuid, related_event_ids uuid[] NOT NULL DEFAULT '{}'
);
CREATE TABLE public.observer_correlated_event_links (
  correlated_event_id uuid NOT NULL REFERENCES public.observer_correlated_events(id),
  source_type text NOT NULL, source_id uuid NOT NULL,
  observer_site_id uuid, PRIMARY KEY(source_type,source_id)
);

-- Synthetic stand-in for the source-defined after-insert correlation trigger;
-- this is not proof of the deployed trigger's behavior.
CREATE FUNCTION public.qa_correlate_signal() RETURNS trigger LANGUAGE plpgsql AS $qa$
DECLARE incident_id uuid;
BEGIN
  INSERT INTO public.observer_correlated_events
    (observer_site_id,primary_camera_source_id,related_event_ids)
  VALUES (NEW.observer_site_id,(NEW.metadata->>'camera_source_id')::uuid,ARRAY[NEW.id])
  RETURNING id INTO incident_id;
  INSERT INTO public.observer_correlated_event_links
    (correlated_event_id,source_type,source_id,observer_site_id)
  VALUES (incident_id,'observer_intelligence_signal',NEW.id,NEW.observer_site_id);
  RETURN NEW;
END;
$qa$;
CREATE TRIGGER qa_correlate_signal AFTER INSERT ON public.observer_intelligence_signals
  FOR EACH ROW EXECUTE FUNCTION public.qa_correlate_signal();

INSERT INTO public.profiles VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.digital_observer_organizations VALUES
  ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',true),
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.observer_sites VALUES
  ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
   '11111111-1111-4111-8111-111111111111',NULL,'home',true,true,
   '{"observer_monitoring_consent":true}'),
  ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111',NULL,'home',true,true,
   '{"observer_monitoring_consent":true}');
INSERT INTO public.digital_observer_camera_sources VALUES
  ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','connected','live'),
  ('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','connected','live');

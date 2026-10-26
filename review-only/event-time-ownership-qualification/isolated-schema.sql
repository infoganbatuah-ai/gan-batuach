-- REVIEW-ONLY synthetic fixture. Direct execution aborts before any object creation.
BEGIN;
DO $fixture_guard$
BEGIN
  RAISE EXCEPTION 'ISOLATED_FIXTURE_ONLY';
END;
$fixture_guard$;

-- The runner removes the guard only inside a disposable, network-disabled DB.
CREATE ROLE anon LOGIN;
CREATE ROLE authenticated LOGIN;
CREATE ROLE service_role LOGIN BYPASSRLS;
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.digital_observer_organizations (id uuid PRIMARY KEY);
CREATE TABLE public.observer_sites (id uuid PRIMARY KEY);
CREATE TABLE public.digital_observer_camera_sources (id uuid PRIMARY KEY, observer_site_id uuid NOT NULL);
CREATE TABLE public.observer_intelligence_signals (
  id uuid PRIMARY KEY,
  observer_site_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO public.profiles VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.digital_observer_organizations VALUES
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.observer_sites VALUES
  ('44444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555');
INSERT INTO public.digital_observer_camera_sources VALUES
  ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444'),
  ('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555');
INSERT INTO public.observer_intelligence_signals VALUES
  ('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444',
   '{"camera_source_id":"66666666-6666-4666-8666-666666666666"}'),
  ('99999999-9999-4999-8999-999999999999','55555555-5555-4555-8555-555555555555',
   '{"camera_source_id":"77777777-7777-4777-8777-777777777777"}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,'{}');

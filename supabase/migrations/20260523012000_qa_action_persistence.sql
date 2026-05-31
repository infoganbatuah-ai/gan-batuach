-- QA correction pass: persist UI actions and support pending camera states.

alter typeש public.camera_status add value if not exists 'pending_gateway';
alter type public.camera_status add value if not exists 'connected';
alter type public.camera_status add value if not exists 'failed';
alter type public.camera_status add value if not exists 'error';

alter table public.profiles
  add column if not exists notes text;

alter table public.ai_events
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists handled_note text,
  add column if not exists false_positive_reason text;

alter table public.complaints
  add column if not exists internal_notes text,
  add column if not exists status_history jsonb not null default '[]'::jsonb;

alter table public.incident_reports
  add column if not exists internal_notes text,
  add column if not exists status_history jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('child-photos', 'child-photos', false),
  ('incident-photos', 'incident-photos', false),
  ('inspection-reports', 'inspection-reports', false),
  ('gallery', 'gallery', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

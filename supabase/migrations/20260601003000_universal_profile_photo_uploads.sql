-- Universal authenticated photo upload buckets and profile photo fields.

insert into storage.buckets (id, name, public)
values
  ('profile-photos', 'profile-photos', false),
  ('pickup-person-photos', 'pickup-person-photos', false),
  ('kindergarten-logos', 'kindergarten-logos', false)
on conflict (id) do update set public = false;

alter table public.parents
  add column if not exists photo_url text;

alter table public.inspectors
  add column if not exists profile_photo_url text;

alter table public.staff
  add column if not exists profile_photo_url text;

notify pgrst, 'reload schema';

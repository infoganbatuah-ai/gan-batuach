alter table public.profiles
  add column if not exists address text,
  add column if not exists emergency_contact text,
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

alter table public.parents
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists profile_image_url text,
  add column if not exists emergency_details text;

update public.parents set user_id = coalesce(user_id, profile_id) where profile_id is not null;

alter table public.children
  add column if not exists approval_notes text,
  add column if not exists manager_response text;

alter table public.gardens
  add column if not exists public_description text;

notify pgrst, 'reload schema';

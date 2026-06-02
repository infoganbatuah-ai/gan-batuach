-- Clean parent lead -> parent approval -> child completion -> child approval flow.

alter table public.leads
  add column if not exists requested_age_group text,
  add column if not exists requested_start_date date,
  add column if not exists parent_approval_notes text;

alter table public.children
  add column if not exists child_age text,
  add column if not exists requested_age_group text,
  add column if not exists requested_start_date date,
  add column if not exists lead_parent_name text,
  add column if not exists lead_parent_phone text,
  add column if not exists parent_photo_url text,
  add column if not exists mother_photo_url text,
  add column if not exists father_photo_url text,
  add column if not exists important_notes text,
  add column if not exists likes_notes text,
  add column if not exists dislikes_notes text;

alter table public.permanent_child_files
  add column if not exists likes_notes text,
  add column if not exists dislikes_notes text;

notify pgrst, 'reload schema';

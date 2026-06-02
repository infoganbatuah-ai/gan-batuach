-- Production security hardening for tenant isolation and private storage.

drop policy if exists "garden access by role" on public.gardens;
create policy "garden access by role" on public.gardens
for select using (
  public.can_access_garden(id)
  or coalesce(public_profile_enabled, false) = true
  or public.can_parent_access_garden(id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('child-photos', 'child-photos', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('pickup-person-photos', 'pickup-person-photos', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('kindergarten-logos', 'kindergarten-logos', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('documents', 'documents', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('incident-photos', 'incident-photos', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('inspection-reports', 'inspection-reports', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('gallery', 'gallery', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';

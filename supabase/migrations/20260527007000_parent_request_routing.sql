alter table public.parent_child_requests
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists recipient_role text,
  add column if not exists recipient_role_group text,
  add column if not exists recipient_label text,
  add column if not exists routed_to_admin boolean not null default false,
  add column if not exists routed_to_inspector boolean not null default false,
  add column if not exists handled_by uuid references public.profiles(id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists response_text text,
  add column if not exists internal_notes text,
  add column if not exists priority text not null default 'normal',
  add column if not exists viewed_at timestamptz;

create index if not exists idx_parent_child_requests_recipient_profile
  on public.parent_child_requests(recipient_profile_id, status, created_at desc);

create index if not exists idx_parent_child_requests_role_group
  on public.parent_child_requests(garden_id, recipient_role_group, status, created_at desc);

drop policy if exists "parent child requests recipient scoped read" on public.parent_child_requests;
create policy "parent child requests recipient scoped read"
on public.parent_child_requests
for select
using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or parent_profile_id = auth.uid()
  or recipient_profile_id = auth.uid()
);

notify pgrst, 'reload schema';

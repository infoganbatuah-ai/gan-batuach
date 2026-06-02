create or replace function public.can_parent_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role = 'parent'
        and (
          p.garden_id = target_garden_id
          or exists (
            select 1
            from public.parents pr
            where (pr.profile_id = p.id or pr.user_id = p.id)
              and pr.garden_id = target_garden_id
          )
          or exists (
            select 1
            from public.children c
            join public.parents pr on pr.id = c.primary_parent_id
            where (pr.profile_id = p.id or pr.user_id = p.id)
              and c.garden_id = target_garden_id
          )
        )
    )
$$;

drop policy if exists "parents read allowed camera streams" on public.camera_streams;

create policy "parents read allowed camera streams"
on public.camera_streams
for select
using (
  public.current_role() = 'parent'
  and coalesce(active, true) = true
  and (coalesce(parent_view_allowed, false) = true or coalesce(parent_viewing_allowed, false) = true)
  and (
    public.can_parent_access_garden(garden_id)
    or public.can_parent_access_garden(kindergarten_id)
  )
);

notify pgrst, 'reload schema';

-- Add kindergarten owner role and owner-aware access helpers.
do $$
begin
  if not exists (select 1 from pg_enum where enumtypid = 'public.app_role'::regtype and enumlabel = 'owner') then
    alter type public.app_role add value 'owner' after 'manager';
  end if;
end $$;

alter table public.gardens add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null;

create or replace function public.can_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      left join public.gardens g on g.id = target_garden_id
      where p.id = auth.uid()
        and p.active = true
        and (
          p.garden_id = target_garden_id
          or (p.role = 'inspector' and g.inspector_id = p.id)
          or (p.role = 'owner' and (g.owner_profile_id = p.id or p.garden_id = target_garden_id))
        )
    )
$$;

drop policy if exists "managers update own garden" on public.gardens;
create policy "managers owners update own garden" on public.gardens for update
using ((public.current_role() in ('manager','owner')) and id = public.current_garden_id())
with check (id = public.current_garden_id());

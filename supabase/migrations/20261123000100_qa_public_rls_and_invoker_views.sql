-- QA security advisor: close five unprotected public tables and two definer views.
-- Forward-only; application writers retain their existing authenticated paths.

alter table public.inspection_overrides enable row level security;
alter table public.inspection_signatures enable row level security;
alter table public.gps_verification_logs enable row level security;
alter table public.daily_operational_tasks enable row level security;
alter table public.daily_task_completions enable row level security;

-- Overrides are written only by the server-side service client. No direct
-- authenticated or anonymous access is required.

-- The 20260913 inspection workflow installed a PUBLIC policy before this
-- table had RLS. Replace it rather than OR-ing a new policy with it.
drop policy if exists "management inspection signatures scoped read" on public.inspection_signatures;
create policy "inspection signatures scoped read" on public.inspection_signatures
  for select to authenticated using (
    public.current_role()::text in ('admin', 'manager', 'owner', 'inspector')
    and exists (
      select 1 from public.inspections i
      where i.id = inspection_id and public.can_access_garden(i.garden_id)
    )
  );

create policy "gps verification own scoped read" on public.gps_verification_logs
  for select to authenticated using (
    user_id = auth.uid() and garden_id is not null
    and (
      public.can_access_garden(garden_id)
      or (child_id is not null and public.can_parent_access_child(child_id))
    )
  );

create policy "gps verification own scoped insert" on public.gps_verification_logs
  for insert to authenticated with check (
    user_id = auth.uid() and user_role = public.current_role()::text
    and garden_id is not null
    and (
      public.can_access_garden(garden_id)
      or (child_id is not null and public.can_parent_access_child(child_id))
    )
    and (child_id is null or exists (
      select 1 from public.children c
      where c.id = child_id and c.garden_id = garden_id
    ))
  );

create policy "operational tasks scoped read" on public.daily_operational_tasks
  for select to authenticated using (
    active and public.current_role()::text = any(role_scope)
    and (
      (garden_id is not null and public.can_access_garden(garden_id))
      or (garden_id is null and public.current_garden_id() is not null
          and public.can_access_garden(public.current_garden_id()))
    )
  );

create policy "task completions scoped read" on public.daily_task_completions
  for select to authenticated using (
    garden_id is not null and public.can_access_garden(garden_id)
    and (completed_by = auth.uid() or public.can_manage_garden(garden_id))
  );

create policy "task completions own insert" on public.daily_task_completions
  for insert to authenticated with check (
    completed_by = auth.uid()
    and completed_by_role = public.current_role()::text
    and completed_by_role in ('manager', 'owner', 'staff')
    and garden_id is not null and public.can_access_garden(garden_id)
    and exists (
      select 1 from public.daily_operational_tasks task
      where task.id = operational_task_id and task.active
        and (task.garden_id = garden_id or task.garden_id is null)
        and completed_by_role = any(task.role_scope)
    )
  );

create policy "task completions own update" on public.daily_task_completions
  for update to authenticated
  using (completed_by = auth.uid() and garden_id is not null
         and public.can_access_garden(garden_id))
  with check (
    completed_by = auth.uid()
    and completed_by_role = public.current_role()::text
    and completed_by_role in ('manager', 'owner', 'staff')
    and garden_id is not null and public.can_access_garden(garden_id)
    and exists (
      select 1 from public.daily_operational_tasks task
      where task.id = operational_task_id and task.active
        and (task.garden_id = garden_id or task.garden_id is null)
        and completed_by_role = any(task.role_scope)
    )
  );

-- The underlying tables already have RLS; these views must use the caller's
-- grants and policies rather than the view owner's privileges.
alter view public.privacy_requests set (security_invoker = true);
alter view public.observer_packages set (security_invoker = true);

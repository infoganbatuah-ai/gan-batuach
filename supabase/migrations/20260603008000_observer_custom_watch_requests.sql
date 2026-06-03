create table if not exists public.observer_watch_requests (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_id uuid references public.camera_zones(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  watch_type text not null,
  active boolean not null default true,
  priority integer not null default 5,
  schedule jsonb not null default '{"mode":"always_active"}'::jsonb,
  notification_channels jsonb not null default '["in_app"]'::jsonb,
  requires_human_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_watch_requests_type_check check (watch_type in (
    'movement_in_area',
    'no_movement',
    'door_left_open',
    'person_near_object',
    'restricted_area_entry',
    'after_hours_activity',
    'camera_obstruction',
    'custom_text_instruction'
  )),
  constraint observer_watch_requests_priority_check check (priority between 1 and 10)
);

alter table public.ai_camera_events
  add column if not exists watch_request_id uuid references public.observer_watch_requests(id) on delete set null,
  add column if not exists zone_id uuid references public.camera_zones(id) on delete set null;

create index if not exists observer_watch_requests_site_active_idx on public.observer_watch_requests(observer_site_id, active, priority desc);
create index if not exists observer_watch_requests_kindergarten_active_idx on public.observer_watch_requests(kindergarten_id, active, priority desc);
create index if not exists observer_watch_requests_camera_zone_idx on public.observer_watch_requests(camera_id, zone_id, active);
create index if not exists observer_watch_requests_type_idx on public.observer_watch_requests(watch_type, active, created_at desc);
create index if not exists ai_camera_events_watch_request_idx on public.ai_camera_events(watch_request_id, created_at desc);
create index if not exists ai_camera_events_zone_idx on public.ai_camera_events(zone_id, created_at desc);

alter table public.observer_watch_requests enable row level security;

drop policy if exists "observer watch requests admin all" on public.observer_watch_requests;
create policy "observer watch requests admin all" on public.observer_watch_requests
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer watch requests garden read" on public.observer_watch_requests;
create policy "observer watch requests garden read" on public.observer_watch_requests
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_watch_requests.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "observer watch requests scoped write" on public.observer_watch_requests;
create policy "observer watch requests scoped write" on public.observer_watch_requests
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_watch_requests.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_watch_requests.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

comment on table public.observer_watch_requests is 'Custom watch requests for mock/future Digital Observer rules. No real AI execution and no parent raw visibility.';
comment on column public.observer_watch_requests.description is 'Plain user request such as watch the back gate. Custom text is saved for future interpretation, not parsed by AI in this phase.';
comment on column public.ai_camera_events.watch_request_id is 'Optional link to the custom watch request that produced a reviewed/shadow event.';

notify pgrst, 'reload schema';

-- Digital Observer engine separation.
-- Safe Kindergarten is skeleton-only; standard sites may use biometric
-- processing only under the existing consent/provider controls.

alter table public.observer_sites
  add column if not exists engine_mode text not null default 'standard_biometric';

update public.observer_sites
set engine_mode = case
  when site_type = 'kindergarten'
    or business_handles_children = true
    or vision_privacy_mode = 'skeleton_only'
    then 'kindergarten_skeleton'
  else 'standard_biometric'
end,
vision_privacy_mode = case
  when site_type = 'kindergarten'
    or business_handles_children = true
    or vision_privacy_mode = 'skeleton_only'
    then 'skeleton_only'
  else 'standard_consent'
end;

alter table public.observer_sites
  drop constraint if exists observer_sites_engine_mode_check;

alter table public.observer_sites
  add constraint observer_sites_engine_mode_check
  check (engine_mode in ('standard_biometric', 'kindergarten_skeleton'));

-- Keep the legacy privacy column and the canonical engine mode consistent.
alter table public.observer_sites
  drop constraint if exists observer_sites_engine_privacy_consistency_check;

alter table public.observer_sites
  add constraint observer_sites_engine_privacy_consistency_check
  check (
    (engine_mode = 'kindergarten_skeleton' and vision_privacy_mode = 'skeleton_only')
    or (engine_mode = 'standard_biometric' and vision_privacy_mode = 'standard_consent')
  );

create index if not exists observer_sites_engine_mode_idx
  on public.observer_sites(engine_mode, active);

alter table public.digital_observer_camera_sources
  add column if not exists engine_mode text;

update public.digital_observer_camera_sources c
set engine_mode = s.engine_mode
from public.observer_sites s
where s.id = c.observer_site_id
  and (c.engine_mode is null or c.engine_mode not in ('standard_biometric', 'kindergarten_skeleton'));

alter table public.digital_observer_camera_sources
  drop constraint if exists digital_observer_camera_sources_engine_mode_check;

alter table public.digital_observer_camera_sources
  add constraint digital_observer_camera_sources_engine_mode_check
  check (engine_mode in ('standard_biometric', 'kindergarten_skeleton'));

create or replace function public.enforce_observer_engine_boundary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_engine text;
begin
  select engine_mode into site_engine
  from public.observer_sites
  where id = new.observer_site_id;

  if site_engine is null then
    raise exception 'OBSERVER_SITE_ENGINE_MISSING';
  end if;

  if new.engine_mode is null then
    new.engine_mode := site_engine;
  elsif new.engine_mode <> site_engine then
    raise exception 'OBSERVER_ENGINE_BOUNDARY_VIOLATION';
  end if;

  return new;
end;
$$;

drop trigger if exists digital_observer_camera_engine_boundary on public.digital_observer_camera_sources;
create trigger digital_observer_camera_engine_boundary
before insert or update of observer_site_id, engine_mode
on public.digital_observer_camera_sources
for each row execute function public.enforce_observer_engine_boundary();

comment on column public.observer_sites.engine_mode is
  'Canonical routing mode: kindergarten_skeleton never loads face/biometric processing; standard_biometric is subject to consent and provider controls.';

comment on column public.digital_observer_camera_sources.engine_mode is
  'Inherited from observer_sites and immutable across the camera boundary.';

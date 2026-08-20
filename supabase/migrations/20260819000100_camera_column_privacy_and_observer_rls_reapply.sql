-- Prevent browser roles from selecting camera credentials/private endpoints, even when
-- row-level access to camera readiness metadata is valid. Also reapply the non-recursive
-- Digital Observer membership helpers because older environments may have skipped them.

create or replace function public.can_access_observer_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.observer_sites s
      where s.id = target_site_id
        and (
          s.owner_profile_id = auth.uid()
          or (s.garden_id is not null and public.can_access_garden(s.garden_id))
        )
    )
    or exists (
      select 1
      from public.observer_site_memberships m
      where m.observer_site_id = target_site_id
        and m.profile_id = auth.uid()
        and m.active = true
    )
  )
$$;

create or replace function public.can_manage_observer_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.observer_sites s
      where s.id = target_site_id
        and s.owner_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.observer_site_memberships m
      where m.observer_site_id = target_site_id
        and m.profile_id = auth.uid()
        and m.active = true
        and m.member_role in ('owner', 'admin')
    )
  )
$$;

revoke all on function public.can_access_observer_site(uuid) from public;
revoke all on function public.can_manage_observer_site(uuid) from public;
grant execute on function public.can_access_observer_site(uuid) to authenticated, service_role;
grant execute on function public.can_manage_observer_site(uuid) to authenticated, service_role;

drop policy if exists "observer site memberships own read" on public.observer_site_memberships;
drop policy if exists "observer site memberships scoped read" on public.observer_site_memberships;
create policy "observer site memberships scoped read" on public.observer_site_memberships
for select using (
  profile_id = auth.uid()
  or public.can_manage_observer_site(observer_site_id)
);

drop policy if exists "observer sites membership read" on public.observer_sites;
drop policy if exists "observer sites scoped membership read" on public.observer_sites;
create policy "observer sites scoped membership read" on public.observer_sites
for select using (public.can_access_observer_site(id));

do $$
declare
  safe_columns text;
begin
  if to_regclass('public.camera_streams') is null then
    return;
  end if;

  revoke select on table public.camera_streams from anon, authenticated;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'camera_streams'
    and column_name not in (
      'dvr_host_encrypted',
      'username_encrypted',
      'password_encrypted',
      'connection_username_encrypted',
      'connection_password_encrypted',
      'encrypted_password',
      'secret_ref',
      'source_secret_reference',
      'host',
      'connection_host',
      'source_url',
      'rtsp_template',
      'hls_playback_url',
      'sample_hls_url',
      'webrtc_playback_url'
    );

  if safe_columns is null then
    raise exception 'No safe camera_streams columns were found';
  end if;

  execute format('grant select (%s) on table public.camera_streams to authenticated', safe_columns);
end
$$;

comment on table public.camera_streams is
  'Camera readiness metadata. Credential, private host and playback endpoint columns are server-only through column privileges.';

notify pgrst, 'reload schema';

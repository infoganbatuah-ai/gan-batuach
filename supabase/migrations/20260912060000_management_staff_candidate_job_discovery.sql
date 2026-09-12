-- GB-M17: canonical Staff candidate profile completeness and safe job discovery.
-- This migration does not create employment or accept applications.

alter table public.staff_candidate_profiles
  add column if not exists city text,
  add column if not exists professional_role text,
  add column if not exists qualification_keys text[] not null default '{}',
  add column if not exists availability jsonb not null default '{}'::jsonb,
  add column if not exists preferred_age_groups text[] not null default '{}',
  add column if not exists employment_preference text,
  add column if not exists professional_summary text,
  add column if not exists profile_completeness jsonb not null default '{}'::jsonb,
  add column if not exists matching_paused boolean not null default false;

alter table public.kindergarten_staff_openings
  add column if not exists qualification_keys text[] not null default '{}',
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists closed_at timestamptz;

alter table public.kindergarten_staff_openings drop constraint if exists kindergarten_staff_openings_active_status_check;
alter table public.kindergarten_staff_openings add constraint kindergarten_staff_openings_active_status_check
  check (active_status in ('draft','published','paused','filled','closed'));

create index if not exists staff_candidate_profiles_matching_idx
  on public.staff_candidate_profiles(professional_role, city) where matching_paused=false;
create index if not exists kindergarten_staff_openings_discovery_idx
  on public.kindergarten_staff_openings(active_status, role_needed, created_at desc) where active_status='published';

create or replace function public.evaluate_staff_candidate_profile(target_profile_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate public.staff_candidate_profiles; blockers text[] := '{}'; percent integer := 0; docs_ready boolean;
begin
  if target_profile_id <> auth.uid() and not public.is_admin() then
    raise exception 'staff_candidate_profile_denied' using errcode='42501';
  end if;
  select * into candidate from public.staff_candidate_profiles where profile_id=target_profile_id;
  if candidate.profile_id is null then
    blockers := array_append(blockers, 'professional_profile_missing');
  else
    if nullif(btrim(coalesce(candidate.full_name,'')),'') is null then blockers := array_append(blockers, 'full_name_missing'); else percent := percent + 15; end if;
    if nullif(btrim(coalesce(candidate.city,'')),'') is null then blockers := array_append(blockers, 'city_missing'); else percent := percent + 15; end if;
    if nullif(btrim(coalesce(candidate.professional_role,'')),'') is null then blockers := array_append(blockers, 'professional_role_missing'); else percent := percent + 20; end if;
    if coalesce(array_length(candidate.qualification_keys,1),0)=0 then blockers := array_append(blockers, 'qualification_missing'); else percent := percent + 20; end if;
    if candidate.availability='{}'::jsonb then blockers := array_append(blockers, 'availability_missing'); else percent := percent + 15; end if;
    docs_ready := coalesce((candidate.document_status->>'required_documents_ready')::boolean,false);
    if not docs_ready then blockers := array_append(blockers, 'required_documents_pending'); else percent := percent + 15; end if;
  end if;
  return jsonb_build_object('profile_id',target_profile_id,'percentage',percent,'blockers',to_jsonb(blockers),'required_fields_complete',cardinality(blockers)=0,'status',case when candidate.matching_paused then 'paused' when cardinality(blockers)=0 then 'ready_for_matching' else 'incomplete' end,'documents_ready',docs_ready);
end $$;

create or replace function public.save_staff_candidate_profile(
  target_full_name text, target_city text, target_professional_role text, target_qualification_keys text[],
  target_availability jsonb, target_preferred_age_groups text[], target_employment_preference text,
  target_professional_summary text, target_matching_paused boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare saved public.staff_candidate_profiles; completeness jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  insert into public.staff_candidate_profiles(profile_id,full_name,phone,email,city,professional_role,qualification_keys,availability,preferred_age_groups,employment_preference,professional_summary,matching_paused,status)
  select auth.uid(),p.full_name,p.phone,p.email,nullif(btrim(target_city),''),nullif(btrim(target_professional_role),''),coalesce(target_qualification_keys,'{}'),coalesce(target_availability,'{}'::jsonb),coalesce(target_preferred_age_groups,'{}'),nullif(btrim(target_employment_preference),''),nullif(btrim(target_professional_summary),''),coalesce(target_matching_paused,false),'profile_incomplete'
  from public.profiles p where p.id=auth.uid()
  on conflict(profile_id) do update set full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,city=excluded.city,professional_role=excluded.professional_role,qualification_keys=excluded.qualification_keys,availability=excluded.availability,preferred_age_groups=excluded.preferred_age_groups,employment_preference=excluded.employment_preference,professional_summary=excluded.professional_summary,matching_paused=excluded.matching_paused,updated_at=now()
  returning * into saved;
  completeness := public.evaluate_staff_candidate_profile(auth.uid());
  update public.staff_candidate_profiles set profile_completeness=completeness,status=case when completeness->>'status'='ready_for_matching' then 'active' when completeness->>'status'='paused' then 'pending_affiliation' else 'profile_incomplete' end,updated_at=now() where profile_id=auth.uid() returning * into saved;
  insert into public.audit_logs(actor_id,actor_role,entity_type,entity_id,action,after_data)
  values(auth.uid(),'staff','staff_candidate_profiles',auth.uid(),'staff_candidate_profile_updated',jsonb_build_object('percentage',completeness->>'percentage','status',completeness->>'status'));
  return jsonb_build_object('profile',to_jsonb(saved),'completeness',completeness);
end $$;

create or replace function public.find_relevant_staff_jobs(target_city text default null, target_role text default null, target_age_group text default null, target_query text default null)
returns table(id uuid,garden_id uuid,garden_name text,city text,role_needed text,qualification_keys text[],age_group text,employment_type text,description text,match_level text,match_reasons text[],application_status text,invitation_status text,created_at timestamptz)
language sql security definer set search_path=public as $$
  with candidate as (
    select * from public.staff_candidate_profiles where profile_id=auth.uid()
  ), openings as (
    select o.*, g.name as garden_name, g.city as garden_city
    from public.kindergarten_staff_openings o join public.gardens g on g.id=o.garden_id
    where o.active_status='published'
      and (target_city is null or g.city ilike '%' || target_city || '%')
      and (target_role is null or o.role_needed ilike '%' || target_role || '%')
      and (target_age_group is null or coalesce(o.age_group,'') ilike '%' || target_age_group || '%')
      and (target_query is null or concat_ws(' ',g.name,g.city,o.role_needed,o.description) ilike '%' || target_query || '%')
  )
  select o.id,o.garden_id,o.garden_name,o.garden_city,o.role_needed,o.qualification_keys,o.age_group,o.employment_type,o.description,
    case when coalesce(array_length(o.qualification_keys,1),0)=0 or o.qualification_keys <@ coalesce(c.qualification_keys,'{}') then 'exact_match' when coalesce(array_length(c.qualification_keys,1),0)=0 then 'profile_incomplete' else 'partial_match' end,
    array_remove(array[
      case when coalesce(c.professional_role,'')<>'' and lower(c.professional_role)=lower(o.role_needed) then 'profession_match' end,
      case when coalesce(array_length(o.qualification_keys,1),0)=0 or o.qualification_keys <@ coalesce(c.qualification_keys,'{}') then 'qualification_match' else 'missing_required_qualification' end,
      case when c.city is not null and lower(c.city)=lower(o.garden_city) then 'same_city' end,
      case when o.age_group is not null and o.age_group=any(coalesce(c.preferred_age_groups,'{}')) then 'preferred_age_group' end,
      case when c.city is null then 'location_unavailable' end
    ],null),
    app.status, null::text, o.created_at
  from openings o cross join candidate c
  left join public.staff_job_applications app on app.opening_id=o.id and app.staff_candidate_id=auth.uid() and app.status in ('draft','submitted','under_review','more_information_requested','approved_pending_completion','approved')
  where not c.matching_paused
  order by (coalesce(c.professional_role,'')=o.role_needed and (coalesce(array_length(o.qualification_keys,1),0)=0 or o.qualification_keys <@ coalesce(c.qualification_keys,'{}'))) desc, (c.city=o.garden_city) desc, o.created_at desc, o.id;
$$;

drop policy if exists "staff openings manager write" on public.kindergarten_staff_openings;
create policy "staff openings canonical manager write" on public.kindergarten_staff_openings for all
  using (public.is_admin() or public.can_manage_garden(garden_id))
  with check (public.is_admin() or public.can_manage_garden(garden_id));

revoke all on function public.evaluate_staff_candidate_profile(uuid) from public,anon;
revoke all on function public.save_staff_candidate_profile(text,text,text,text[],jsonb,text[],text,text,boolean) from public,anon;
revoke all on function public.find_relevant_staff_jobs(text,text,text,text) from public,anon;
grant execute on function public.evaluate_staff_candidate_profile(uuid),public.save_staff_candidate_profile(text,text,text,text[],jsonb,text[],text,text,boolean),public.find_relevant_staff_jobs(text,text,text,text) to authenticated;
notify pgrst, 'reload schema';

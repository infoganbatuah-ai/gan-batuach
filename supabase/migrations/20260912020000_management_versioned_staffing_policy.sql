-- GB-M13: versioned, provenance-bearing Classroom staffing policy framework.
-- No regulatory values are inserted or activated by this migration.

create table if not exists public.staffing_policy_sets (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  name text not null,
  jurisdiction text not null default 'IL',
  program_type text,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staffing_policy_key_check check (length(btrim(policy_key)) between 3 and 100)
);

create table if not exists public.staffing_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_set_id uuid not null references public.staffing_policy_sets(id) on delete restrict,
  version integer not null,
  status text not null default 'draft',
  effective_from date,
  effective_until date,
  source_title text,
  source_reference text,
  provenance_status text not null default 'unverified',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  activated_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  retired_by uuid references public.profiles(id) on delete set null,
  retired_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staffing_policy_version_unique unique(policy_set_id,version),
  constraint staffing_policy_version_status_check check(status in ('draft','under_review','approved','active','retired')),
  constraint staffing_policy_provenance_check check(provenance_status in ('unverified','source_recorded','reviewed','approved')),
  constraint staffing_policy_dates_check check(effective_until is null or effective_from is null or effective_until>=effective_from),
  constraint staffing_policy_approval_truth_check check(status not in ('approved','active') or (approved_at is not null and approved_by is not null and provenance_status='approved'))
);

create table if not exists public.staffing_policy_rules (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.staffing_policy_versions(id) on delete cascade,
  rule_key text not null,
  age_group_key text,
  min_age_months integer,
  max_age_months integer,
  child_count_from integer not null default 1,
  child_count_until integer,
  children_per_staff numeric(8,3) not null,
  minimum_staff integer not null default 1,
  staff_qualification_key text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staffing_policy_rule_unique unique(policy_version_id,rule_key),
  constraint staffing_policy_rule_age_check check((min_age_months is null or min_age_months>=0) and (max_age_months is null or max_age_months>=coalesce(min_age_months,0))),
  constraint staffing_policy_rule_count_check check(child_count_from>=0 and (child_count_until is null or child_count_until>=child_count_from)),
  constraint staffing_policy_rule_ratio_check check(children_per_staff>0 and minimum_staff>=0)
);

create index if not exists staffing_policy_versions_resolution_idx on public.staffing_policy_versions(policy_set_id,status,effective_from,effective_until);
create index if not exists staffing_policy_rules_resolution_idx on public.staffing_policy_rules(policy_version_id,age_group_key,min_age_months,max_age_months);

create or replace function public.activate_staffing_policy_version(target_version_id uuid)
returns public.staffing_policy_versions language plpgsql security definer set search_path=public as $$
declare target public.staffing_policy_versions; conflict_count integer;
begin
  if not public.is_admin() then raise exception 'staffing_policy_admin_required' using errcode='42501'; end if;
  select * into target from public.staffing_policy_versions where id=target_version_id for update;
  if target.id is null then raise exception 'staffing_policy_version_not_found' using errcode='P0002'; end if;
  if target.status<>'approved' or target.provenance_status<>'approved' or target.approved_at is null then raise exception 'staffing_policy_approval_required' using errcode='23514'; end if;
  if target.effective_from is null or not exists(select 1 from public.staffing_policy_rules where policy_version_id=target.id) then raise exception 'staffing_policy_effective_rules_required' using errcode='23514'; end if;
  select count(*) into conflict_count from public.staffing_policy_versions v
  where v.policy_set_id=target.policy_set_id and v.id<>target.id and v.status='active'
    and daterange(v.effective_from,coalesce(v.effective_until,'infinity'::date),'[]') && daterange(target.effective_from,coalesce(target.effective_until,'infinity'::date),'[]');
  if conflict_count>0 then raise exception 'staffing_policy_effective_date_conflict' using errcode='23P01'; end if;
  update public.staffing_policy_versions set status='active',activated_by=auth.uid(),activated_at=now(),updated_at=now() where id=target.id returning * into target;
  return target;
end $$;

create or replace function public.retire_staffing_policy_version(target_version_id uuid)
returns public.staffing_policy_versions language plpgsql security definer set search_path=public as $$
declare target public.staffing_policy_versions;
begin
  if not public.is_admin() then raise exception 'staffing_policy_admin_required' using errcode='42501'; end if;
  update public.staffing_policy_versions set status='retired',retired_by=auth.uid(),retired_at=now(),updated_at=now()
  where id=target_version_id and status in ('approved','active') returning * into target;
  if target.id is null then raise exception 'staffing_policy_version_not_retirable' using errcode='P0001'; end if;
  return target;
end $$;

create or replace function public.evaluate_classroom_staffing(target_classroom_id uuid,evaluation_date date default current_date,projected_child_delta integer default 0)
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare room public.classrooms; child_count integer; projected_count integer; qualifying_count integer; shared_count integer;
declare version_count integer; unverified_count integer; rule_count integer; selected_version public.staffing_policy_versions; selected_rule public.staffing_policy_rules; required_count integer; state text;
begin
  select * into room from public.classrooms where id=target_classroom_id and status='active';
  if room.id is null then raise exception 'classroom_not_found' using errcode='P0002'; end if;
  if not public.can_access_garden(room.garden_id) then raise exception 'classroom_staffing_denied' using errcode='42501'; end if;
  select count(*)::integer into child_count from public.child_classroom_assignments a
    left join public.child_kindergarten_enrollments e on e.id=a.enrollment_id
    where a.classroom_id=room.id and a.is_current and (a.enrollment_id is null or e.status='active');
  projected_count:=greatest(child_count+projected_child_delta,0);
  select count(distinct a.staff_id)::integer into qualifying_count
    from public.staff_classroom_assignments a
    join public.staff s on s.id=a.staff_id and s.garden_id=room.garden_id and coalesce(s.approved_to_work,false)
    join public.staff_kindergarten_employments e on e.id=a.employment_id and e.staff_id=s.id and e.garden_id=room.garden_id and e.status='active'
    where a.classroom_id=room.id and a.garden_id=room.garden_id and a.status='active';
  select count(*)::integer into shared_count from (
    select a.staff_id from public.staff_classroom_assignments a
    where a.status='active' and a.staff_id in (select staff_id from public.staff_classroom_assignments where classroom_id=room.id and status='active')
    group by a.staff_id having count(distinct a.classroom_id)>1
  ) shared;
  select count(*)::integer into version_count from public.staffing_policy_versions v join public.staffing_policy_sets p on p.id=v.policy_set_id
    where v.status='active' and v.provenance_status='approved' and p.jurisdiction='IL'
      and (p.program_type is null or p.program_type=coalesce(room.metadata->>'program_type',p.program_type))
      and v.effective_from<=evaluation_date and (v.effective_until is null or v.effective_until>=evaluation_date);
  select count(*)::integer into unverified_count from public.staffing_policy_versions v join public.staffing_policy_sets p on p.id=v.policy_set_id
    where v.status<>'retired' and (v.provenance_status<>'approved' or v.status<>'active') and p.jurisdiction='IL'
      and (v.effective_from is null or v.effective_from<=evaluation_date) and (v.effective_until is null or v.effective_until>=evaluation_date);
  if version_count=0 then
    return jsonb_build_object('status',case when unverified_count>0 then 'policy_unverified' else 'policy_not_configured' end,'classroom_id',room.id,'garden_id',room.garden_id,'evaluation_date',evaluation_date,'child_count',child_count,'projected_child_count',projected_count,'required_staff',null,'qualifying_staff',qualifying_count,'deficit',null,'policy',null,'legal_compliance',null);
  elsif version_count>1 then
    return jsonb_build_object('status','policy_conflict','classroom_id',room.id,'garden_id',room.garden_id,'evaluation_date',evaluation_date,'child_count',child_count,'projected_child_count',projected_count,'required_staff',null,'qualifying_staff',qualifying_count,'deficit',null,'policy',null,'legal_compliance',null);
  end if;
  select v.* into selected_version from public.staffing_policy_versions v join public.staffing_policy_sets p on p.id=v.policy_set_id
    where v.status='active' and v.provenance_status='approved' and p.jurisdiction='IL'
      and (p.program_type is null or p.program_type=coalesce(room.metadata->>'program_type',p.program_type))
      and v.effective_from<=evaluation_date and (v.effective_until is null or v.effective_until>=evaluation_date);
  select count(*)::integer into rule_count from public.staffing_policy_rules r where r.policy_version_id=selected_version.id
    and (r.age_group_key is null or r.age_group_key=room.age_group_key)
    and (r.min_age_months is null or room.min_age_months is null or room.min_age_months>=r.min_age_months)
    and (r.max_age_months is null or room.max_age_months is null or room.max_age_months<=r.max_age_months)
    and projected_count>=r.child_count_from and (r.child_count_until is null or projected_count<=r.child_count_until);
  if rule_count=0 then state:='policy_not_configured';
  elsif rule_count>1 then state:='policy_conflict';
  else
    select * into selected_rule from public.staffing_policy_rules r where r.policy_version_id=selected_version.id
      and (r.age_group_key is null or r.age_group_key=room.age_group_key)
      and (r.min_age_months is null or room.min_age_months is null or room.min_age_months>=r.min_age_months)
      and (r.max_age_months is null or room.max_age_months is null or room.max_age_months<=r.max_age_months)
      and projected_count>=r.child_count_from and (r.child_count_until is null or projected_count<=r.child_count_until);
    required_count:=case when projected_count=0 then 0 else greatest(selected_rule.minimum_staff,ceil(projected_count/selected_rule.children_per_staff)::integer) end;
    state:=case when shared_count>0 then 'staffing_data_incomplete' when qualifying_count<required_count then 'deficit' when qualifying_count=required_count then 'compliant' else 'surplus' end;
  end if;
  return jsonb_build_object('status',state,'classroom_id',room.id,'garden_id',room.garden_id,'evaluation_date',evaluation_date,
    'child_count',child_count,'projected_child_count',projected_count,'required_staff',required_count,'qualifying_staff',qualifying_count,
    'deficit',case when required_count is null then null else greatest(required_count-qualifying_count,0) end,
    'needs_scheduling_validation',shared_count>0,'qualification_basis','active_employment_and_classroom_assignment',
    'policy',jsonb_build_object('policy_version_id',selected_version.id,'version',selected_version.version,'rule_id',selected_rule.id,'rule_key',selected_rule.rule_key,
      'source_title',selected_version.source_title,'source_reference',selected_version.source_reference,'provenance_status',selected_version.provenance_status),
    'legal_compliance',case when state in ('compliant','surplus') then true when state='deficit' then false else null end);
end $$;

alter table public.staffing_policy_sets enable row level security;
alter table public.staffing_policy_versions enable row level security;
alter table public.staffing_policy_rules enable row level security;
create policy "staffing policy authenticated read" on public.staffing_policy_sets for select to authenticated using (true);
create policy "staffing policy version authenticated read" on public.staffing_policy_versions for select to authenticated using (true);
create policy "staffing policy rule authenticated read" on public.staffing_policy_rules for select to authenticated using (true);
create policy "staffing policy admin write" on public.staffing_policy_sets for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "staffing policy version admin write" on public.staffing_policy_versions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "staffing policy rule admin write" on public.staffing_policy_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());

grant select,insert,update on public.staffing_policy_sets,public.staffing_policy_versions,public.staffing_policy_rules to authenticated;
revoke all on function public.activate_staffing_policy_version(uuid) from public,anon,authenticated;
revoke all on function public.retire_staffing_policy_version(uuid) from public,anon,authenticated;
revoke all on function public.evaluate_classroom_staffing(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.activate_staffing_policy_version(uuid) to authenticated;
grant execute on function public.retire_staffing_policy_version(uuid) to authenticated;
grant execute on function public.evaluate_classroom_staffing(uuid,date,integer) to authenticated;

comment on table public.staffing_policy_versions is 'Versioned staffing policy with explicit provenance and review; no version is authoritative until approved and active.';
comment on function public.evaluate_classroom_staffing(uuid,date,integer) is 'Non-mutating current/projected Classroom staffing evaluation with policy provenance and fail-closed conflict handling.';

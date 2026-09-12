-- GB-M14: Child-authorized public Garden discovery. Browsing never creates a seat reservation.

alter table public.gardens
  add column if not exists enrollment_availability text not null default 'accepting';

alter table public.gardens drop constraint if exists gardens_enrollment_availability_check;
alter table public.gardens add constraint gardens_enrollment_availability_check
  check (enrollment_availability in ('accepting','paused','closed','waitlist_only'));

create index if not exists gardens_public_discovery_idx
  on public.gardens(status, public_profile_enabled, enrollment_availability, city, name);

-- Deliberately returns only the public projection below. The caller's child must have
-- an active, legally-authorized canonical guardian link.
create or replace function public.find_child_garden_matches(
  target_child_file_id uuid,
  target_city text default null,
  target_query text default null,
  evaluation_date date default current_date
)
returns table (
  garden_id uuid,
  garden_name text,
  city text,
  public_address text,
  image_url text,
  enrollment_availability text,
  match_status text,
  reason_code text,
  matching_classrooms jsonb,
  available_seats integer,
  price_status text,
  monthly_price numeric,
  pending_request_status text,
  active_enrollment boolean,
  distance_km numeric,
  distance_status text,
  staffing_readiness text
)
language plpgsql security definer stable set search_path=public as $$
declare child_birth_date date; child_months integer;
begin
  if auth.uid() is null then raise exception 'child_discovery_unauthenticated' using errcode='42501'; end if;
  if not exists (
    select 1 from public.child_guardian_links link
    where link.guardian_profile_id=auth.uid() and link.permanent_child_file_id=target_child_file_id
      and link.status='active' and link.legal_authority=true
      and coalesce((link.access_scope->>'profile')::boolean,false)=true
      and (link.valid_until is null or link.valid_until>now())
  ) then raise exception 'child_discovery_denied' using errcode='42501'; end if;

  select birth_date into child_birth_date from public.permanent_child_files where id=target_child_file_id;
  if child_birth_date is null then raise exception 'child_discovery_birth_date_required' using errcode='22023'; end if;
  child_months := extract(year from age(evaluation_date, child_birth_date))::integer * 12
    + extract(month from age(evaluation_date, child_birth_date))::integer;

  return query
  with eligible_gardens as (
    select g.id,g.name,g.city,g.address,g.image_url,g.enrollment_availability
    from public.gardens g
    where g.status='active' and coalesce(g.public_profile_enabled,false)
      and coalesce(g.enrollment_availability,'accepting') in ('accepting','waitlist_only')
      and (target_city is null or btrim(target_city)='' or g.city ilike '%'||btrim(target_city)||'%')
      and (target_query is null or btrim(target_query)='' or g.name ilike '%'||btrim(target_query)||'%')
  ), room_rows as (
    select eg.id as target_garden_id,c.id,c.name,c.age_group_key,c.age_group_label,c.capacity_limit,
      count(a.id) filter (where a.is_current and (a.enrollment_id is null or enrollment.status='active'))::integer as occupied,
      count(res.id) filter (where res.status='active' and (res.expires_at is null or res.expires_at>now())
        and not exists (select 1 from public.child_classroom_assignments own where own.classroom_id=c.id and own.child_id=res.child_id and own.is_current))::integer as reserved
    from eligible_gardens eg join public.classrooms c on c.garden_id=eg.id and c.status='active'
      left join public.child_classroom_assignments a on a.classroom_id=c.id
      left join public.child_kindergarten_enrollments enrollment on enrollment.id=a.enrollment_id
      left join public.classroom_seat_reservations res on res.classroom_id=c.id
    where c.min_age_months is not null and c.max_age_months is not null
      and child_months between c.min_age_months and c.max_age_months
    group by eg.id,c.id,c.name,c.age_group_key,c.age_group_label,c.capacity_limit
  ), matches as (
    select rr.target_garden_id,
      jsonb_agg(jsonb_build_object(
        'id',rr.id,'name',rr.name,'age_group_key',rr.age_group_key,'age_group_label',rr.age_group_label,
        'availability',case when rr.capacity_limit is null then 'not_configured' when greatest(rr.capacity_limit-rr.occupied-rr.reserved,0)=0 then 'full' when greatest(rr.capacity_limit-rr.occupied-rr.reserved,0)<=3 then 'limited' else 'available' end,
        'available_seats',case when rr.capacity_limit is null then null else greatest(rr.capacity_limit-rr.occupied-rr.reserved,0) end
      ) order by rr.name) as rooms,
      case when bool_or(rr.capacity_limit is null) then null else sum(greatest(rr.capacity_limit-rr.occupied-rr.reserved,0))::integer end as seats,
      bool_or(rr.capacity_limit is null or greatest(rr.capacity_limit-rr.occupied-rr.reserved,0)>0) as has_capacity
    from room_rows rr group by rr.target_garden_id
  ), fee as (
    select fg.garden_id,min(fg.monthly_fee) filter (where fg.show_price_public and fg.monthly_fee is not null) as public_price
    from public.kindergarten_fee_groups fg where fg.active=true group by fg.garden_id
  ), request_state as (
    select r.garden_id,max(r.status) as status
    from public.kindergarten_enrollment_requests r
    where r.parent_id=auth.uid() and r.child_profile_id=target_child_file_id
      and r.status in ('draft','submitted','under_review','more_information_requested','approved_pending_payment')
    group by r.garden_id
  ), active_state as (
    select e.garden_id,true as is_active from public.child_kindergarten_enrollments e
    where e.permanent_child_file_id=target_child_file_id and e.status='active'
  )
  select eg.id,eg.name,eg.city,eg.address,eg.image_url,eg.enrollment_availability,
    case when active_state.is_active then 'already_enrolled'
      when request_state.status is not null then 'pending_request'
      when eg.enrollment_availability='waitlist_only' then 'waitlist_only'
      when coalesce(matches.has_capacity,false) then 'eligible'
      else 'full' end,
    case when active_state.is_active then 'active_enrollment'
      when request_state.status is not null then 'pending_request'
      when eg.enrollment_availability='waitlist_only' then 'waitlist_only'
      when matches.target_garden_id is null then 'age_mismatch'
      when not coalesce(matches.has_capacity,false) then 'full' else 'eligible' end,
    coalesce(matches.rooms,'[]'::jsonb),matches.seats,
    case when fee.public_price is null then 'price_not_configured' else 'configured' end,fee.public_price,
    request_state.status,coalesce(active_state.is_active,false),null::numeric,'distance_unavailable',
    'policy_not_configured'
  from eligible_gardens eg
  left join matches on matches.target_garden_id=eg.id
  left join fee on fee.garden_id=eg.id
  left join request_state on request_state.garden_id=eg.id
  left join active_state on active_state.garden_id=eg.id
  order by case when active_state.is_active then 0 when request_state.status is not null then 1 when eg.enrollment_availability='accepting' and coalesce(matches.has_capacity,false) then 2 else 3 end,
    eg.city nulls last,eg.name;
end $$;

revoke all on function public.find_child_garden_matches(uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.find_child_garden_matches(uuid,text,text,date) to authenticated;

comment on function public.find_child_garden_matches(uuid,text,text,date) is
  'GB-M14 authorized Child-specific public Garden matching. It never reserves capacity and emits only whitelisted public fields.';

-- GB-M12: authoritative Classroom capacity and concurrency-safe seat reservations.

alter table public.classrooms
  add column if not exists capacity_limit integer,
  add constraint classrooms_capacity_limit_check check (capacity_limit is null or capacity_limit > 0);

create table if not exists public.classroom_seat_reservations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  child_id uuid references public.children(id) on delete cascade,
  enrollment_id uuid references public.child_kindergarten_enrollments(id) on delete set null,
  enrollment_request_id uuid references public.kindergarten_enrollment_requests(id) on delete set null,
  status text not null default 'active',
  idempotency_key text not null,
  expires_at timestamptz,
  released_at timestamptz,
  consumed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classroom_seat_reservation_status_check check (status in ('active','released','consumed','expired')),
  constraint classroom_seat_reservation_key_check check (length(btrim(idempotency_key)) between 8 and 160),
  constraint classroom_seat_reservation_lifecycle_check check (
    (status='active' and released_at is null and consumed_at is null) or
    (status in ('released','expired') and released_at is not null and consumed_at is null) or
    (status='consumed' and consumed_at is not null)
  ),
  unique(garden_id,idempotency_key)
);

create index if not exists classroom_seat_reservations_active_idx
  on public.classroom_seat_reservations(classroom_id,status,expires_at);
create unique index if not exists classroom_seat_reservations_child_active_unique
  on public.classroom_seat_reservations(child_id,classroom_id) where status='active' and child_id is not null;

create or replace function public.validate_classroom_reservation_scope()
returns trigger language plpgsql set search_path=public as $$
declare room_garden uuid; child_garden uuid; enrollment_garden uuid; request_garden uuid;
begin
  select garden_id into room_garden from public.classrooms where id=new.classroom_id;
  if new.child_id is not null then select garden_id into child_garden from public.children where id=new.child_id; end if;
  if new.enrollment_id is not null then select garden_id into enrollment_garden from public.child_kindergarten_enrollments where id=new.enrollment_id and (new.child_id is null or child_id=new.child_id); end if;
  if new.enrollment_request_id is not null then select garden_id into request_garden from public.kindergarten_enrollment_requests where id=new.enrollment_request_id; end if;
  if room_garden is null or room_garden<>new.garden_id
    or (new.child_id is not null and child_garden is distinct from new.garden_id)
    or (new.enrollment_id is not null and enrollment_garden is distinct from new.garden_id)
    or (new.enrollment_request_id is not null and request_garden is distinct from new.garden_id) then
    raise exception 'cross_garden_seat_reservation' using errcode='42501';
  end if;
  return new;
end $$;

drop trigger if exists validate_classroom_reservation_scope on public.classroom_seat_reservations;
create trigger validate_classroom_reservation_scope before insert or update on public.classroom_seat_reservations
for each row execute function public.validate_classroom_reservation_scope();

create or replace function public.expire_classroom_reservations(target_classroom_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update public.classroom_seat_reservations set status='expired',released_at=now(),updated_at=now()
  where classroom_id=target_classroom_id and status='active' and expires_at is not null and expires_at<=now();
  get diagnostics changed=row_count;
  return changed;
end $$;

create or replace function public.classroom_capacity_status(target_classroom_id uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare room public.classrooms; occupied_count integer; reserved_count integer; available_count integer;
begin
  select * into room from public.classrooms where id=target_classroom_id;
  if room.id is null then raise exception 'classroom_not_found' using errcode='P0002'; end if;
  if not (public.can_access_garden(room.garden_id) or auth.role()='anon') then raise exception 'classroom_capacity_denied' using errcode='42501'; end if;
  select count(*)::integer into occupied_count
  from public.child_classroom_assignments a
  left join public.child_kindergarten_enrollments e on e.id=a.enrollment_id
  where a.classroom_id=room.id and a.is_current and (a.enrollment_id is null or e.status='active');
  select count(*)::integer into reserved_count from public.classroom_seat_reservations r
  where r.classroom_id=room.id and r.status='active' and (r.expires_at is null or r.expires_at>now())
    and not exists (select 1 from public.child_classroom_assignments a where a.classroom_id=room.id and a.child_id=r.child_id and a.is_current);
  available_count:=case when room.capacity_limit is null then null else greatest(room.capacity_limit-occupied_count-reserved_count,0) end;
  return jsonb_build_object('classroom_id',room.id,'garden_id',room.garden_id,'capacity_limit',room.capacity_limit,
    'occupied',occupied_count,'reserved',reserved_count,'available',available_count,
    'over_capacity',room.capacity_limit is not null and occupied_count+reserved_count>room.capacity_limit);
end $$;

create or replace function public.reserve_classroom_seat(target_classroom_id uuid,reservation_key text,target_child_id uuid default null,target_enrollment_id uuid default null,target_enrollment_request_id uuid default null,target_expires_at timestamptz default null)
returns public.classroom_seat_reservations language plpgsql security definer set search_path=public as $$
declare room public.classrooms; existing public.classroom_seat_reservations; result public.classroom_seat_reservations; capacity jsonb;
begin
  if length(btrim(reservation_key))<8 then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  select * into room from public.classrooms where id=target_classroom_id and status='active' for update;
  if room.id is null then raise exception 'classroom_not_found' using errcode='P0002'; end if;
  if not public.can_manage_garden(room.garden_id) then raise exception 'classroom_capacity_denied' using errcode='42501'; end if;
  select * into existing from public.classroom_seat_reservations where garden_id=room.garden_id and idempotency_key=reservation_key;
  if existing.id is not null then return existing; end if;
  perform public.expire_classroom_reservations(room.id);
  capacity:=public.classroom_capacity_status(room.id);
  if room.capacity_limit is not null and (capacity->>'available')::integer<=0 then raise exception 'classroom_capacity_unavailable' using errcode='P0001'; end if;
  insert into public.classroom_seat_reservations(garden_id,classroom_id,child_id,enrollment_id,enrollment_request_id,idempotency_key,expires_at,created_by)
  values(room.garden_id,room.id,target_child_id,target_enrollment_id,target_enrollment_request_id,btrim(reservation_key),target_expires_at,auth.uid()) returning * into result;
  return result;
end $$;

create or replace function public.release_classroom_seat_reservation(target_reservation_id uuid)
returns public.classroom_seat_reservations language plpgsql security definer set search_path=public as $$
declare result public.classroom_seat_reservations;
begin
  select * into result from public.classroom_seat_reservations where id=target_reservation_id for update;
  if result.id is null then raise exception 'reservation_not_found' using errcode='P0002'; end if;
  if not public.can_manage_garden(result.garden_id) then raise exception 'classroom_capacity_denied' using errcode='42501'; end if;
  if result.status='active' then update public.classroom_seat_reservations set status='released',released_at=now(),updated_at=now() where id=result.id returning * into result; end if;
  return result;
end $$;

create or replace function public.consume_classroom_seat_reservation(target_reservation_id uuid)
returns public.classroom_seat_reservations language plpgsql security definer set search_path=public as $$
declare result public.classroom_seat_reservations;
begin
  select * into result from public.classroom_seat_reservations where id=target_reservation_id for update;
  if result.id is null then raise exception 'reservation_not_found' using errcode='P0002'; end if;
  perform 1 from public.classrooms where id=result.classroom_id for update;
  if not public.can_manage_garden(result.garden_id) then raise exception 'classroom_capacity_denied' using errcode='42501'; end if;
  if result.status='consumed' then return result; end if;
  if result.status<>'active' or (result.expires_at is not null and result.expires_at<=now()) then raise exception 'reservation_not_active' using errcode='P0001'; end if;
  update public.classroom_seat_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=result.id returning * into result;
  return result;
end $$;

create or replace function public.assign_child_to_classroom(target_child_id uuid,target_classroom_id uuid,target_enrollment_id uuid default null)
returns public.child_classroom_assignments language plpgsql security definer set search_path=public as $$
declare room public.classrooms; child_garden uuid; result public.child_classroom_assignments; capacity jsonb; own_reservation integer;
begin
  select * into room from public.classrooms where id=target_classroom_id and status='active' for update;
  select garden_id into child_garden from public.children where id=target_child_id;
  if room.id is null or child_garden is distinct from room.garden_id then raise exception 'cross_garden_classroom_assignment' using errcode='42501'; end if;
  if not public.can_manage_garden(room.garden_id) then raise exception 'classroom_assignment_denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_child_id::text,0));
  select * into result from public.child_classroom_assignments where child_id=target_child_id and garden_id=room.garden_id and classroom_id=room.id and is_current limit 1;
  if result.id is not null then return result; end if;
  perform public.expire_classroom_reservations(room.id);
  capacity:=public.classroom_capacity_status(room.id);
  select count(*)::integer into own_reservation from public.classroom_seat_reservations where classroom_id=room.id and child_id=target_child_id and status='active' and (expires_at is null or expires_at>now());
  if room.capacity_limit is not null and (capacity->>'available')::integer+least(own_reservation,1)<=0 then raise exception 'classroom_capacity_unavailable' using errcode='P0001'; end if;
  update public.child_classroom_assignments set is_current=false,ended_at=now(),end_reason='moved' where child_id=target_child_id and garden_id=room.garden_id and is_current;
  insert into public.child_classroom_assignments(garden_id,child_id,enrollment_id,classroom_id,assigned_by) values(room.garden_id,target_child_id,target_enrollment_id,room.id,auth.uid()) returning * into result;
  update public.classroom_seat_reservations set status='consumed',consumed_at=now(),updated_at=now() where classroom_id=room.id and child_id=target_child_id and status='active';
  return result;
end $$;

create or replace function public.public_classroom_availability(target_garden_id uuid,target_age_group_key text default null)
returns table(classroom_id uuid,classroom_name text,age_group_key text,age_group_label text,availability text,available integer)
language sql security definer stable set search_path=public as $$
  select c.id,c.name,c.age_group_key,c.age_group_label,
    case when c.capacity_limit is null then 'not_configured' when (s->>'available')::integer=0 then 'full' when (s->>'available')::integer<=3 then 'limited' else 'available' end,
    case when c.capacity_limit is null then null else (s->>'available')::integer end
  from public.classrooms c join public.gardens g on g.id=c.garden_id
  cross join lateral public.classroom_capacity_status(c.id) s
  where c.garden_id=target_garden_id and c.status='active' and coalesce(g.public_profile_enabled,false)
    and (target_age_group_key is null or c.age_group_key=target_age_group_key)
  order by c.sort_order,c.name
$$;

create or replace function public.public_age_group_availability(target_garden_id uuid)
returns table(age_group_key text,age_group_label text,active_classrooms integer,available integer,availability text)
language sql security definer stable set search_path=public as $$
  select rows.age_group_key,max(rows.age_group_label),count(*)::integer,
    case when bool_or(rows.available is null) then null else sum(rows.available)::integer end,
    case when bool_or(rows.available is null) then 'not_configured' when sum(rows.available)=0 then 'full' when sum(rows.available)<=3 then 'limited' else 'available' end
  from public.public_classroom_availability(target_garden_id,null) rows
  group by rows.age_group_key order by rows.age_group_key
$$;

alter table public.classroom_seat_reservations enable row level security;
create policy "classroom reservations manager read" on public.classroom_seat_reservations for select using (public.can_manage_garden(garden_id));

revoke all on public.classroom_seat_reservations from public,anon,authenticated;
grant select on public.classroom_seat_reservations to authenticated;
revoke all on function public.expire_classroom_reservations(uuid) from public,anon,authenticated;
revoke all on function public.classroom_capacity_status(uuid) from public,anon,authenticated;
revoke all on function public.reserve_classroom_seat(uuid,text,uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.release_classroom_seat_reservation(uuid) from public,anon,authenticated;
revoke all on function public.consume_classroom_seat_reservation(uuid) from public,anon,authenticated;
revoke all on function public.public_classroom_availability(uuid,text) from public,anon,authenticated;
revoke all on function public.public_age_group_availability(uuid) from public,anon,authenticated;
grant execute on function public.classroom_capacity_status(uuid) to authenticated;
grant execute on function public.reserve_classroom_seat(uuid,text,uuid,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.release_classroom_seat_reservation(uuid) to authenticated;
grant execute on function public.consume_classroom_seat_reservation(uuid) to authenticated;
grant execute on function public.public_classroom_availability(uuid,text) to anon,authenticated;
grant execute on function public.public_age_group_availability(uuid) to anon,authenticated;

comment on column public.classrooms.capacity_limit is 'Configured operational capacity; it is not a legal staffing-ratio assertion.';
comment on table public.classroom_seat_reservations is 'Canonical temporary or workflow-backed Classroom seat holds; occupied seats remain derived from active assignments.';

-- Repair a shared trigger's references to table-specific RECORD fields.
-- New migration: the applied historical classroom migration is unchanged.
-- No data rewrite, grant change, disabled trigger or relaxed tenant boundary.
create or replace function public.validate_classroom_assignment_scope()
returns trigger language plpgsql set search_path=public as $$
declare
  room_garden uuid;
  subject_garden uuid;
  relation_garden uuid;
  has_relation boolean := false;
begin
  select garden_id into room_garden from public.classrooms where id=new.classroom_id;
  if tg_table_name='child_classroom_assignments' then
    select garden_id into subject_garden from public.children where id=new.child_id;
    has_relation := new.enrollment_id is not null;
    if has_relation then
      select garden_id into relation_garden from public.child_kindergarten_enrollments
      where id=new.enrollment_id and child_id=new.child_id;
    end if;
  elsif tg_table_name='staff_classroom_assignments' then
    select garden_id into subject_garden from public.staff where id=new.staff_id;
    has_relation := new.employment_id is not null;
    if has_relation then
      select garden_id into relation_garden from public.staff_kindergarten_employments
      where id=new.employment_id and staff_id=new.staff_id and status='active';
    end if;
  else
    raise exception 'unsupported_classroom_assignment_table' using errcode='23514';
  end if;
  if room_garden is null or subject_garden is null
    or room_garden<>new.garden_id or subject_garden<>new.garden_id
    or (has_relation and relation_garden is distinct from new.garden_id) then
    raise exception 'cross_garden_classroom_assignment' using errcode='23514';
  end if;
  return new;
end $$;

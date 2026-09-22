begin;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

-- Garden A manager: own Garden sources are readable; Garden B substitutions
-- are empty under RLS. A report route also performs the explicit scope check.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ begin
  if public.can_manage_garden('00000000-0000-4000-8000-000000000601') is distinct from true then raise exception 'manager_a_scope_missing'; end if;
  if public.can_manage_garden('00000000-0000-4000-8000-000000000602') is true then raise exception 'manager_a_cross_garden_authority'; end if;
  if exists(select 1 from public.attendance where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'attendance_cross_garden_visible'; end if;
  if exists(select 1 from public.tuition_billing_periods where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'tuition_cross_garden_visible'; end if;
  if exists(select 1 from public.kindergarten_subscriptions where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'subscription_cross_garden_visible'; end if;
  if exists(select 1 from public.documents where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'document_cross_garden_visible'; end if;
  if exists(select 1 from public.tasks where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'task_cross_garden_visible'; end if;
  if exists(select 1 from public.complaints where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'complaint_cross_garden_visible'; end if;
end $$;

-- Parent A sees only canonical own-Child report sources.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
  if exists(select 1 from public.attendance where child_id='00000000-0000-4000-8000-000000000802') then raise exception 'parent_cross_child_attendance'; end if;
  if exists(select 1 from public.tuition_billing_periods where child_id='00000000-0000-4000-8000-000000000802') then raise exception 'parent_cross_child_tuition'; end if;
  if exists(select 1 from public.documents where child_id='00000000-0000-4000-8000-000000000802') then raise exception 'parent_cross_child_document'; end if;
end $$;

-- Staff A cannot turn reporting into a Garden B or peer-wage projection.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
do $$ begin
  if exists(select 1 from public.staff_shifts where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'staff_cross_garden_hours'; end if;
  if exists(select 1 from public.staff_time_rates r join public.staff_kindergarten_employments e on e.id=r.employment_id where e.profile_id<>'00000000-0000-4000-8000-000000000301') then raise exception 'staff_peer_rate_visible'; end if;
end $$;

-- Assigned Inspector A sees the assigned Garden only; assignment is not
-- general access to Child documents or payroll-ready rates.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
do $$ begin
  if exists(select 1 from public.inspections where garden_id='00000000-0000-4000-8000-000000000602') then raise exception 'inspector_cross_garden_inspection'; end if;
  if exists(select 1 from public.staff_time_rates) then raise exception 'inspector_rate_visible'; end if;
  if exists(select 1 from public.documents where child_id is not null) then raise exception 'inspector_child_document_visible'; end if;
end $$;

-- Admin analytics remains aggregate-only in the report implementation; the
-- underlying private document policy also denies casual Child-document reads.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
do $$ begin
  if exists(select 1 from public.documents where child_id is not null) then raise exception 'admin_child_document_visible'; end if;
end $$;

reset role;
rollback;

select 'GB_M36_REPORTING_RLS_PASS';

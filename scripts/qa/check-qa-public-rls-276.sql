-- Run only against a disposable LOCAL_SUPABASE database after migration 276.
-- Every synthetic fixture and write is rolled back.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','qa-rls-owner-1@invalid.test'),
 ('10000000-0000-4000-8000-000000000002','qa-rls-owner-2@invalid.test');
insert into public.gardens(id,name,city,status) values
 ('20000000-0000-4000-8000-000000000001','QA RLS Garden A','QA','active'),
 ('20000000-0000-4000-8000-000000000002','QA RLS Garden B','QA','active');
update public.profiles set role='manager', garden_id='20000000-0000-4000-8000-000000000001',active=true where id='10000000-0000-4000-8000-000000000001';
update public.profiles set role='manager', garden_id='20000000-0000-4000-8000-000000000002',active=true where id='10000000-0000-4000-8000-000000000002';
insert into public.garden_management_memberships(profile_id,garden_id,relationship_role,status,activated_at)
values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','manager','active',now()),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','manager','active',now());
insert into public.inspection_forms(id,name) values ('30000000-0000-4000-8000-000000000001','QA RLS Form');
insert into public.inspections(id,garden_id,inspector_id,form_id) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
insert into public.inspection_signatures(inspection_id,signature_image,signed_by) values
 ('40000000-0000-4000-8000-000000000001','synthetic','10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','synthetic','10000000-0000-4000-8000-000000000002');
insert into public.inspection_overrides(inspection_id,garden_id,reason,created_by)
values ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','synthetic','10000000-0000-4000-8000-000000000001');
insert into public.daily_operational_tasks(id,garden_id,title,frequency,role_scope) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','QA A','daily',array['manager']),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','QA B','daily',array['manager']);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.inspection_signatures where inspection_id in
    ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002')) <> 1
    then raise exception 'inspection signature scope failed'; end if;
  if (select count(*) from public.inspection_overrides where reason='synthetic') <> 0
    then raise exception 'override default deny failed'; end if;
  if (select count(*) from public.daily_operational_tasks where id in
    ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002')) <> 1
    then raise exception 'daily task scope failed'; end if;
end $$;
insert into public.gps_verification_logs(user_id,user_role,garden_id,action,gps_lat,gps_lng)
values ('10000000-0000-4000-8000-000000000001','manager','20000000-0000-4000-8000-000000000001','synthetic',0,0);
insert into public.daily_task_completions(operational_task_id,garden_id,completed_by,completed_by_role)
values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','manager');
do $$ begin
  if (select count(*) from public.gps_verification_logs where action='synthetic') <> 1
    then raise exception 'own GPS read failed'; end if;
  if (select count(*) from public.daily_task_completions where operational_task_id='50000000-0000-4000-8000-000000000001') <> 1
    then raise exception 'own completion read failed'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.gps_verification_logs where action='synthetic') <> 0
    then raise exception 'foreign GPS read leaked'; end if;
  if (select count(*) from public.daily_task_completions where operational_task_id='50000000-0000-4000-8000-000000000001') <> 0
    then raise exception 'foreign completion read leaked'; end if;
  if (select count(*) from public.inspection_signatures where inspection_id='40000000-0000-4000-8000-000000000001') <> 0
    then raise exception 'foreign signature leaked'; end if;
  begin
    insert into public.gps_verification_logs(user_id,user_role,garden_id,action,gps_lat,gps_lng)
    values ('10000000-0000-4000-8000-000000000002','manager','20000000-0000-4000-8000-000000000001','foreign',0,0);
    raise exception 'foreign GPS insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.daily_task_completions(operational_task_id,garden_id,completed_by,completed_by_role)
    values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','manager');
    raise exception 'foreign completion insert accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ begin
  if (select count(*) from public.daily_operational_tasks where title like 'QA %') <> 0
    then raise exception 'anonymous task leaked'; end if;
  if (select count(*) from public.inspection_signatures where signature_image='synthetic') <> 0
    then raise exception 'anonymous signature leaked'; end if;
end $$;
select count(*) from public.observer_packages where false;
select count(*) from public.privacy_requests where false;

set local role service_role;
do $$ begin
  if (select count(*) from public.inspection_signatures where signature_image='synthetic') <> 2
    then raise exception 'service role read regressed'; end if;
  if (select count(*) from public.inspection_overrides where reason='synthetic') <> 1
    then raise exception 'service role override regressed'; end if;
end $$;

rollback;

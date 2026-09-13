-- Controlled QA only. All fixture rows and state changes roll back.
begin;
do $probe$
declare qa record; manager_id uuid; other_manager uuid; other_inspector uuid; action_id uuid; result jsonb;
begin
  select g.id as garden_id, g.inspector_id into qa
  from public.gardens g join public.profiles p on p.id=g.inspector_id
  where (p.full_name ilike '%[DEMO]%' or p.full_name ilike '%[QA]%')
    and (g.name ilike '%[DEMO]%' or g.name ilike '%[QA]%')
    and g.status::text='active' and public.is_approved_inspector(p.id)
  order by g.id limit 1;
  if qa.garden_id is null then raise exception 'controlled QA pair unavailable'; end if;
  select m.profile_id into manager_id from public.garden_management_memberships m
  join public.profiles p on p.id=m.profile_id
  where m.garden_id=qa.garden_id and m.status='active' and m.relationship_role in ('owner','manager')
    and p.active and p.role::text in ('owner','manager') limit 1;
  if manager_id is null then raise exception 'controlled QA manager unavailable'; end if;
  insert into public.violations(garden_id,title,description,status,correction_due_at)
    values(qa.garden_id,'[QA] corrective action','rollback-only synthetic fixture','open',now()-interval '1 day') returning id into action_id;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',manager_id::text,true);
  if not public.can_manage_garden(qa.garden_id) then raise exception 'QA manager authority unavailable'; end if;
  result:=public.transition_corrective_action(action_id,'acknowledge');
  if result->>'status'<>'in_progress' then raise exception 'acknowledge failed'; end if;
  result:=public.transition_corrective_action(action_id,'submit','Synthetic correction',jsonb_build_array('inspection-reports/corrective-actions/'||action_id||'/qa.png'));
  if result->>'status'<>'waiting_approval' then raise exception 'submit failed'; end if;
  begin
    perform public.transition_corrective_action(action_id,'accept');
    raise exception 'manager self-closed Inspector action';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',qa.inspector_id::text,true);
  result:=public.transition_corrective_action(action_id,'reject','Needs more work');
  if result->>'status'<>'rejected' then raise exception 'reject failed'; end if;
  perform set_config('request.jwt.claim.sub',manager_id::text,true);
  result:=public.transition_corrective_action(action_id,'progress','Second attempt');
  result:=public.transition_corrective_action(action_id,'submit','Second attempt');
  perform set_config('request.jwt.claim.sub',qa.inspector_id::text,true);
  result:=public.transition_corrective_action(action_id,'accept');
  if result->>'status'<>'done' then raise exception 'accept failed'; end if;
  result:=public.transition_corrective_action(action_id,'accept');
  if result->>'idempotent'<>'true' then raise exception 'accept retry duplicated transition'; end if;
  if (select count(*) from public.corrective_action_events where violation_id=action_id)<>6 then raise exception 'event count mismatch'; end if;
  select id into other_inspector from public.profiles where role::text='inspector' and id<>qa.inspector_id and active limit 1;
  if other_inspector is not null then
    perform set_config('request.jwt.claim.sub',other_inspector::text,true);
    begin
      perform public.transition_corrective_action(action_id,'reopen','QA');
      raise exception 'unassigned Inspector reopened action';
    exception when insufficient_privilege then null;
    end;
  end if;
  select m.profile_id into other_manager from public.garden_management_memberships m
  join public.profiles p on p.id=m.profile_id
  where m.garden_id<>qa.garden_id and m.status='active' and p.active
    and p.role::text in ('owner','manager') and not exists(
      select 1 from public.garden_management_memberships same_garden
      where same_garden.profile_id=m.profile_id and same_garden.garden_id=qa.garden_id and same_garden.status='active')
  limit 1;
  if other_manager is not null then
    perform set_config('request.jwt.claim.sub',other_manager::text,true);
    begin
      perform public.transition_corrective_action(action_id,'reopen','cross-garden QA');
      raise exception 'unrelated manager accessed action';
    exception when insufficient_privilege then null;
    end;
  end if;
  perform set_config('request.jwt.claim.sub',manager_id::text,true);
  begin
    perform public.parent_corrective_action_summary(qa.garden_id);
    raise exception 'non-parent obtained Parent projection';
  exception when insufficient_privilege then null;
  end;
  if has_table_privilege('authenticated','public.violations','UPDATE') then raise exception 'direct violation update remains granted'; end if;
  if has_table_privilege('authenticated','public.corrective_action_events','INSERT') then raise exception 'direct event insert remains granted'; end if;
end $probe$;
rollback;

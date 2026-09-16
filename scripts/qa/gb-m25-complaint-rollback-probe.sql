-- GB-M25 controlled QA only. Apply migration first. All test writes roll back.
begin;
do $probe$
declare parent_user uuid; qa_garden uuid; qa_child uuid; wrong_garden uuid; wrong_child uuid; admin_user uuid; c public.complaints%rowtype;
  second public.complaints%rowtype; policy public.complaint_sla_policies%rowtype; key uuid:=gen_random_uuid(); task_count integer; reply jsonb;
begin
  select coalesce(p.profile_id,p.user_id),e.garden_id,e.child_id into parent_user,qa_garden,qa_child
    from public.child_kindergarten_enrollments e join public.gardens g on g.id=e.garden_id
    join public.children ch on ch.id=e.child_id join public.parents p on p.id=ch.primary_parent_id
    join public.profiles pr on pr.id=coalesce(p.profile_id,p.user_id)
    where e.status='active' and g.status='active' and pr.active and pr.role='parent'
      and (g.name ilike '%[QA]%' or g.name ilike '%[DEMO]%') limit 1;
  if parent_user is null then raise exception 'QA parent missing'; end if;
  select id into wrong_garden from public.gardens where id<>qa_garden and status='active' limit 1;
  select ch.id into wrong_child from public.children ch join public.parents p on p.id=ch.primary_parent_id
    where coalesce(p.profile_id,p.user_id)<>parent_user and ch.garden_id=qa_garden limit 1;
  select id into admin_user from public.profiles where role='admin' and active limit 1;
  if admin_user is null then raise exception 'QA admin missing'; end if;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',parent_user::text,true);
  if not public.can_report_complaint(qa_garden,qa_child) then raise exception 'valid parent denied'; end if;
  reply:=public.submit_management_complaint(qa_garden,qa_child,'[QA] complaint','Rollback-only complaint test','general','medium',key); select * into c from public.complaints where id=(reply->>'id')::uuid;
  reply:=public.submit_management_complaint(qa_garden,qa_child,'[QA] complaint','Rollback-only complaint test','general','medium',key); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if c.id<>second.id or c.reporter_user_id<>parent_user then raise exception 'idempotency failed'; end if;
  select count(*) into task_count from public.tasks where source_entity_type='complaint' and source_entity_id=c.id;
  if task_count<>1 then raise exception 'source task count %',task_count; end if;
  begin
    perform public.submit_management_complaint(wrong_garden,qa_child,'[QA] wrong garden','Rollback-only complaint test','general','medium',gen_random_uuid());
    raise exception 'wrong garden accepted';
  exception when insufficient_privilege then null;
  end;
  if wrong_child is not null then
    begin
      perform public.submit_management_complaint(qa_garden,wrong_child,'[QA] wrong child','Rollback-only complaint test','general','medium',gen_random_uuid());
      raise exception 'wrong child accepted';
    exception when insufficient_privilege then null;
    end;
  end if;
  perform set_config('request.jwt.claim.sub',admin_user::text,true);
  policy:=public.create_complaint_sla_draft('general','medium',60,120,1440,now()-interval '1 minute',null,'[QA] rollback only product test');
  policy:=public.transition_complaint_sla_policy(policy.id,'activate');
  declare duplicate_policy public.complaint_sla_policies%rowtype;
  begin
    duplicate_policy:=public.create_complaint_sla_draft('general','medium',60,120,1440,now()-interval '1 minute',null,'[QA] conflicting test');
    begin
      perform public.transition_complaint_sla_policy(duplicate_policy.id,'activate');
      raise exception 'overlapping policy activated';
    exception when unique_violation then null;
    end;
  end;
  perform set_config('request.jwt.claim.sub',parent_user::text,true);
  reply:=public.submit_management_complaint(qa_garden,qa_child,'[QA] SLA complaint','Rollback-only complaint test','general','medium',gen_random_uuid()); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.sla_policy_id<>policy.id or second.acknowledgement_due_at is null or second.resolution_due_at is null then raise exception 'SLA calculation failed'; end if;
  perform set_config('request.jwt.claim.sub',admin_user::text,true);
  reply:=public.transition_management_complaint(second.id,'acknowledge'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.status<>'assigned' or second.acknowledged_at is null then raise exception 'acknowledgement failed'; end if;
  reply:=public.transition_management_complaint(second.id,'review'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  reply:=public.transition_management_complaint(second.id,'request_reporter','[QA] additional information'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.status<>'waiting_reporter' then raise exception 'information request failed'; end if;
  perform set_config('request.jwt.claim.sub',parent_user::text,true);
  reply:=public.transition_management_complaint(second.id,'reporter_reply','[QA] response'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.status<>'in_progress' then raise exception 'reporter response failed'; end if;
  perform set_config('request.jwt.claim.sub',admin_user::text,true);
  reply:=public.transition_management_complaint(second.id,'resolve','[QA] resolved'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.status<>'resolved' then raise exception 'resolution failed'; end if;
  perform set_config('request.jwt.claim.sub',parent_user::text,true);
  reply:=public.transition_management_complaint(second.id,'reopen','[QA] reopen reason'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.status<>'reopened' or second.resolution_public is not null then raise exception 'reopen failed'; end if;
  perform set_config('request.jwt.claim.sub',admin_user::text,true);
  reply:=public.transition_management_complaint(second.id,'escalate'); select * into second from public.complaints where id=(reply->>'id')::uuid;
  if second.status<>'escalated' then raise exception 'escalation failed'; end if;
  if has_column_privilege('authenticated','public.complaints','internal_notes','select')
     or has_column_privilege('authenticated','public.complaints','attachment_urls','select') then raise exception 'private fields readable'; end if;
  if (select status from public.complaints where id=c.id)<>'new' then raise exception 'unrelated complaint changed'; end if;
end $probe$;
rollback;

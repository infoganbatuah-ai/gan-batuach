-- Controlled QA-only rollback probe. Run on a migrated database; never commit fixture rows.
begin;
do $probe$
declare qa record; other_id uuid; v_form_id uuid; v_inspection_id uuid; v_answers jsonb; v_result jsonb; v_retry jsonb; v_draft jsonb;
begin
  select g.id as garden_id,g.gps_lat,g.gps_lng,p.id as inspector_id into qa
  from public.gardens g join public.profiles p on p.id=g.inspector_id
  where (p.full_name ilike '%[DEMO]%' or p.full_name ilike '%[QA]%')
    and (g.name ilike '%[DEMO]%' or g.name ilike '%[QA]%')
    and g.status::text='active' and public.is_approved_inspector(p.id)
  order by g.id limit 1;
  if qa.garden_id is null then raise exception 'controlled QA pair unavailable'; end if;
  select id into v_form_id from public.inspection_forms where active=true order by created_at desc limit 1;
  if v_form_id is null then raise exception 'QA template unavailable'; end if;
  insert into public.inspections(garden_id,inspector_id,form_id,status,period_month,due_at)
  values(qa.garden_id,qa.inspector_id,v_form_id,'open','2099-01-01','2099-01-31') returning id into v_inspection_id;
  select jsonb_agg(jsonb_build_object('question_id',q.id,'score',9,'boolean_value',true,'text_value','QA',
    'note','QA','photo_url','inspection-reports/inspections/'||v_inspection_id||'/qa.png',
    'document_url','inspection-reports/inspections/'||v_inspection_id||'/qa.pdf')) into v_answers
  from public.inspection_form_questions q where q.form_id=v_form_id;
  if v_answers is null then raise exception 'QA template has no questions'; end if;
  perform set_config('request.jwt.claim.sub',qa.inspector_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  v_result:=public.save_monthly_inspection_draft(v_inspection_id,v_answers);
  v_draft:=public.get_monthly_inspection_draft(v_inspection_id);
  if jsonb_array_length(v_draft->'answers')<>jsonb_array_length(v_answers) then raise exception 'draft/resume mismatch'; end if;
  v_result:=public.complete_monthly_inspection(v_inspection_id,v_answers,
    coalesce(qa.gps_lat,0),coalesce(qa.gps_lng,0),120,'data:image/png;base64,AAAA');
  v_retry:=public.complete_monthly_inspection(v_inspection_id,v_answers,
    coalesce(qa.gps_lat,0),coalesce(qa.gps_lng,0),120,'data:image/png;base64,AAAA');
  if v_result<>v_retry then raise exception 'submit retry mismatch'; end if;
  if (select count(*) from public.inspection_signatures where inspection_id=v_inspection_id)<>1 then raise exception 'duplicate signature'; end if;
  if (select status::text from public.inspections where id=v_inspection_id)<>'done' then raise exception 'submit did not complete'; end if;
  select p.id into other_id from public.profiles p where p.role::text='inspector' and p.id<>qa.inspector_id and p.active limit 1;
  if other_id is not null then
    perform set_config('request.jwt.claim.sub',other_id::text,true);
    begin
      perform public.get_monthly_inspection_draft(v_inspection_id);
      raise exception 'cross-inspector access was accepted';
    exception when insufficient_privilege then null;
    end;
  end if;
end $probe$;
do $policy$
begin
  if has_function_privilege('authenticated','public.submit_inspection_with_answers(uuid,jsonb,numeric,numeric,numeric)','EXECUTE') then
    raise exception 'legacy scorer remains directly executable';
  end if;
  if has_table_privilege('authenticated','public.inspection_drafts','SELECT') then
    raise exception 'private draft table is directly readable';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='required_inspections'
    and policyname='management required inspections scoped read') then
    raise exception 'required inspection read policy missing';
  end if;
end $policy$;
rollback;

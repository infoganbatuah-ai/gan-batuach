-- GB-M22: keep the existing scoring engine, but make submission, evidence metadata,
-- period completion and authorization one database transaction.
-- ci: destructive-reviewed: only the transient saved draft is removed after a completed report is committed; historical inspections and answers remain.

create table if not exists public.inspection_product_settings (
  id boolean primary key default true check (id),
  attention_score_below numeric(4,2) not null default 8 check (attention_score_below between 0 and 10),
  updated_at timestamptz not null default now()
);
insert into public.inspection_product_settings(id,attention_score_below) values(true,8) on conflict(id) do nothing;
alter table public.inspection_product_settings enable row level security;
revoke all on public.inspection_product_settings from anon,authenticated;
grant select,update on public.inspection_product_settings to authenticated;
create policy "inspection product settings read" on public.inspection_product_settings for select using (auth.uid() is not null);
create policy "inspection product settings admin update" on public.inspection_product_settings for update using (public.is_admin()) with check (public.is_admin());
create or replace function public.inspection_attention_threshold() returns numeric
language sql stable security definer set search_path=public as $$
  select attention_score_below from public.inspection_product_settings where id=true
$$;

alter table public.inspections
  add column if not exists template_snapshot jsonb,
  add column if not exists report_snapshot jsonb;

create or replace function public.guard_used_inspection_question()
returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.inspections where form_id=old.form_id) then
    raise exception 'inspection_template_version_in_use' using errcode='23514';
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists management_inspection_question_version_guard on public.inspection_form_questions;
create trigger management_inspection_question_version_guard before update or delete on public.inspection_form_questions
for each row execute function public.guard_used_inspection_question();
create or replace function public.guard_used_inspection_form_insert()
returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.inspections where form_id=new.form_id) then
    raise exception 'inspection_template_version_in_use' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists management_inspection_question_insert_guard on public.inspection_form_questions;
create trigger management_inspection_question_insert_guard before insert on public.inspection_form_questions
for each row execute function public.guard_used_inspection_form_insert();

create table if not exists public.inspection_drafts (
  inspection_id uuid primary key references public.inspections(id) on delete cascade,
  inspector_id uuid not null references public.profiles(id),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.inspection_drafts enable row level security;
revoke all on public.inspection_drafts from anon, authenticated;

drop policy if exists "inspections inspector admin write" on public.inspections;
create policy "management inspections admin insert" on public.inspections for insert with check (public.is_admin());
create policy "management inspections admin update" on public.inspections for update using (public.is_admin()) with check (public.is_admin());
create policy "management inspections admin delete" on public.inspections for delete using (public.is_admin());
drop policy if exists "inspections scoped read" on public.inspections;
create policy "management inspection scoped read" on public.inspections for select using
  (public.is_admin() or public.can_manage_garden(garden_id) or
   (inspector_id=auth.uid() and public.can_inspector_access_garden(garden_id)));
drop policy if exists "inspection answers inspector write" on public.inspection_answers;
create policy "management inspection answers admin insert" on public.inspection_answers for insert with check (public.is_admin());
create policy "management inspection answers admin update" on public.inspection_answers for update using (public.is_admin()) with check (public.is_admin());
create policy "management inspection answers admin delete" on public.inspection_answers for delete using (public.is_admin());
drop policy if exists "inspection answers scoped read" on public.inspection_answers;
create policy "management inspection answers scoped read" on public.inspection_answers for select using
  (exists(select 1 from public.inspections i where i.id=inspection_id and
    (public.is_admin() or public.can_manage_garden(i.garden_id) or
     (i.inspector_id=auth.uid() and public.can_inspector_access_garden(i.garden_id)))));
create policy "management inspection signatures scoped read" on public.inspection_signatures for select using
  (exists(select 1 from public.inspections i where i.id=inspection_id and
    (public.is_admin() or public.can_manage_garden(i.garden_id) or
     (i.inspector_id=auth.uid() and public.can_inspector_access_garden(i.garden_id)))));
drop policy if exists "inspection gps validations scoped read" on public.inspection_gps_validations;
create policy "management inspection gps scoped read" on public.inspection_gps_validations for select using
  (public.is_admin() or public.can_manage_garden(garden_id) or
   (inspector_id=auth.uid() and public.can_inspector_access_garden(garden_id)));
drop policy if exists "inspection gps validations admin inspector insert" on public.inspection_gps_validations;
create policy "management inspection gps admin insert" on public.inspection_gps_validations for insert with check (public.is_admin());
create policy "management required inspections scoped read" on public.required_inspections for select using
  (public.is_admin() or public.can_manage_garden(garden_id) or
   (inspector_id=auth.uid() and public.can_inspector_access_garden(garden_id)));
drop policy if exists "monthly inspection cycles scoped read" on public.monthly_inspection_cycles;
drop policy if exists "monthly inspection cycles scoped write" on public.monthly_inspection_cycles;
create policy "management monthly cycles scoped read" on public.monthly_inspection_cycles for select using
  (public.is_admin() or public.can_manage_garden(garden_id) or
   (inspector_id=auth.uid() and public.can_inspector_access_garden(garden_id)));
create policy "management monthly cycles admin insert" on public.monthly_inspection_cycles for insert with check (public.is_admin());
create policy "management monthly cycles admin update" on public.monthly_inspection_cycles for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.save_monthly_inspection_draft(p_inspection_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.inspections%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into i from public.inspections where id=p_inspection_id for update;
  if i.id is null or not public.can_inspector_access_garden(i.garden_id) or i.inspector_id<>auth.uid() then
    raise exception 'inspection_not_authorized' using errcode='42501';
  end if;
  if i.status::text not in ('open','in_progress') or i.completed_at is not null then
    raise exception 'inspection_locked' using errcode='23514';
  end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'answers_must_be_array' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_answers) a where not exists(
    select 1 from public.inspection_form_questions q where q.id=(a->>'question_id')::uuid and q.form_id=i.form_id
  )) then raise exception 'question_not_in_template' using errcode='23514'; end if;
  insert into public.inspection_drafts(inspection_id,inspector_id,answers)
  values(i.id,auth.uid(),p_answers)
  on conflict(inspection_id) do update set answers=excluded.answers,updated_at=now();
  update public.inspections set status='in_progress',started_at=coalesce(started_at,now()),
    template_snapshot=coalesce(template_snapshot,(select jsonb_build_object('form_id',i.form_id,'questions',coalesce(jsonb_agg(to_jsonb(q) order by q.sort_order),'[]'::jsonb)) from public.inspection_form_questions q where q.form_id=i.form_id)),
    updated_at=now() where id=i.id;
  return jsonb_build_object('inspection_id',i.id,'status','in_progress');
end $$;

create or replace function public.get_monthly_inspection_draft(p_inspection_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare i public.inspections%rowtype; d jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into i from public.inspections where id=p_inspection_id;
  if i.id is null or i.inspector_id<>auth.uid() or not public.can_inspector_access_garden(i.garden_id) then
    raise exception 'inspection_not_authorized' using errcode='42501';
  end if;
  select answers into d from public.inspection_drafts where inspection_id=i.id;
  return jsonb_build_object('inspection_id',i.id,'answers',coalesce(d,'[]'::jsonb),'status',i.status);
end $$;

create or replace function public.complete_monthly_inspection(
  p_inspection_id uuid,p_answers jsonb,p_gps_lat numeric,p_gps_lng numeric,
  p_gps_radius_meters numeric,p_signature_image text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.inspections%rowtype; g public.gardens%rowtype; result jsonb; signed_time timestamptz:=now();
declare document_number text; distance numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into i from public.inspections where id=p_inspection_id for update;
  if i.id is null or i.inspector_id<>auth.uid() or not public.can_inspector_access_garden(i.garden_id) then
    raise exception 'inspection_not_authorized' using errcode='42501';
  end if;
  if i.status::text='done' and i.report_snapshot is not null then return i.report_snapshot; end if;
  if i.status::text not in ('open','in_progress') or i.completed_at is not null then
    raise exception 'inspection_locked' using errcode='23514';
  end if;
  select * into g from public.gardens where id=i.garden_id;
  if g.status::text<>'active' then raise exception 'garden_not_active' using errcode='23514'; end if;
  if i.period_month is null or i.period_month<>date_trunc('month',i.period_month)::date then
    raise exception 'inspection_period_invalid' using errcode='23514';
  end if;
  if p_signature_image is null or length(p_signature_image)>1000000 or
     p_signature_image !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' then
    raise exception 'signature_png_required' using errcode='23514';
  end if;
  if p_gps_lat not between -90 and 90 or p_gps_lng not between -180 and 180 then raise exception 'gps_invalid' using errcode='23514'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'answers_must_be_array' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_answers) a where
    (a ? 'photo_url' and coalesce(a->>'photo_url','') !~ '^inspection-reports/[A-Za-z0-9/_\\.-]+$') or
    (a ? 'document_url' and coalesce(a->>'document_url','') !~ '^inspection-reports/[A-Za-z0-9/_\\.-]+$')) then
    raise exception 'inspection_evidence_must_be_private' using errcode='23514';
  end if;
  -- The legacy scorer writes answers, findings, task and score in this same transaction.
  result:=public.submit_inspection_with_answers(p_inspection_id,p_answers,p_gps_lat,p_gps_lng,p_gps_radius_meters);
  document_number:='GB-INS-'||to_char(i.period_month,'YYYYMM')||'-'||upper(left(i.id::text,8));
  distance:=case when g.gps_lat is not null and g.gps_lng is not null then
    public.distance_meters(g.gps_lat,g.gps_lng,p_gps_lat,p_gps_lng) else null end;
  insert into public.inspection_signatures(inspection_id,signature_image,signed_by,gps_lat,gps_lng,gps_distance_meters,
    inspector_details,kindergarten_details,result_snapshot)
  values(i.id,p_signature_image,auth.uid(),p_gps_lat,p_gps_lng,distance,
    jsonb_build_object('id',auth.uid()),jsonb_build_object('id',g.id,'name',g.name),result);
  insert into public.inspection_gps_validations(inspection_id,garden_id,inspector_id,arrived_at,departed_at,
    gps_lat,gps_lng,garden_lat,garden_lng,distance_meters,validation_result,consistency_status,metadata)
  values(i.id,g.id,auth.uid(),coalesce(i.started_at,i.created_at),signed_time,p_gps_lat,p_gps_lng,g.gps_lat,g.gps_lng,distance,
    case when distance is null then 'pending' when distance<=p_gps_radius_meters then 'valid' else 'suspicious' end,
    case when distance is null then 'requires_review' when distance<=p_gps_radius_meters then 'consistent' else 'inconsistent' end,
    jsonb_build_object('source','browser_capture','not_independent_proof',true));
  update public.inspections set signature_image=p_signature_image,signed_at=signed_time,signed_by=auth.uid(),
    performed_by_user=auth.uid(),performed_by_role='inspector',regulatory_document_number=document_number,
    regulatory_locked_at=signed_time,regulatory_locked_by=auth.uid(),
    template_snapshot=coalesce(template_snapshot,(select jsonb_build_object('form_id',i.form_id,'questions',coalesce(jsonb_agg(to_jsonb(q) order by q.sort_order),'[]'::jsonb)) from public.inspection_form_questions q where q.form_id=i.form_id)),
    report_snapshot=result||jsonb_build_object('document_number',document_number,'period_month',i.period_month),updated_at=now()
  where id=i.id;
  update public.monthly_inspection_cycles set completion_status='completed',completed_inspection_id=i.id,
    completed_at=signed_time,updated_at=signed_time where garden_id=i.garden_id and cycle_month=i.period_month;
  update public.required_inspections set status='done',inspection_id=i.id,readiness_status='ready',updated_at=signed_time
    where garden_id=i.garden_id and monthly_cycle_date=i.period_month and status<>'done';
  delete from public.inspection_drafts where inspection_id=i.id;
  insert into public.regulatory_audit_events(actor_profile_id,actor_role,garden_id,inspection_id,event_type,event_title,event_details)
  values(auth.uid(),'inspector',g.id,i.id,'inspection_submitted_and_locked','דוח ביקורת נחתם וננעל',
    jsonb_build_object('document_number',document_number,'gps_captured',true));
  return result||jsonb_build_object('document_number',document_number,'period_month',i.period_month);
end $$;

revoke all on function public.submit_inspection_with_answers(uuid,jsonb,numeric,numeric,numeric) from public,anon,authenticated;
revoke all on function public.save_monthly_inspection_draft(uuid,jsonb),
  public.get_monthly_inspection_draft(uuid),
  public.complete_monthly_inspection(uuid,jsonb,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.save_monthly_inspection_draft(uuid,jsonb),
  public.get_monthly_inspection_draft(uuid),
  public.complete_monthly_inspection(uuid,jsonb,numeric,numeric,numeric,text) to authenticated;

create or replace function public.schedule_management_monthly_inspections(p_month date)
returns integer language plpgsql security definer set search_path=public as $$
declare g record; v_form_id uuid; task_id uuid; inspection_id uuid; required_id uuid; period_start date;
declare due_date timestamptz; count_created integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'scheduler_only' using errcode='42501'; end if;
  period_start:=date_trunc('month',coalesce(p_month,current_date))::date;
  due_date:=(period_start+interval '1 month'-interval '1 second')::timestamptz;
  select id into v_form_id from public.inspection_forms where active=true order by created_at desc,id desc limit 1;
  if v_form_id is null then raise exception 'inspection_template_missing' using errcode='23514'; end if;
  for g in select id,name,inspector_id from public.gardens
    where status::text='active' and inspector_id is not null and public.is_approved_inspector(inspector_id)
  loop
    perform pg_advisory_xact_lock(hashtextextended(g.id::text||period_start::text,0));
    select id into task_id from public.tasks where garden_id=g.id and task_type='monthly_inspection' and period_month=period_start
      order by created_at,id limit 1;
    if task_id is null then
      insert into public.tasks(garden_id,title,description,assigned_to,due_at,task_type,period_month,status)
      values(g.id,'ביקורת חודשית - '||to_char(period_start,'MM/YYYY'),'ביקורת חודשית לגן '||g.name,
        g.inspector_id,due_date,'monthly_inspection',period_start,'open') returning id into task_id;
    end if;
    insert into public.inspections(garden_id,inspector_id,form_id,task_id,period_month,due_at,status,template_snapshot)
    values(g.id,g.inspector_id,v_form_id,task_id,period_start,due_date,'open',
      (select jsonb_build_object('form_id',v_form_id,'questions',coalesce(jsonb_agg(to_jsonb(q) order by q.sort_order),'[]'::jsonb))
       from public.inspection_form_questions q where q.form_id=v_form_id))
    on conflict (garden_id,period_month) where period_month is not null do nothing;
    if found then count_created:=count_created+1; end if;
    select id into inspection_id from public.inspections where garden_id=g.id and period_month=period_start;
    update public.tasks set source_entity_type='inspection',source_entity_id=inspection_id where id=task_id and source_entity_id is null;
    select id into required_id from public.required_inspections where garden_id=g.id and monthly_cycle_date=period_start and inspection_type='monthly'
      order by created_at,id limit 1;
    if required_id is null then
      insert into public.required_inspections(garden_id,inspector_id,inspection_id,due_at,status,inspection_type,monthly_cycle_date,readiness_status)
      values(g.id,g.inspector_id,inspection_id,due_date,'required','monthly',period_start,'ready') returning id into required_id;
    end if;
    insert into public.monthly_inspection_cycles(garden_id,inspector_id,cycle_month,due_at,required_inspection_id,completed_inspection_id,completion_status,readiness_status)
    values(g.id,g.inspector_id,period_start,due_date::date,required_id,
      case when exists(select 1 from public.inspections where id=inspection_id and status::text='done') then inspection_id else null end,
      case when exists(select 1 from public.inspections where id=inspection_id and status::text='done') then 'completed' else 'pending' end,'ready')
    on conflict(garden_id,cycle_month) do nothing;
  end loop;
  return count_created;
end $$;
revoke all on function public.create_monthly_inspection_tasks(date) from public,anon,authenticated;
revoke all on function public.sync_monthly_inspection_cycles(date) from public,anon,authenticated;
revoke all on function public.schedule_management_monthly_inspections(date) from public,anon,authenticated;
grant execute on function public.schedule_management_monthly_inspections(date) to service_role;

-- Preserve the original weighted scoring and findings semantics; only the product
-- attention threshold is now configured in data rather than fixed in source.
create or replace function public.submit_inspection_with_answers(
  p_inspection_id uuid,
  p_answers jsonb,
  p_gps_lat numeric,
  p_gps_lng numeric,
  p_gps_radius_meters numeric default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inspection_record record;
  answer jsonb;
  question_record record;
  score_value integer;
  effective_score integer;
  bool_value boolean;
  total_weight numeric := 0;
  weighted_sum numeric := 0;
  weighted_average numeric := 0;
  violation_total integer := 0;
  critical_total integer := 0;
  distance numeric;
  task_id_created uuid;
  violation_id_created uuid;
begin
  select i.*, g.gps_lat as garden_lat, g.gps_lng as garden_lng, g.name as garden_name
  into inspection_record
  from public.inspections i
  join public.gardens g on g.id = i.garden_id
  where i.id = p_inspection_id
  for update;

  if inspection_record.id is null then
    raise exception 'Inspection not found';
  end if;

  if inspection_record.gps_exception_approved_by is null then
    if inspection_record.garden_lat is not null and inspection_record.garden_lng is not null then
      distance := public.distance_meters(inspection_record.garden_lat, inspection_record.garden_lng, p_gps_lat, p_gps_lng);
    end if;
    if distance > p_gps_radius_meters then
      raise exception 'GPS verification failed. Distance: % meters', round(distance, 2);
    end if;
  end if;

  if exists (
    select 1
    from public.inspection_form_questions q
    where q.form_id = inspection_record.form_id
      and q.required = true
      and not exists (
        select 1
        from jsonb_array_elements(p_answers) submitted
        where (submitted->>'question_id')::uuid = q.id
      )
  ) then
    raise exception 'All required inspection questions must be answered';
  end if;

  delete from public.inspection_answers where inspection_id = p_inspection_id;

  for answer in select * from jsonb_array_elements(p_answers)
  loop
    select *
    into question_record
    from public.inspection_form_questions
    where id = (answer->>'question_id')::uuid
      and form_id = inspection_record.form_id;

    if question_record.id is null then
      raise exception 'Question does not belong to inspection form';
    end if;

    score_value := nullif(answer->>'score', '')::integer;
    bool_value := case when answer ? 'boolean_value' then (answer->>'boolean_value')::boolean else null end;

    if question_record.question_type = 'score_1_10' then
      if score_value is null or score_value < question_record.min_score or score_value > question_record.max_score then
        raise exception 'Score must be between % and %', question_record.min_score, question_record.max_score;
      end if;
      effective_score := score_value;
    elsif question_record.question_type = 'boolean' then
      if bool_value is null then
        raise exception 'Boolean answer is required';
      end if;
      effective_score := case when bool_value then 10 else 1 end;
      score_value := effective_score;
    elsif question_record.question_type = 'photo_upload' then
      if question_record.required and coalesce(answer->>'photo_url', '') = '' then
        raise exception 'Photo upload is required';
      end if;
      effective_score := coalesce(score_value, 10);
    elsif question_record.question_type = 'document_upload' then
      if question_record.required and coalesce(answer->>'document_url', '') = '' then
        raise exception 'Document upload is required';
      end if;
      effective_score := coalesce(score_value, 10);
    else
      if question_record.required and coalesce(answer->>'note', answer->>'text_value', '') = '' then
        raise exception 'Text note is required';
      end if;
      effective_score := coalesce(score_value, 10);
    end if;

    if effective_score < 1 or effective_score > 10 then
      raise exception 'Effective score must be between 1 and 10';
    end if;

    if question_record.requires_note and coalesce(answer->>'note', answer->>'text_value', '') = '' then
      raise exception 'Question requires a note';
    end if;

    if question_record.requires_photo and coalesce(answer->>'photo_url', '') = '' then
      raise exception 'Question requires a photo';
    end if;

    if question_record.requires_document and coalesce(answer->>'document_url', '') = '' then
      raise exception 'Question requires a document';
    end if;

    insert into public.inspection_answers (
      inspection_id, question_id, score, note, photo_url, document_url, boolean_value, text_value, answer_payload
    )
    values (
      p_inspection_id,
      question_record.id,
      score_value,
      answer->>'note',
      answer->>'photo_url',
      answer->>'document_url',
      bool_value,
      answer->>'text_value',
      answer
    );

    total_weight := total_weight + question_record.weight;
    weighted_sum := weighted_sum + (effective_score * question_record.weight);

    if effective_score <= question_record.violation_threshold then
      violation_total := violation_total + 1;
      if question_record.critical then
        critical_total := critical_total + 1;
      end if;

      insert into public.tasks (
        garden_id, title, description, assigned_to, due_at, task_type, source_entity_type, status, priority
      )
      values (
        inspection_record.garden_id,
        'תיקון ליקוי: ' || question_record.category,
        question_record.question_text,
        inspection_record.inspector_id,
        now() + interval '7 days',
        'violation_correction',
        'inspection_answer',
        'open',
        case when question_record.critical then 'critical'::public.severity_level else 'high'::public.severity_level end
      )
      returning id into task_id_created;

      insert into public.violations (
        garden_id, inspection_id, question_id, task_id, title, description,
        category, severity, score, status, correction_due_at
      )
      values (
        inspection_record.garden_id,
        p_inspection_id,
        question_record.id,
        task_id_created,
        'ליקוי ביקורת: ' || question_record.category,
        question_record.question_text,
        question_record.category,
        case when question_record.critical then 'critical'::public.severity_level else 'high'::public.severity_level end,
        effective_score,
        'open',
        now() + interval '7 days'
      )
      returning id into violation_id_created;

      update public.tasks
      set source_entity_id = violation_id_created
      where id = task_id_created;

      insert into public.incident_timeline (
        garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
      )
      values (
        inspection_record.garden_id,
        'violation',
        violation_id_created,
        'inspection_violation_created',
        'נוצר ליקוי אוטומטי',
        question_record.question_text,
        case when question_record.critical then 'critical'::public.severity_level else 'high'::public.severity_level end,
        jsonb_build_object('score', effective_score, 'inspection_id', p_inspection_id, 'question_type', question_record.question_type)
      );
    end if;
  end loop;

  if total_weight = 0 then
    raise exception 'Cannot submit inspection without weighted questions';
  end if;

  weighted_average := round(weighted_sum / total_weight, 2);

  update public.inspections
  set
    status = 'done',
    gps_lat = p_gps_lat,
    gps_lng = p_gps_lng,
    gps_verified = (distance is not null and distance <= p_gps_radius_meters),
    completed_at = now(),
    weighted_score = weighted_average,
    critical_failures = critical_total,
    violation_count = violation_total,
    submitted_payload = p_answers,
    updated_at = now()
  where id = p_inspection_id;

  update public.gardens
  set
    last_inspection_score = weighted_average,
    last_inspection_at = now(),
    next_inspection_at = coalesce(inspection_record.period_month,date_trunc('month',now())::date) + interval '2 months' - interval '1 second',
    safe_status = case
      when weighted_average < public.inspection_attention_threshold() or critical_total > 0 then 'requires_fix'::public.safe_status
      else 'safe'::public.safe_status
    end,
    eligible_for_safe_status = (weighted_average >= public.inspection_attention_threshold() and critical_total = 0),
    updated_at = now()
  where id = inspection_record.garden_id;

  update public.tasks
  set status = 'done', completed_at = now(), completed_by = inspection_record.inspector_id, updated_at = now()
  where id = inspection_record.task_id;

  insert into public.incident_timeline (
    garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
  )
  values (
    inspection_record.garden_id,
    'inspection',
    p_inspection_id,
    'inspection_submitted',
    'ביקורת פקח הושלמה',
    'ציון משוקלל: ' || weighted_average || ', ליקויים: ' || violation_total,
    case when weighted_average < public.inspection_attention_threshold() or critical_total > 0 then 'high'::public.severity_level else 'low'::public.severity_level end,
    jsonb_build_object('weighted_score', weighted_average, 'violations', violation_total, 'critical_failures', critical_total)
  );

  if weighted_average < public.inspection_attention_threshold() or critical_total > 0 then
    insert into public.incident_timeline (
      garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
    )
    values (
      inspection_record.garden_id,
      'garden',
      inspection_record.garden_id,
      'safe_badge_removed',
      'סטטוס גן בטוח הוסר',
      'הגן עבר לרשימת גנים הדורשים תיקון בעקבות ביקורת',
      'high',
      jsonb_build_object('weighted_score', weighted_average, 'critical_failures', critical_total)
    );
  end if;

  return jsonb_build_object(
    'inspection_id', p_inspection_id,
    'weighted_score', weighted_average,
    'violations_created', violation_total,
    'critical_failures', critical_total,
    'safe_status', case when weighted_average < public.inspection_attention_threshold() or critical_total > 0 then 'requires_fix' else 'safe' end
  );
end;
$$;

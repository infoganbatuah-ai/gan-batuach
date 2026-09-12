-- GB-M20: approval is platform authority; Garden assignment remains separate.
-- Preserve only operational access already valid under the previous active-profile,
-- Inspector-row and assigned-Garden authority. Do not infer approval for others.
insert into public.inspector_applications(profile_id,full_name,phone,email,city,status,admin_decision,activated_at,metadata)
select p.id,p.full_name,p.phone,p.email,null,'approved','legacy_existing_operational_access',now(),
  jsonb_build_object('source','legacy_existing_operational_access','grandfathered_at',now())
from public.profiles p
join public.inspectors i on i.id=p.id
where p.role::text='inspector' and p.active=true
  and exists(select 1 from public.gardens g where g.inspector_id=p.id)
  and not exists(select 1 from public.inspector_applications a where a.profile_id=p.id)
on conflict(profile_id) do nothing;

create or replace function public.is_approved_inspector(target_profile_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles p
    join public.inspector_applications a on a.profile_id=p.id
    join public.inspectors i on i.id=p.id
    where p.id=target_profile_id and p.role::text='inspector' and p.active=true
      and a.status='approved' and a.activated_at is not null
  );
$$;

create or replace function public.current_inspector_approved()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_approved_inspector(auth.uid());
$$;

create or replace function public.can_inspector_access_garden(target_garden_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select target_garden_id is not null and (
    public.is_admin() or (
      public.is_approved_inspector(auth.uid())
      and exists (select 1 from public.gardens g where g.id=target_garden_id and g.inspector_id=auth.uid())
    )
  );
$$;

create or replace function public.guard_inspector_garden_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.inspector_id is not null and (tg_op='INSERT' or new.inspector_id is distinct from old.inspector_id)
    and not public.is_approved_inspector(new.inspector_id) then
    raise exception 'inspector_not_approved' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists management_inspector_assignment_guard on public.gardens;
create trigger management_inspector_assignment_guard before insert or update of inspector_id on public.gardens
for each row execute function public.guard_inspector_garden_assignment();

drop policy if exists "inspector applications scoped update" on public.inspector_applications;
create policy "inspector applications admin update" on public.inspector_applications
for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "inspector applications own insert" on public.inspector_applications;

create or replace function public.submit_inspector_application(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles%rowtype; existing public.inspector_applications%rowtype; saved public.inspector_applications%rowtype;
declare submitted boolean := coalesce((p_payload->>'submit')::boolean,true);
declare next_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into actor from public.profiles where id=auth.uid() for update;
  if actor.id is null or actor.role::text <> 'inspector' then raise exception 'inspector_role_required' using errcode='42501'; end if;
  if nullif(trim(p_payload->>'full_name'),'') is null then raise exception 'inspector_name_required' using errcode='23514'; end if;
  if submitted and (nullif(trim(p_payload->>'city'),'') is null or
      (actor.contact_verification_required and (actor.email_verified_at is null or actor.phone_verified_at is null))) then
    raise exception 'inspector_application_incomplete' using errcode='23514';
  end if;
  select * into existing from public.inspector_applications where profile_id=actor.id for update;
  if existing.id is not null and existing.status in ('approved','suspended') then
    raise exception 'inspector_application_locked' using errcode='23514';
  end if;
  if existing.id is not null and existing.status in ('submitted','under_review') then
    return to_jsonb(existing);
  end if;
  if existing.id is not null and existing.status='more_information_requested' and not submitted then
    raise exception 'inspector_response_requires_submission' using errcode='23514';
  end if;
  next_status:=case when submitted then 'submitted' else 'draft' end;
  insert into public.inspector_applications(profile_id,full_name,phone,email,city,preferred_regions,experience_summary,documents,status,submitted_at,metadata)
  values(actor.id,trim(p_payload->>'full_name'),coalesce(p_payload->>'phone',actor.phone),coalesce(p_payload->>'email',actor.email),p_payload->>'city',
    coalesce(array(select jsonb_array_elements_text(p_payload->'preferred_regions')),'{}'::text[]),p_payload->>'experience_summary',coalesce(p_payload->'documents','{}'::jsonb),next_status,
    case when submitted then now() else null end,coalesce(p_payload->'metadata','{}'::jsonb))
  on conflict(profile_id) do update set full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,city=excluded.city,
    preferred_regions=excluded.preferred_regions,experience_summary=excluded.experience_summary,documents=excluded.documents,status=excluded.status,
    submitted_at=excluded.submitted_at,metadata=excluded.metadata,admin_decision=null,decision_reason=null,decided_at=null,updated_at=now()
  returning * into saved;
  insert into public.audit_logs(actor_id,actor_role,entity_type,entity_id,action,after_data)
  values(actor.id,'inspector','inspector_applications',saved.id,case when submitted then 'inspector_application_submitted' else 'inspector_application_saved' end,jsonb_build_object('status',next_status));
  if submitted then
    insert into public.notifications(recipient_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,recipient_profile_id,created_by)
    values(actor.id,'inspector','בקשת המפקח התקבלה','הבקשה הועברה לבדיקה.','הבקשה הועברה לבדיקה.',
      'inspector_applications',saved.id,'low','/dashboard/inspector/apply',actor.id,actor.id);
  end if;
  return to_jsonb(saved);
end;
$$;

create or replace function public.decide_inspector_application(p_application_id uuid,p_action text,p_reason text default null,p_regions text[] default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare application public.inspector_applications%rowtype; applicant public.profiles%rowtype; saved public.inspector_applications%rowtype;
declare next_status text; now_at timestamptz:=now();
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into application from public.inspector_applications where id=p_application_id for update;
  if application.id is null then raise exception 'application_not_found' using errcode='P0002'; end if;
  if p_action not in ('under_review','request_more_information','approve','reject','suspend') then raise exception 'invalid_inspector_action' using errcode='23514'; end if;
  next_status:=case p_action when 'request_more_information' then 'more_information_requested' when 'approve' then 'approved' when 'reject' then 'rejected' else p_action end;
  if application.status=next_status then return to_jsonb(application); end if;
  if not (
    (application.status in ('submitted','under_review','approved_pending_assignment') and p_action in ('under_review','request_more_information','approve','reject')) or
    (application.status='approved' and p_action='suspend') or
    (application.status='suspended' and p_action='approve')
  ) then raise exception 'invalid_inspector_transition' using errcode='23514'; end if;
  select * into applicant from public.profiles where id=application.profile_id for update;
  if applicant.id is null or applicant.role::text<>'inspector' then raise exception 'inspector_profile_invalid' using errcode='23514'; end if;
  if p_action='approve' then
    if applicant.contact_verification_required and (applicant.email_verified_at is null or applicant.phone_verified_at is null) then
      raise exception 'inspector_contact_unverified' using errcode='23514';
    end if;
    if nullif(trim(application.full_name),'') is null or nullif(trim(application.city),'') is null then
      raise exception 'inspector_application_incomplete' using errcode='23514'; end if;
    insert into public.inspectors(id,service_cities,certification_notes)
    values(applicant.id,coalesce(p_regions,application.preferred_regions),application.experience_summary)
    on conflict(id) do update set service_cities=excluded.service_cities,certification_notes=excluded.certification_notes;
    update public.profiles set active=true,self_service_status='active',self_service_approved_at=now_at,self_service_approved_by=auth.uid() where id=applicant.id;
  elsif p_action='suspend' then
    update public.profiles set self_service_status='suspended' where id=applicant.id;
  elsif p_action='reject' then
    update public.profiles set self_service_status='rejected' where id=applicant.id;
  end if;
  update public.inspector_applications set status=next_status,admin_decision=p_action,decision_reason=p_reason,
    decided_at=case when p_action in ('approve','reject','suspend') then now_at else decided_at end,
    activated_at=case when p_action='approve' then now_at else activated_at end,updated_at=now_at
  where id=application.id returning * into saved;
  insert into public.audit_logs(actor_id,actor_role,entity_type,entity_id,action,before_data,after_data)
  values(auth.uid(),'admin','inspector_applications',application.id,'inspector_application_'||p_action,
    jsonb_build_object('status',application.status),jsonb_build_object('status',next_status));
  insert into public.notifications(recipient_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,recipient_profile_id,created_by)
  values(application.profile_id,'inspector','בקשת המפקח עודכנה',coalesce(p_reason,'סטטוס הבקשה שלך עודכן.'),coalesce(p_reason,'סטטוס הבקשה שלך עודכן.'),
    'inspector_applications',application.id,'low','/dashboard/inspector/apply',application.profile_id,auth.uid());
  return to_jsonb(saved);
end;
$$;

revoke all on function public.is_approved_inspector(uuid),public.current_inspector_approved(),public.guard_inspector_garden_assignment(),
  public.submit_inspector_application(jsonb),public.decide_inspector_application(uuid,text,text,text[]) from public,anon;
revoke all on function public.is_approved_inspector(uuid) from authenticated;
grant execute on function public.current_inspector_approved(),public.submit_inspector_application(jsonb),
  public.decide_inspector_application(uuid,text,text,text[]) to authenticated;

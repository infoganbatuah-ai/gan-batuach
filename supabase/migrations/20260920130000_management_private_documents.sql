-- GB-M32. Keep the existing documents business entity; attachments/evidence
-- retain their own domain tables and buckets. Legacy file_url values are not
-- rewritten because their provenance and retention cannot be inferred.
alter table public.documents
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists inspection_id uuid references public.inspections(id) on delete set null,
  add column if not exists replaces_document_id uuid references public.documents(id) on delete set null,
  add column if not exists replaced_by uuid references public.documents(id) on delete set null,
  add column if not exists retention_until date,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- Legacy CASCADE rules could erase a retained document row while leaving its
-- private object orphaned. Entity deletion now waits for an explicit document
-- retention decision and storage cleanup; no customer row is deleted here.
alter table public.documents drop constraint if exists documents_garden_id_fkey;
alter table public.documents add constraint documents_garden_id_fkey foreign key (garden_id) references public.gardens(id) on delete restrict not valid;
alter table public.documents drop constraint if exists documents_child_id_fkey;
alter table public.documents add constraint documents_child_id_fkey foreign key (child_id) references public.children(id) on delete restrict not valid;
alter table public.documents drop constraint if exists documents_staff_id_fkey;
alter table public.documents add constraint documents_staff_id_fkey foreign key (staff_id) references public.staff(id) on delete restrict not valid;
alter table public.documents drop constraint if exists documents_parent_id_fkey;
alter table public.documents add constraint documents_parent_id_fkey foreign key (parent_id) references public.parents(id) on delete restrict not valid;
alter table public.documents drop constraint if exists documents_inspector_id_fkey;
alter table public.documents add constraint documents_inspector_id_fkey foreign key (inspector_id) references public.inspectors(id) on delete restrict not valid;
alter table public.documents validate constraint documents_garden_id_fkey;
alter table public.documents validate constraint documents_child_id_fkey;
alter table public.documents validate constraint documents_staff_id_fkey;
alter table public.documents validate constraint documents_parent_id_fkey;
alter table public.documents validate constraint documents_inspector_id_fkey;

alter table public.documents
  add constraint management_document_storage_binding check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket = 'documents' and storage_path is not null and storage_path ~ '^management/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|jpg|png|webp)$')
  ) not valid;
alter table public.documents validate constraint management_document_storage_binding;
alter table public.documents
  add constraint management_document_size_bound check (byte_size is null or byte_size between 1 and 12582912) not valid;
alter table public.documents validate constraint management_document_size_bound;
create unique index if not exists management_documents_storage_path_unique
  on public.documents(storage_bucket, storage_path) where storage_path is not null;
create index if not exists management_documents_scope_expiry_idx
  on public.documents(garden_id, expires_at) where deleted_at is null and replaced_by is null;
create index if not exists management_documents_expiry_scan_idx
  on public.documents(expires_at, id) where deleted_at is null and replaced_by is null and status='valid' and expires_at is not null;
create index if not exists management_documents_owner_idx
  on public.documents(owner_type, owner_profile_id, staff_id, child_id, created_at desc)
  where deleted_at is null;

-- The bucket was already private. This restrictive policy closes any broad
-- authenticated storage.objects policy; all reads/writes go through a scoped
-- server route after document-row authorization. Service role bypasses RLS.
update storage.buckets set public = false where id = 'documents';
drop policy if exists "management documents server only" on storage.objects;
create policy "management documents server only" on storage.objects as restrictive
  for all to public using (bucket_id <> 'documents') with check (bucket_id <> 'documents');

create or replace function public.can_access_document(target_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_document_id is not null and exists (
    select 1 from public.documents d
    left join public.staff s on s.id = d.staff_id and s.garden_id=d.garden_id
    where d.id = target_document_id and d.deleted_at is null and (
      -- Child/guardian records never inherit generic Staff or Inspector access.
      (d.child_id is not null and exists (select 1 from public.children c where c.id=d.child_id and c.garden_id=d.garden_id) and (
        public.can_parent_access_child(d.child_id)
        or (not public.is_admin() and public.can_manage_garden(d.garden_id))
      ))
      or (d.child_id is null and d.staff_id is not null and s.id is not null and (
        (s.profile_id = auth.uid() and public.can_staff_access_garden(d.garden_id))
        or (not public.is_admin() and public.can_manage_garden(d.garden_id))
      ))
      or (d.child_id is null and d.staff_id is null and d.owner_profile_id is not null and (
        (d.owner_profile_id = auth.uid() and (
          (d.owner_type='owner' and public.can_manage_garden(d.garden_id))
          or (d.owner_type='teacher' and exists (select 1 from public.garden_teaching_assignments a
            where a.profile_id=auth.uid() and a.garden_id=d.garden_id and a.status='active'
              and (public.can_manage_garden(d.garden_id) or public.can_staff_access_garden(d.garden_id))))
          or (d.owner_type='guardian' and exists (select 1 from public.parents p where p.profile_id=auth.uid() and p.garden_id=d.garden_id))
        ))
        or (d.garden_id is not null and not public.is_admin() and public.can_manage_garden(d.garden_id))
      ))
      or (d.child_id is null and d.staff_id is null and d.owner_profile_id is null and d.inspection_id is not null
          and exists (select 1 from public.inspections i where i.id=d.inspection_id and i.garden_id=d.garden_id) and (
        public.can_manage_garden(d.garden_id)
        or public.can_inspector_access_garden(d.garden_id)
      ))
      or (d.child_id is null and d.staff_id is null and d.owner_profile_id is null and d.inspection_id is null
          and d.garden_id is not null and (
            public.can_manage_garden(d.garden_id)
            or (d.document_type in ('safety_certificate','health_certificate','insurance','regulatory')
                and public.can_inspector_access_garden(d.garden_id))
          ))
    )
  )
$$;
revoke all on function public.can_access_document(uuid) from public, anon;
grant execute on function public.can_access_document(uuid) to authenticated, service_role;

-- Recheck the recipient's current relationship before issuing any new alert.
-- Historical document/audit rows survive revocation; fresh notifications do not.
create or replace function public.management_document_recipient_active(p_document_id uuid,p_recipient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d join public.profiles p on p.id=p_recipient_id and p.active=true
    where d.id=p_document_id and d.deleted_at is null and d.replaced_by is null and d.garden_id is not null
      and (
        (p.role::text='parent' and (
          (d.child_id is not null and exists (
            select 1 from public.child_guardian_links l join public.children c on c.permanent_child_file_id=l.permanent_child_file_id
            join public.child_kindergarten_enrollments e on e.child_id=c.id and e.garden_id=d.garden_id and e.status='active'
            where l.guardian_profile_id=p.id and l.status='active' and l.legal_authority and c.id=d.child_id))
          or (d.owner_type='guardian' and d.owner_profile_id=p.id and exists (
            select 1 from public.parents pa where pa.profile_id=p.id and pa.garden_id=d.garden_id))))
        or (p.role::text='staff' and (
          (d.staff_id is not null and exists (
            select 1 from public.staff s join public.staff_kindergarten_employments e
              on e.staff_id=s.id and e.garden_id=d.garden_id and e.profile_id=p.id and e.status='active'
            where s.id=d.staff_id))
          or (d.owner_type='teacher' and d.owner_profile_id=p.id and exists (
            select 1 from public.staff_kindergarten_employments e where e.profile_id=p.id and e.garden_id=d.garden_id and e.status='active'))))
        or (p.role::text in ('manager','owner') and exists (
          select 1 from public.garden_management_memberships m
          where m.garden_id=d.garden_id and m.profile_id=p.id and m.status='active'))
      )
  )
$$;
revoke all on function public.management_document_recipient_active(uuid,uuid) from public, anon, authenticated;
grant execute on function public.management_document_recipient_active(uuid,uuid) to service_role;

drop policy if exists "documents scoped read hardened" on public.documents;
drop policy if exists "documents scoped insert hardened" on public.documents;
drop policy if exists "documents scoped update hardened" on public.documents;
create policy "management documents private read" on public.documents for select to authenticated
  using (public.can_access_document(id));
-- All new writes use the guarded registration/review functions. Direct updates
-- would permit a document owner to self-verify or change its tenant binding.
revoke all on table public.documents from anon;
revoke insert, update, delete, truncate, references, trigger on table public.documents from authenticated;
grant select on table public.documents to authenticated;

create or replace function public.register_management_document(
  p_id uuid, p_garden_id uuid, p_owner_type text, p_owner_profile_id uuid,
  p_staff_id uuid, p_child_id uuid, p_inspection_id uuid,
  p_document_type text, p_name text, p_storage_path text,
  p_mime_type text, p_byte_size bigint, p_expires_at date,
  p_replaces_document_id uuid default null
) returns public.documents language plpgsql security definer set search_path = public as $$
declare prior public.documents%rowtype; result public.documents%rowtype; actor uuid := auth.uid();
begin
  if actor is null or p_id is null or p_garden_id is null or p_name is null
    or length(btrim(p_name)) not between 2 and 160 or p_byte_size not between 1 and 12582912
    or p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp')
    or p_storage_path !~ ('^management/' || p_garden_id::text || '/' || p_id::text || '/[0-9a-f-]{36}[.](pdf|jpg|png|webp)$')
  then raise exception 'invalid_document_input' using errcode='22023'; end if;
  if p_owner_type not in ('garden','child','staff','owner','teacher','guardian','inspection')
    or p_document_type not in ('garden_document','safety_certificate','health_certificate','insurance','camera_approval','regulatory',
      'staff_document','qualification','training','first_aid','police_clearance','background_check','teacher_certificate','owner_document','child_document','medical_approval','guardian_document','inspection_document')
  then raise exception 'invalid_document_category' using errcode='22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id='documents' and o.name=p_storage_path)
    or (public.is_admin() and p_owner_type in ('child','staff','owner','teacher','guardian'))
  then raise exception 'document_scope_denied' using errcode='42501'; end if;
  if (p_owner_type='garden' and p_owner_profile_id is null and p_staff_id is null and p_child_id is null and p_inspection_id is null
      and p_document_type in ('garden_document','safety_certificate','health_certificate','insurance','camera_approval','regulatory')
      and public.can_manage_garden(p_garden_id)) then null;
  elsif p_owner_type='child' and p_child_id is not null and p_owner_profile_id is null and p_staff_id is null and p_inspection_id is null
      and p_document_type in ('child_document','medical_approval')
      and exists (select 1 from public.children c where c.id=p_child_id and c.garden_id=p_garden_id)
      and (public.can_parent_access_child(p_child_id) or public.can_manage_garden(p_garden_id)) then null;
  elsif p_owner_type='staff' and p_staff_id is not null and p_child_id is null and p_inspection_id is null and p_owner_profile_id is null
      and p_document_type in ('staff_document','qualification','training','first_aid','police_clearance','background_check')
      and exists (select 1 from public.staff s where s.id=p_staff_id and s.garden_id=p_garden_id and
        ((s.profile_id=actor and public.can_staff_access_garden(p_garden_id)) or public.can_manage_garden(p_garden_id))) then null;
  elsif p_owner_type='owner' and p_owner_profile_id=actor and p_staff_id is null and p_child_id is null and p_inspection_id is null
      and p_document_type='owner_document' and public.can_manage_garden(p_garden_id)
      and exists (select 1 from public.gardens g where g.id=p_garden_id and g.owner_profile_id=actor) then null;
  elsif p_owner_type='teacher' and p_owner_profile_id=actor and p_staff_id is null and p_child_id is null and p_inspection_id is null
      and p_document_type='teacher_certificate'
      and exists (select 1 from public.garden_teaching_assignments a where a.garden_id=p_garden_id and a.profile_id=actor
        and a.status='active' and (public.can_manage_garden(p_garden_id) or public.can_staff_access_garden(p_garden_id))) then null;
  elsif p_owner_type='guardian' and p_owner_profile_id=actor and p_staff_id is null and p_child_id is null and p_inspection_id is null
      and p_document_type='guardian_document' and exists (
        select 1 from public.child_guardian_links l join public.children c on c.permanent_child_file_id=l.permanent_child_file_id
        join public.child_kindergarten_enrollments e on e.child_id=c.id and e.garden_id=p_garden_id and e.status='active'
        where l.guardian_profile_id=actor and l.status='active' and l.legal_authority) then null;
  elsif p_owner_type='inspection' and p_inspection_id is not null and p_staff_id is null and p_child_id is null and p_owner_profile_id is null
      and p_document_type='inspection_document'
      and exists (select 1 from public.inspections i where i.id=p_inspection_id and i.garden_id=p_garden_id
          and public.can_inspector_access_garden(p_garden_id) and i.status::text in ('open','in_progress')) then null;
  else raise exception 'document_scope_denied' using errcode='42501'; end if;
  if p_replaces_document_id is not null then
    select * into prior from public.documents where id=p_replaces_document_id for update;
    if prior.id is null or prior.garden_id is distinct from p_garden_id or prior.owner_type is distinct from p_owner_type
      or prior.owner_profile_id is distinct from p_owner_profile_id or prior.staff_id is distinct from p_staff_id
      or prior.child_id is distinct from p_child_id or prior.inspection_id is distinct from p_inspection_id
      or prior.document_type is distinct from p_document_type or prior.replaced_by is not null or prior.deleted_at is not null
    then raise exception 'replacement_conflict' using errcode='23505'; end if;
  end if;
  insert into public.documents(id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,
    document_type,name,file_url,storage_bucket,storage_path,mime_type,byte_size,expires_at,
    uploaded_by,replaces_document_id,status)
  values(p_id,p_garden_id,p_owner_type,p_owner_profile_id,p_staff_id,p_child_id,p_inspection_id,
    p_document_type,btrim(p_name),'/api/documents/'||p_id::text||'/file','documents',p_storage_path,p_mime_type,p_byte_size,p_expires_at,
    actor,p_replaces_document_id,'pending_review') returning * into result;
  if prior.id is not null then update public.documents set replaced_by=p_id where id=prior.id; end if;
  insert into public.audit_logs(actor_id,garden_id,entity_type,entity_id,action,after_data)
    values(actor,p_garden_id,'documents',p_id,'document_uploaded',jsonb_build_object('owner_type',p_owner_type,'document_type',p_document_type,'replaces',p_replaces_document_id));
  return result;
end $$;
revoke all on function public.register_management_document(uuid,uuid,text,uuid,uuid,uuid,uuid,text,text,text,text,bigint,date,uuid) from public, anon;
grant execute on function public.register_management_document(uuid,uuid,text,uuid,uuid,uuid,uuid,text,text,text,text,bigint,date,uuid) to authenticated;

create or replace function public.review_management_document(p_id uuid,p_status text,p_reason text default null)
returns public.documents language plpgsql security definer set search_path = public as $$
declare d public.documents%rowtype; result public.documents%rowtype; actor uuid := auth.uid(); target_href text;
begin
  select * into d from public.documents where id=p_id for update;
  if d.id is null or d.deleted_at is not null or d.replaced_by is not null then raise exception 'document_unavailable' using errcode='42501'; end if;
  if p_status not in ('valid','rejected') or actor is null or actor=d.uploaded_by
    or not ((public.is_admin() and d.owner_type in ('garden','owner','teacher','inspection'))
      or (not public.is_admin() and d.owner_type in ('garden','child','staff','guardian','inspection') and public.can_manage_garden(d.garden_id)))
  then raise exception 'document_review_denied' using errcode='42501'; end if;
  if d.status::text=p_status then return d; end if;
  update public.documents set status=p_status::public.document_status,reviewed_by=actor,reviewed_at=now(),
    rejection_reason=case when p_status='rejected' then left(coalesce(nullif(btrim(p_reason),''),'נדרש תיקון'),500) else null end
    where id=p_id returning * into result;
  insert into public.audit_logs(actor_id,garden_id,entity_type,entity_id,action,before_data,after_data)
    values(actor,d.garden_id,'documents',p_id,'document_reviewed',jsonb_build_object('status',d.status),jsonb_build_object('status',p_status));
  if d.uploaded_by is not null and d.uploaded_by<>actor
    and public.management_document_recipient_active(p_id,d.uploaded_by) then
    target_href := case when d.owner_type in ('staff','teacher') then '/dashboard/staff/documents'
      when d.owner_type='child' then '/dashboard/parent/documents' else '/dashboard/garden/documents' end;
    insert into public.notifications(garden_id,recipient_id,recipient_profile_id,title,body,message,entity_type,entity_id,
      child_id,severity,action_url,created_by,source_domain,notification_type,preference_category,dedupe_key,metadata)
    values(d.garden_id,d.uploaded_by,d.uploaded_by,'יש עדכון במסמך','ניתן לבדוק את מצב המסמך באזור המסמכים.',
      'ניתן לבדוק את מצב המסמך באזור המסמכים.','documents',p_id,d.child_id,'low',target_href,actor,
      'documents','document_reviewed','system','document:'||p_id::text||':'||txid_current()::text,
      jsonb_build_object('href',target_href,'document_id',p_id));
  end if;
  return result;
end $$;
revoke all on function public.review_management_document(uuid,text,text) from public, anon;
grant execute on function public.review_management_document(uuid,text,text) to authenticated;

create or replace function public.request_management_document_deletion(p_id uuid)
returns public.documents language plpgsql security definer set search_path = public as $$
declare d public.documents%rowtype; result public.documents%rowtype; actor uuid := auth.uid();
begin
  select * into d from public.documents where id=p_id for update;
  if d.id is null or d.deleted_at is not null or actor is null or not public.can_access_document(p_id)
    or not (d.uploaded_by=actor or (d.garden_id is not null and public.can_manage_garden(d.garden_id)))
  then raise exception 'document_deletion_denied' using errcode='42501'; end if;
  if d.deletion_requested_at is not null then return d; end if;
  update public.documents set deletion_requested_at=now() where id=p_id returning * into result;
  insert into public.audit_logs(actor_id,garden_id,entity_type,entity_id,action)
    values(actor,d.garden_id,'documents',p_id,'document_deletion_requested');
  return result;
end $$;
revoke all on function public.request_management_document_deletion(uuid) from public, anon;
grant execute on function public.request_management_document_deletion(uuid) to authenticated;

-- GB-M30 remains the fan-out authority. Classify this domain without
-- introducing a second queue or calling an external provider from documents.
create or replace function public.management_notification_domain(p_entity_type text)
returns text language sql immutable as $$
  select case
    when p_entity_type in ('communication_thread','message','messages') then 'messaging'
    when p_entity_type in ('task','tasks','workflow_task') then 'tasks'
    when p_entity_type in ('complaint','complaints') then 'complaints'
    when p_entity_type in ('inspection','monthly_inspection') then 'inspections'
    when p_entity_type in ('corrective_action','violation') then 'corrective_actions'
    when p_entity_type in ('tuition','tuition_billing_period','payment') then 'tuition'
    when p_entity_type in ('subscription','garden_subscription') then 'platform_subscription'
    when p_entity_type in ('enrollment','enrollment_request') then 'enrollment'
    when p_entity_type in ('invitation','staff_invitation') then 'invitations'
    when p_entity_type in ('document','documents') then 'documents'
    else 'system' end;
$$;
revoke all on function public.management_notification_domain(text) from public, anon;
grant execute on function public.management_notification_domain(text) to authenticated, service_role;

-- Bounded, idempotent GB-M30 in-app intent producer. An approved scheduler may
-- invoke it later with the service role; no external provider is called here.
create or replace function public.queue_management_document_expiry_notifications(p_today date default (now() at time zone 'Asia/Jerusalem')::date, p_limit integer default 100)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted_count integer := 0;
begin
  if p_limit not between 1 and 500 then raise exception 'invalid_scan_limit' using errcode='22023'; end if;
  with eligible as (
    select d.*, p.role::text as recipient_role,
      case when d.expires_at < p_today then 'expired' else 'expiring' end as expiry_stage
    from public.documents d join public.profiles p on p.id=d.uploaded_by and p.active=true
    where d.deleted_at is null and d.replaced_by is null and d.status='valid'
      and d.expires_at is not null
      and d.expires_at <= p_today + least(greatest(d.reminder_days_before,0),365)
      and public.management_document_recipient_active(d.id,p.id)
      and not exists (select 1 from public.notifications n where n.recipient_id=p.id
        and n.dedupe_key='document:expiry:'||d.id::text||':'||case when d.expires_at < p_today then 'expired' else 'expiring' end)
    order by d.expires_at,d.id limit p_limit
  )
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,title,body,message,entity_type,entity_id,
    child_id,severity,action_url,source_domain,notification_type,preference_category,dedupe_key,metadata)
  select garden_id,uploaded_by,uploaded_by,'יש עדכון בתוקף מסמך','בדקו את תוקף המסמך באזור המסמכים.',
    'בדקו את תוקף המסמך באזור המסמכים.','documents',id,child_id,'low','/dashboard',
    'documents','document_'||expiry_stage,'system','document:expiry:'||id::text||':'||expiry_stage,
    jsonb_build_object('document_id',id,'stage',expiry_stage)
  from eligible
  on conflict (recipient_id,dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end $$;
revoke all on function public.queue_management_document_expiry_notifications(date,integer) from public, anon, authenticated;
grant execute on function public.queue_management_document_expiry_notifications(date,integer) to service_role;

notify pgrst, 'reload schema';

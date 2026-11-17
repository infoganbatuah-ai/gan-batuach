-- Document-only authorization for an active legal non-primary guardian.
-- Preserve the original manager, staff, inspector, and primary-parent branches.
-- The child must be bound to the same garden as the document.
create or replace function public.can_access_document(target_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_document_id is not null and exists (
    select 1 from public.documents d
    left join public.staff s on s.id = d.staff_id and s.garden_id=d.garden_id
    where d.id = target_document_id and d.deleted_at is null and (
      -- Child/guardian records never inherit generic Staff or Inspector access.
      (d.child_id is not null and exists (select 1 from public.children c where c.id=d.child_id and c.garden_id=d.garden_id) and (
        (public.can_parent_access_child(d.child_id) or exists (select 1 from public.children guardian_child where guardian_child.id=d.child_id and guardian_child.garden_id=d.garden_id and public.can_guardian_access_child(guardian_child.permanent_child_file_id,'profile')))
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
      and (public.can_parent_access_child(p_child_id) or public.can_manage_garden(p_garden_id) or exists (select 1 from public.children guardian_child where guardian_child.id=p_child_id and guardian_child.garden_id=p_garden_id and public.can_guardian_access_child(guardian_child.permanent_child_file_id,'profile'))) then null;
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

-- GB-M35 P1: candidates could not satisfy the pre-employment document gate.
-- These private qualification submissions belong to the candidate, not yet to
-- any Garden employment. Upload is evidence submitted, never verification.
create table if not exists public.staff_candidate_documents (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check (category = 'qualification'),
  storage_bucket text not null default 'documents' check (storage_bucket = 'documents'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 12582912),
  status text not null default 'uploaded' check (status in ('uploaded','verified','rejected')),
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  deleted_at timestamptz,
  constraint staff_candidate_document_path check (
    storage_path ~ ('^management/candidates/' || profile_id::text || '/' || id::text || '/[0-9a-f-]{36}[.](pdf|jpg|png|webp)$')
  )
);
create index if not exists staff_candidate_documents_owner_idx
  on public.staff_candidate_documents(profile_id, uploaded_at desc) where deleted_at is null;
alter table public.staff_candidate_documents enable row level security;
revoke all on public.staff_candidate_documents from public, anon, authenticated;
grant select on public.staff_candidate_documents to authenticated;
create policy "candidate own private documents" on public.staff_candidate_documents
  for select to authenticated using (profile_id = auth.uid() and deleted_at is null);

create or replace function public.evaluate_staff_candidate_profile(target_profile_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate public.staff_candidate_profiles; blockers text[] := '{}'; percent integer := 0; docs_ready boolean;
begin
  if target_profile_id <> auth.uid() and not public.is_admin() then
    raise exception 'staff_candidate_profile_denied' using errcode='42501';
  end if;
  select * into candidate from public.staff_candidate_profiles where profile_id=target_profile_id;
  if candidate.profile_id is null then
    blockers := array_append(blockers, 'professional_profile_missing');
  else
    if nullif(btrim(coalesce(candidate.full_name,'')),'') is null then blockers := array_append(blockers, 'full_name_missing'); else percent := percent + 15; end if;
    if nullif(btrim(coalesce(candidate.city,'')),'') is null then blockers := array_append(blockers, 'city_missing'); else percent := percent + 15; end if;
    if nullif(btrim(coalesce(candidate.professional_role,'')),'') is null then blockers := array_append(blockers, 'professional_role_missing'); else percent := percent + 20; end if;
    if coalesce(array_length(candidate.qualification_keys,1),0)=0 then blockers := array_append(blockers, 'qualification_missing'); else percent := percent + 20; end if;
    if candidate.availability='{}'::jsonb then blockers := array_append(blockers, 'availability_missing'); else percent := percent + 15; end if;
    select exists(select 1 from public.staff_candidate_documents d
      where d.profile_id=target_profile_id and d.category='qualification'
        and d.status in ('uploaded','verified') and d.deleted_at is null)
      into docs_ready;
    if not docs_ready then blockers := array_append(blockers, 'required_documents_pending'); else percent := percent + 15; end if;
  end if;
  return jsonb_build_object('profile_id',target_profile_id,'percentage',percent,'blockers',to_jsonb(blockers),
    'required_fields_complete',cardinality(blockers)=0,
    'status',case when candidate.matching_paused then 'paused' when cardinality(blockers)=0 then 'ready_for_matching' else 'incomplete' end,
    'documents_ready',docs_ready);
end $$;
revoke all on function public.evaluate_staff_candidate_profile(uuid) from public,anon;
grant execute on function public.evaluate_staff_candidate_profile(uuid) to authenticated;

create or replace function public.register_staff_candidate_document(
  p_id uuid, p_storage_path text, p_mime_type text, p_byte_size bigint
) returns public.staff_candidate_documents language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); result public.staff_candidate_documents;
begin
  if actor is null or not exists(select 1 from public.profiles p where p.id=actor and p.role::text='staff'
      and p.email_verified_at is not null and (p.active or p.self_service_status::text='pending_affiliation'))
    or not exists(select 1 from public.staff_candidate_profiles c where c.profile_id=actor)
    or p_id is null or p_byte_size not between 1 and 12582912
    or p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp')
    or p_storage_path !~ ('^management/candidates/' || actor::text || '/' || p_id::text || '/[0-9a-f-]{36}[.](pdf|jpg|png|webp)$')
    or not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=p_storage_path)
  then raise exception 'candidate_document_denied' using errcode='42501'; end if;
  if (select count(*) from public.staff_candidate_documents d where d.profile_id=actor and d.deleted_at is null) >= 10
  then raise exception 'candidate_document_limit' using errcode='23514'; end if;
  insert into public.staff_candidate_documents(id,profile_id,category,storage_bucket,storage_path,mime_type,byte_size)
  values(p_id,actor,'qualification','documents',p_storage_path,p_mime_type,p_byte_size) returning * into result;
  update public.staff_candidate_profiles c set profile_completeness=public.evaluate_staff_candidate_profile(actor), updated_at=now()
    where c.profile_id=actor;
  return result;
end $$;
revoke all on function public.register_staff_candidate_document(uuid,text,text,bigint) from public,anon;
grant execute on function public.register_staff_candidate_document(uuid,text,text,bigint) to authenticated;

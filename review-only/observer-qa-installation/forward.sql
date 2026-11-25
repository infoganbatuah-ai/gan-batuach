-- Source review only. Never part of supabase/migrations.
begin;
do $$ begin raise exception 'REVIEW ONLY: hosted QA owner and rollback rehearsal required'; end $$;
create role observer_qa_proof_executor nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb;
create schema observer_qa_proof_private;
revoke all on schema observer_qa_proof_private from public, anon, authenticated, service_role;
create table observer_qa_proof_private.windows (
  request_key uuid primary key, actor uuid not null, site uuid not null, source uuid not null,
  spki_digest text not null check (spki_digest ~ '^[0-9a-f]{64}$'),
  ticket_digest bytea unique not null check (octet_length(ticket_digest)=32),
  starts_at timestamptz not null, ends_at timestamptz not null,
  check (ends_at > starts_at and ends_at <= starts_at + interval '5 minutes'),
  bound_session uuid, nonce text unique check (nonce ~ '^[0-9a-f]{64}$'),
  session_deadline timestamptz, pending_at timestamptz, proved_at timestamptz, revoked_at timestamptz,
  check ((bound_session is null)=(nonce is null) and (nonce is null)=(pending_at is null) and (pending_at is null)=(session_deadline is null)),
  check (proved_at is null or pending_at is not null)
);
-- An operator explicitly stages at most one unrevoked window per actor.
-- Even an expired window must be closed before staging a replacement.
create unique index one_open_window_per_actor on observer_qa_proof_private.windows(actor) where revoked_at is null;
alter table observer_qa_proof_private.windows enable row level security;
alter table observer_qa_proof_private.windows force row level security;
revoke all on observer_qa_proof_private.windows from public,anon,authenticated,service_role;
grant usage on schema observer_qa_proof_private to observer_qa_proof_executor;
grant select,update(bound_session,nonce,session_deadline,pending_at,proved_at) on observer_qa_proof_private.windows to observer_qa_proof_executor;
create policy scoped_window on observer_qa_proof_private.windows to observer_qa_proof_executor
  using(actor=(select auth.uid())) with check(actor=(select auth.uid()));
-- The function owner has no membership in application roles, cannot create a
-- window or clear revocation, and reads only columns required by its predicates.
grant usage on schema public,auth to observer_qa_proof_executor;
-- Existing Site SELECT and camera-source FOR ALL policies evaluate these
-- read-only boolean predicates even for this restricted function owner.
grant execute on function public.can_access_observer_site(uuid),public.can_manage_observer_site(uuid) to observer_qa_proof_executor;
grant execute on function auth.uid(),auth.jwt(),public.digital_observer_current_session_active() to observer_qa_proof_executor;
grant select(id,active) on public.profiles to observer_qa_proof_executor;
grant select(profile_id,status,account_type) on public.digital_observer_accounts to observer_qa_proof_executor;
grant select(id,owner_profile_id,garden_id,site_type) on public.observer_sites to observer_qa_proof_executor;
grant select(id,observer_site_id) on public.digital_observer_camera_sources to observer_qa_proof_executor;
create policy qa_proof_profile on public.profiles for select to observer_qa_proof_executor using(id=(select auth.uid()));
create policy qa_proof_account on public.digital_observer_accounts for select to observer_qa_proof_executor using(profile_id=(select auth.uid()));
create policy qa_proof_site on public.observer_sites for select to observer_qa_proof_executor using(owner_profile_id=(select auth.uid()) and garden_id is null);
create policy qa_proof_source on public.digital_observer_camera_sources for select to observer_qa_proof_executor
 using(exists(select 1 from public.observer_sites s where s.id=observer_site_id and s.owner_profile_id=(select auth.uid()) and s.garden_id is null));

create function public.qa_observer_pending_proof(operation text,ticket text,request_key uuid,target_site uuid,
 target_source uuid,key_digest text,nonce_hex text) returns text
-- Function-level SET overrides the caller's session setting on every entry.
-- Only a separately privileged database owner can change this pinned value.
language plpgsql security definer set search_path=''
set observer_qa_proof.issuer='https://qrkodgtccyzmshitowdt.supabase.co/auth/v1' as $fn$
declare
  w observer_qa_proof_private.windows%rowtype;
  claims jsonb := auth.jwt();
  sid uuid := (claims->>'session_id')::uuid;
begin
  if current_setting('role',true) is distinct from 'authenticated' or
     claims->>'iss' is null or claims->>'iss' is distinct from current_setting('observer_qa_proof.issuer') or
     claims->>'aud' is distinct from 'authenticated' or claims->>'role' is distinct from 'authenticated' or
     sid is null or auth.uid() is null or coalesce(ticket ~ '^[0-9a-f]{64}$',false) is false then
    return null;
  end if;
  select t.* into w from observer_qa_proof_private.windows t
    where t.request_key=qa_observer_pending_proof.request_key and t.actor=auth.uid()
      and t.site=target_site and t.source=target_source and t.spki_digest=key_digest
      and t.ticket_digest=pg_catalog.sha256(pg_catalog.convert_to(ticket,'UTF8'))
    for update;
  if not found or w.revoked_at is not null or w.proved_at is not null or
      (w.session_deadline is not null and w.session_deadline<=clock_timestamp()) or w.starts_at>clock_timestamp() or w.ends_at<=clock_timestamp() or
      coalesce((claims->>'exp')::bigint,0)<=extract(epoch from clock_timestamp()) or
      public.digital_observer_current_session_active() is not true or not exists (
        select 1 from public.profiles p join public.digital_observer_accounts a on a.profile_id=p.id
        join public.observer_sites s on s.owner_profile_id=a.profile_id
        join public.digital_observer_camera_sources c on c.observer_site_id=s.id
        where p.id=w.actor and p.active and a.account_type in ('home','business')
        and a.status in ('onboarding','trial','active') and s.id=w.site and s.garden_id is null
        and s.site_type in ('home','office','business','warehouse','store','parking_lot','custom') and c.id=w.source)
     then return null; end if;
  if w.bound_session is not null and w.bound_session<>sid then return null; end if;
  if operation='begin' and nonce_hex ~ '^[0-9a-f]{64}$' then
    if w.bound_session is not null then return w.nonce; end if;
    update observer_qa_proof_private.windows t set bound_session=sid,nonce=nonce_hex,session_deadline=to_timestamp((claims->>'exp')::bigint),pending_at=clock_timestamp()
      where t.request_key=w.request_key;
    return nonce_hex;
  elsif operation='read' and w.bound_session=sid then return w.nonce;
  elsif operation='consume' and w.bound_session=sid and w.nonce=nonce_hex then
    update observer_qa_proof_private.windows t set proved_at=clock_timestamp() where t.request_key=w.request_key;
    return w.nonce;
  end if;
  return null;
end;
$fn$;
alter function public.qa_observer_pending_proof(text,text,uuid,uuid,uuid,text,text) owner to observer_qa_proof_executor;
revoke all on function public.qa_observer_pending_proof(text,text,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.qa_observer_pending_proof(text,text,uuid,uuid,uuid,text,text) to authenticated;
commit;

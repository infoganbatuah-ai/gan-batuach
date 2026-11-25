-- Separate review after the qualified pending-proof schema. Neither file is an active migration.
begin;
do $$ begin raise exception 'REVIEW ONLY: operator staging and existing Vault required'; end $$;
-- The private function owner must already be the trusted operator who can read these two
-- private sources. Do not grant the new reader or API roles access to Vault.
create role observer_qa_window_reader nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole;
-- Record ownership of each Vault entry created in the staging transaction.
create table observer_qa_proof_private.ticket_slots (
  request_key uuid primary key references observer_qa_proof_private.windows(request_key),
  vault_id uuid unique not null
);
alter table observer_qa_proof_private.ticket_slots enable row level security;
alter table observer_qa_proof_private.ticket_slots force row level security;
revoke all on observer_qa_proof_private.ticket_slots from public,anon,authenticated,service_role;
-- Vault's decryption function executes as the current role even when reached
-- through a view. Keep that privilege with the existing staging operator.
-- This private helper has no arguments, dynamic SQL, writes or fallback lookup.
create function observer_qa_proof_private.current_window() returns jsonb
language sql stable security definer set search_path='' as $read$
with eligible as materialized (
  select w.* from observer_qa_proof_private.windows w
  where w.revoked_at is null and w.proved_at is null
    and w.starts_at<=statement_timestamp() and w.ends_at>statement_timestamp()
    and (w.session_deadline is null or w.session_deadline>statement_timestamp())
  limit 2
)
select jsonb_build_object('receiptSecret',v.decrypted_secret,'operator',jsonb_build_object(
  'requestId',w.request_key,'ownerSubject',w.actor,'siteId',w.site,'sourceId',w.source,
  'publicKeyDigest',w.spki_digest,'issuedAt',floor(extract(epoch from w.starts_at)*1000)::bigint,
  'expiresAt',floor(extract(epoch from w.ends_at)*1000)::bigint)) as envelope
from eligible w join observer_qa_proof_private.ticket_slots slot on slot.request_key=w.request_key
join vault.decrypted_secrets v on v.id=slot.vault_id and v.name='observer-qa-proof-v1:'||w.request_key::text
where current_setting('role',true)='service_role' and (select count(*) from eligible)=1 and v.decrypted_secret ~ '^[0-9a-f]{64}$'
and w.ticket_digest=pg_catalog.sha256(pg_catalog.convert_to(v.decrypted_secret,'UTF8'));
$read$;
revoke all on function observer_qa_proof_private.current_window() from public,anon,authenticated,service_role;
grant usage on schema observer_qa_proof_private to observer_qa_window_reader;
grant execute on function observer_qa_proof_private.current_window() to observer_qa_window_reader;
create function public.qa_observer_read_window() returns jsonb language sql stable security definer
set search_path='' as $$
  select observer_qa_proof_private.current_window()
  where current_setting('role',true)='service_role'
$$;
alter function public.qa_observer_read_window() owner to observer_qa_window_reader;
revoke all on function public.qa_observer_read_window() from public,anon,authenticated,service_role;
grant execute on function public.qa_observer_read_window() to service_role;

-- Existing SQL operator only. No login role, capability or service credential is created.
-- The caller first independently verifies the actor, exact scope and SPKI receipt.
create function observer_qa_proof_private.stage_window(req uuid, subject_id uuid, site_id uuid, source_id uuid,
  fingerprint text, lifetime_seconds integer) returns void language plpgsql security invoker set search_path='' as $$
declare
  t text := encode(extensions.gen_random_bytes(32),'hex');
  opened timestamptz := date_trunc('milliseconds',clock_timestamp());
begin
  if lifetime_seconds is null or lifetime_seconds not between 1 and 300 then raise invalid_parameter_value; end if;
  insert into observer_qa_proof_private.windows(request_key,actor,site,source,spki_digest,ticket_digest,starts_at,ends_at)
  values(req,subject_id,site_id,source_id,fingerprint,pg_catalog.sha256(pg_catalog.convert_to(t,'UTF8')),
    opened,opened+make_interval(secs=>lifetime_seconds));
  insert into observer_qa_proof_private.ticket_slots values(req,vault.create_secret(t,'observer-qa-proof-v1:'||req::text));
end $$;
create function observer_qa_proof_private.close_window(req uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update observer_qa_proof_private.windows set revoked_at=coalesce(revoked_at,clock_timestamp()) where request_key=req;
  if found then
    delete from vault.secrets v using observer_qa_proof_private.ticket_slots slot
    where slot.request_key=req and v.id=slot.vault_id and v.name='observer-qa-proof-v1:'||req::text;
    delete from observer_qa_proof_private.ticket_slots where request_key=req;
  end if;
end $$;
revoke all on function observer_qa_proof_private.stage_window(uuid,uuid,uuid,uuid,text,integer),
  observer_qa_proof_private.close_window(uuid) from public,anon,authenticated,service_role;
commit;

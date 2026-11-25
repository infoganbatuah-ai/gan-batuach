begin;
do $$ begin raise exception 'REVIEW ONLY: operator must verify dedicated objects before closing'; end $$;
-- Operator with table ownership and BYPASSRLS. Revoke admission first and
-- lock windows to serialize with in-flight consumes. Retain every receipt.
revoke all on function public.qa_observer_pending_proof(text,text,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
lock table observer_qa_proof_private.windows in access exclusive mode;
update observer_qa_proof_private.windows set revoked_at=clock_timestamp() where revoked_at is null;
drop function public.qa_observer_pending_proof(text,text,uuid,uuid,uuid,text,text);
drop policy qa_proof_source on public.digital_observer_camera_sources;
drop policy qa_proof_site on public.observer_sites;
drop policy qa_proof_account on public.digital_observer_accounts;
drop policy qa_proof_profile on public.profiles;
drop policy scoped_window on observer_qa_proof_private.windows;
revoke all on observer_qa_proof_private.windows from observer_qa_proof_executor;
revoke update(bound_session,nonce,session_deadline,pending_at,proved_at) on observer_qa_proof_private.windows from observer_qa_proof_executor;
revoke select(id,active) on public.profiles from observer_qa_proof_executor;
revoke select(profile_id,status,account_type) on public.digital_observer_accounts from observer_qa_proof_executor;
revoke select(id,owner_profile_id,garden_id,site_type) on public.observer_sites from observer_qa_proof_executor;
revoke select(id,observer_site_id) on public.digital_observer_camera_sources from observer_qa_proof_executor;
-- Existing Site SELECT and camera-source FOR ALL policies evaluate these
-- read-only boolean predicates even for this restricted function owner.
revoke execute on function public.can_access_observer_site(uuid),public.can_manage_observer_site(uuid) from observer_qa_proof_executor;
revoke execute on function auth.uid(),auth.jwt(),public.digital_observer_current_session_active() from observer_qa_proof_executor;
revoke usage on schema auth,public,observer_qa_proof_private from observer_qa_proof_executor;
drop role observer_qa_proof_executor;
commit;

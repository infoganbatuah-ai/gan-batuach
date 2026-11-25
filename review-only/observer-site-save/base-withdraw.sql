-- Use the same approved installer and one READ COMMITTED outer transaction.
-- Before BEGIN close issuance, ingress and pin staging. Drain already-admitted
-- calls and sessions able to SET the role, including pooled and idle sessions.
-- Membership is cluster-wide. A revoke cannot undo SET ROLE in another
-- backend, and other transactions cannot see the revoke until COMMIT.
-- Keep admission closed through verification. Do not terminate shared sessions
-- or change privileges to obtain ownership. Coordinate all concurrent DDL.
-- In order: withdrawal-gate, boundary-check, installed-original-surface,
-- installed-catalog, membership-close (the following revoke and assertion):
--   REVOKE observer_site_save_caller FROM authenticator RESTRICT;
--   assert no authenticator membership remains (including indirect paths).
-- Then pair-rollback, writer-policies-rollback, THIS body, original catalog
-- comparison, commit. Pair rollback briefly restores generic EXECUTE inside
-- this same transaction. Neither rollback body may commit on its own.
-- Optional SET LOCAL observer_review.drop_empty_history = 'on' removes both
-- histories only when both are empty. Default 'off' preserves both. Retained
-- private schema, receipt rows, indexes and FKs are an intentional catalog
-- delta. Site, Source, trial, entitlements and financial audit stay in place.
-- Operator-only describes ordinary object ACLs. Cluster superusers, trusted
-- members of the owner and predefined cluster-wide data roles have powers
-- outside those ACLs. Verify their custody independently in the approved scope.
begin;
do $$ begin raise exception 'REVIEW ONLY: closed and drained writer withdrawal required'; end $$;

do $withdraw_scope$
declare
  ex oid := 'observer_site_save_executor'::regrole;
  caller oid := 'observer_site_save_caller'::regrole;
  op oid := current_user::regrole;
begin
  if current_setting('server_version_num')::int / 10000 <> 17
     or current_setting('search_path') <> 'pg_catalog'
     or current_setting('transaction_isolation') <> 'read committed'
     or coalesce(current_setting('observer_review.closure_receipt_sha256',true),'') !~ '^[0-9a-f]{64}$' then
    raise exception 'EXPECTED_DRAINED_PG17_WITHDRAWAL_TRANSACTION';
  end if;
  if pg_has_role('authenticator',caller,'MEMBER') or exists (
      select from pg_auth_members where member in (caller,ex) or grantor in (caller,ex)
      or (roleid in (caller,ex) and not
          (member=op and grantor=10 and admin_option))) then
    raise exception 'UNEXPECTED_ROLE_EDGE_OR_MISSING_PRE_ROLLBACK_REVOKE';
  end if;
  if exists (select from pg_roles where oid in (ex,caller) and
      (rolsuper or rolinherit or rolcreaterole or rolcreatedb or rolcanlogin or rolreplication or rolbypassrls))
     or has_schema_privilege(ex,'public','CREATE')
     or not exists (select from pg_namespace where oid='observer_site_save_private'::regnamespace and nspowner=op)
     or not exists (select from pg_proc where oid=
       'public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)'::regprocedure
       and proowner=ex and prosecdef)
     or not exists (select from pg_proc where oid=
       'public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)'::regprocedure
       and proowner=op and not prosecdef)
     or not pg_has_role(op,ex,'USAGE') then
    raise exception 'UNEXPECTED_WRITER_OR_OPERATOR_OWNERSHIP';
  end if;
  if exists (select from pg_proc where pronamespace='observer_site_save_private'::regnamespace
       or (pronamespace='public'::regnamespace and proname='submit_qa_site_source_pair'))
     or to_regclass('observer_site_save_private.pair_pin') is not null
     or exists (select from pg_policy where ex=any(polroles))
     or exists (select from pg_policy where polrelid='public.observer_sites'::regclass
         and polname='observer_standalone_insert_requires_writer') then
    raise exception 'PAIR_OR_WRITER_POLICIES_STILL_PRESENT';
  end if;
end
$withdraw_scope$;

-- Never use IF EXISTS for the base routines. The preceding rollback restored
-- exactly this generic grant. RESTRICT aborts on a tracked dependent object.
revoke execute on function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)
  from observer_site_save_caller restrict;
drop function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb) restrict;
revoke execute on function public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)
  from observer_site_save_executor restrict;
drop function public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb) restrict;

lock table observer_site_save_private.pair_receipts, observer_site_save_private.receipts in access exclusive mode;
-- pair-rollback already revoked SELECT,INSERT on pair_receipts. Verify that
-- inverse below along with the base receipt inverse. Keep locks until commit.
revoke select,insert on observer_site_save_private.receipts from observer_site_save_executor restrict;
revoke usage on schema observer_site_save_private from observer_site_save_executor restrict;

revoke insert on public.observer_site_memberships,public.digital_observer_entitlement_grants,public.digital_observer_financial_audit from observer_site_save_executor restrict;
revoke select,insert,update(id) on public.observer_site_subscriptions from observer_site_save_executor restrict;
revoke select,insert,update on public.observer_sites,public.observer_site_onboarding_drafts,public.observer_monitoring_schedules from observer_site_save_executor restrict;
revoke select,update(id) on public.observer_monitoring_packages from observer_site_save_executor restrict;
revoke select,update(profile_id) on public.digital_observer_accounts from observer_site_save_executor restrict;
revoke select on public.profiles from observer_site_save_executor restrict;
revoke execute on function public.digital_observer_current_session_active() from observer_site_save_executor restrict;
revoke usage on schema public from observer_site_save_caller restrict;
revoke usage on schema public,auth,extensions from observer_site_save_executor restrict;

do $history$
declare
  ns oid := 'observer_site_save_private'::regnamespace;
  base oid := 'observer_site_save_private.receipts'::regclass;
  pair oid := 'observer_site_save_private.pair_receipts'::regclass;
  op oid := current_user::regrole;
  cleanup text := coalesce(nullif(current_setting('observer_review.drop_empty_history',true),''),'off');
begin
  if cleanup not in ('off','on') then raise exception 'UNKNOWN_HISTORY_MODE'; end if;
  -- RLS filtering can make a nonempty table appear empty. Require both actual
  -- table owners to be this operator and row visibility to be unrestricted.
  if exists (select from pg_class where oid in (base,pair) and
      (relkind<>'r' or relowner<>op or relpersistence<>'p' or row_security_active(oid)))
     or exists (select from pg_inherits where inhrelid in (base,pair) or inhparent in (base,pair))
     or exists (select from pg_policy where polrelid in (base,pair))
     or exists (select from pg_namespace n, lateral aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a
                where n.oid=ns and a.grantee<>op)
     or exists (select from pg_class c, lateral aclexplode(coalesce(relacl,acldefault('r',relowner))) a
                where c.oid in (base,pair) and a.grantee<>op)
     or exists (select from pg_attribute col, lateral aclexplode(attacl) a
                where col.attrelid in (base,pair) and a.grantee<>op) then
    raise exception 'HISTORY_VISIBILITY_OR_OPERATOR_CUSTODY_MISMATCH';
  end if;
  -- Check registered dependents even in retention mode. RESTRICT by itself
  -- would allow automatically dependent objects to disappear with an empty heap.
  -- Follow dependencies on columns as well as whole objects; inspect object
  -- addresses, including the FK triggers on public.observer_sites. SQL assembled
  -- dynamically by other applications has no catalog dependency to inspect.
  if exists (
    with recursive
    heaps(id) as (values (base),(pair)),
    storage(id) as (
      select id from heaps union all
      select reltoastrelid from pg_class join heaps on oid=id where reltoastrelid<>0
    ),
    keys as (select oid,conindid,contype from pg_constraint where conrelid in (base,pair)),
    rowtypes as (select t.oid,t.typarray from pg_type t join storage on t.typrelid=storage.id),
    permitted(classid,objid) as (
      select 'pg_namespace'::regclass::oid,ns
      union all select 'pg_class'::regclass,id from storage
      union all select 'pg_class'::regclass,conindid from keys where contype in ('p','u')
      union all select 'pg_class'::regclass,indexrelid from pg_index
                where indrelid in (select id from storage where id not in (base,pair))
      union all select 'pg_type'::regclass,oid from rowtypes
      union all select 'pg_type'::regclass,typarray from rowtypes
      union all select 'pg_constraint'::regclass,oid from keys
      union all select 'pg_trigger'::regclass,oid from pg_trigger
                where tgisinternal and tgconstraint in (select oid from keys where contype='f')
    ),
    dependents(classid,objid) as (
      values ('pg_namespace'::regclass::oid,ns)
      union
      select d.classid,d.objid from pg_depend d join dependents parent
        on (d.refclassid,d.refobjid)=(parent.classid,parent.objid)
    )
    select * from dependents except select * from permitted
  ) then raise exception 'UNREVIEWED_PRIVATE_DEPENDENT'; end if;
  -- Check names as well: an added constraint and its index would otherwise
  -- look like normal heap infrastructure in the dependency walk.
  if exists (select from pg_class c where relnamespace=ns and oid not in (base,pair)
      and not (relkind='i' and exists (select from pg_constraint k
        where k.conrelid in (base,pair) and k.contype in ('p','u') and k.conindid=c.oid)))
     or exists (select from pg_trigger where tgrelid in (base,pair) and not tgisinternal)
     or exists (select from pg_rewrite where ev_class in (base,pair))
     or exists (select from pg_statistic_ext where stxrelid in (base,pair))
     or exists (select from pg_publication_rel where prrelid in (base,pair))
     or exists (select from pg_attrdef where adrelid in (base,pair))
     or exists (select from pg_constraint where confrelid in (base,pair)
                  and not (conrelid=pair and confrelid=base))
     or (select array_agg(conname::text order by conname collate "C") from pg_constraint
         where conrelid=base) is distinct from array['receipts_pkey','receipts_site_id_fkey']
     or (select array_agg(conname::text order by conname collate "C") from pg_constraint
         where conrelid=pair) is distinct from array['pair_receipts_actor_submission_fkey',
           'pair_receipts_pkey','pair_receipts_site_id_key','pair_receipts_source_id_key'] then
    raise exception 'UNEXPECTED_HISTORY_DEPENDENCY';
  end if;

  if cleanup='on' and not exists (select from observer_site_save_private.pair_receipts)
                  and not exists (select from observer_site_save_private.receipts) then
    drop table observer_site_save_private.pair_receipts restrict;
    drop table observer_site_save_private.receipts restrict;
    drop schema observer_site_save_private restrict;
  else
    raise notice 'Retaining both operator-owned receipt tables, constraints and indexes in place';
  end if;
end
$history$;

-- Roles are cluster objects. DROP ROLE fails if ACLs, ownership, policies or
-- other dependencies remain in any database. It removes the checked automatic
-- creator memberships. No DROP OWNED, reassignment or cluster-wide ACL sweep.
drop role observer_site_save_caller;
drop role observer_site_save_executor;
commit;

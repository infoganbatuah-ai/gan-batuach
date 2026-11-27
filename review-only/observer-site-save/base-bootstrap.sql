-- One reviewed outer transaction, with SET LOCAL search_path = pg_catalog.
-- Order: existing-catalog, base-bootstrap, atomic, ownership-window-open, writer,
-- ownership-window-close, generic-execute, writer-policies, ownership-window-open,
-- pair-forward, ownership-window-close, boundary-check, commit. Admission stays closed.
-- Immediately before EACH of writer.sql and pair-forward.sql:
--   GRANT CREATE ON SCHEMA public TO observer_site_save_executor;
-- Immediately after EACH, before proceeding to the next stage:
--   REVOKE CREATE ON SCHEMA public FROM observer_site_save_executor RESTRICT;
--   assert has_schema_privilege('observer_site_save_executor','public','CREATE') is false.
-- This covers both ALTER FUNCTION ... OWNER operations without committing CREATE.
-- Keep all other principals' schema ACLs and the installer authority unchanged.
-- Role names/memberships are cluster-wide. Qualify the whole cluster, all SET
-- paths, operator identity, database, baseline and exclusion of concurrent DDL
-- independently. A catalog check in one database cannot establish that scope.
-- Dedicated credential issuance is a separate decision after qualification.
begin;
do $$ begin raise exception 'REVIEW ONLY: empty base and authorized installer required'; end $$;
do $prereqs$
declare
  op oid := current_user::regrole;
  api oid;
  obj regclass;
begin
  if current_setting('server_version_num')::int / 10000 <> 17
     or current_setting('search_path') <> 'pg_catalog' then
    raise exception 'EXPECTED_PG17_OUTER_TRANSACTION_WITH_CATALOG_PATH';
  end if;
  if to_regnamespace('observer_site_save_private') is not null
     or exists (select from pg_roles where rolname in ('observer_site_save_caller','observer_site_save_executor'))
     or exists (select from pg_proc where pronamespace='public'::regnamespace and proname in
       ('save_observer_onboarding_atomic','submit_observer_site_save','submit_qa_site_source_pair')) then
    raise exception 'BASE_ROLE_NAMESPACE_OR_RPC_NAME_COLLISION';
  end if;
  if exists (select from pg_policy where (polrelid,polname) in (
    ('public.observer_sites'::regclass,'observer_standalone_insert_requires_writer'),
    ('public.digital_observer_accounts'::regclass,'observer_writer_lock_account'),
    ('public.observer_monitoring_packages'::regclass,'observer_writer_lock_package'),
    ('public.observer_site_subscriptions'::regclass,'observer_writer_read_subscription'),
    ('public.observer_site_subscriptions'::regclass,'observer_writer_lock_subscription'),
    ('public.observer_site_subscriptions'::regclass,'observer_writer_start_trial'),
    ('public.digital_observer_entitlement_grants'::regclass,'observer_writer_trial_grant'),
    ('public.digital_observer_financial_audit'::regclass,'observer_writer_trial_audit'),
    ('public.digital_observer_camera_sources'::regclass,'pair_source_scope'),
    ('public.digital_observer_camera_sources'::regclass,'pair_source_inert'),
    ('public.digital_observer_camera_sources'::regclass,'pair_source_lock_only')
  )) then raise exception 'BASE_POLICY_COLLISION'; end if;

  foreach api in array array['authenticator'::regrole,'anon'::regrole,
      'authenticated'::regrole,'service_role'::regrole] loop
    if pg_has_role(api,op,'MEMBER') or exists (select from pg_roles
        where oid=api and (rolsuper or rolcreaterole)) then
      raise exception 'API_CAN_CONTROL_INSTALLER_OR_ROLES';
    end if;
  end loop;
  if not exists (select from pg_roles where oid=op and (rolsuper or rolcreaterole))
     or not has_database_privilege(op,current_database(),'CREATE')
     or not has_schema_privilege(op,'public','CREATE WITH GRANT OPTION')
     or exists (select from unnest(array['public','auth','extensions']) s
                where not has_schema_privilege(op,s,'USAGE WITH GRANT OPTION'))
     or exists (select from unnest(array['public.digital_observer_current_session_active()',
         'public.can_access_observer_site(uuid)','public.can_manage_observer_site(uuid)']) f
                where not has_function_privilege(op,f,'EXECUTE WITH GRANT OPTION'))
     or not has_column_privilege(op,'public.observer_sites','id','REFERENCES') then
    raise exception 'INSTALLER_LACKS_EXISTING_DDL_OR_GRANT_AUTHORITY';
  end if;
  -- CREATE POLICY requires ownership (possibly inherited) on these relations.
  foreach obj in array array['public.observer_sites'::regclass,'public.digital_observer_accounts'::regclass,
      'public.observer_monitoring_packages'::regclass,'public.observer_site_subscriptions'::regclass,
      'public.digital_observer_entitlement_grants'::regclass,'public.digital_observer_financial_audit'::regclass,
      'public.digital_observer_camera_sources'::regclass] loop
    if not exists (select from pg_class where oid=obj and relkind='r'
        and relrowsecurity and pg_has_role(op,relowner,'USAGE')) then
      raise exception 'INSTALLER_REQUIRES_POLICY_OWNER_AUTHORITY_ON_RLS_TABLE %', obj;
    end if;
  end loop;
  -- Some GRANTs can succeed with a warning and grant only a subset.
  if exists (select from (values
      ('public.profiles','SELECT'),
      ('public.observer_site_onboarding_drafts','SELECT'),('public.observer_site_onboarding_drafts','INSERT'),
      ('public.observer_site_onboarding_drafts','UPDATE'),('public.observer_monitoring_schedules','SELECT'),
      ('public.observer_monitoring_schedules','INSERT'),('public.observer_monitoring_schedules','UPDATE'),
      ('public.observer_site_memberships','INSERT')) needed(t,p)
    where not has_table_privilege(op,t,p || ' WITH GRANT OPTION'))
    or exists (select from unnest(array['observer_site_id','profile_id','active']) c
      where not has_column_privilege(op,'public.observer_site_memberships',c,'SELECT WITH GRANT OPTION')) then
    raise exception 'INSTALLER_LACKS_FIXTURE_GRANT_OPTIONS';
  end if;
end
$prereqs$;

create role observer_site_save_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role observer_site_save_caller nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- PG16+ may give a non-superuser creator ADMIN membership granted by the
-- bootstrap superuser (OID 10). ADMIN alone confers neither SET nor inherited
-- ownership. The unchanged sibling bodies transfer ownership and then act with
-- that owner's privileges without switching roles. Stop if either is missing.
-- Never self-grant membership, SET/INHERIT or change createrole_self_grant.
do $authority$
declare
  op oid := current_user::regrole;
  ex oid := 'observer_site_save_executor'::regrole;
  caller oid := 'observer_site_save_caller'::regrole;
begin
  if not pg_has_role(op,ex,'SET') or not pg_has_role(op,ex,'USAGE')
     or exists (select from pg_auth_members where member in (ex,caller)
         or (roleid in (ex,caller) and not (member=op and grantor=10 and admin_option)))
     or exists (select from pg_roles where rolname in ('anon','authenticated','service_role')
         and pg_has_role(oid,'authenticator','MEMBER'))
     or has_schema_privilege(ex,'public','CREATE') or has_schema_privilege(caller,'public','CREATE') then
    raise exception 'UNSAFE_CREATOR_MEMBERSHIP_OR_SCHEMA_AUTHORITY';
  end if;
  if not has_function_privilege(ex,'auth.uid()','EXECUTE')
     or not has_function_privilege(ex,'extensions.hmac(text,text,text)','EXECUTE') then
    raise exception 'EXPECTED_FIXTURE_HELPER_EXECUTE_MISSING';
  end if;
end
$authority$;

grant observer_site_save_caller to authenticator with inherit false, set true, admin false;
do $membership$
begin
  if (select count(*) from pg_auth_members where roleid='observer_site_save_caller'::regrole
        and member='authenticator'::regrole and not inherit_option and set_option and not admin_option) <> 1
     or pg_has_role('authenticator','observer_site_save_caller','USAGE')
     or pg_has_role('authenticator','observer_site_save_executor','MEMBER') then
    raise exception 'AUTHENTICATOR_BOUNDARY_MISMATCH';
  end if;
end
$membership$;

-- Direct q669 delta: qualify.py setup plus its atomic.test.mjs grant slice.
-- writer.sql owns private USAGE, receipt DML, core EXECUTE and generic EXECUTE.
grant usage on schema public,auth,extensions to observer_site_save_executor;
grant usage on schema public to observer_site_save_caller;
grant execute on function public.digital_observer_current_session_active() to observer_site_save_executor;
grant select on public.profiles to observer_site_save_executor;
grant select,update(profile_id) on public.digital_observer_accounts to observer_site_save_executor;
grant select,update(id) on public.observer_monitoring_packages to observer_site_save_executor;
grant select,insert,update on public.observer_sites,public.observer_site_onboarding_drafts,public.observer_monitoring_schedules to observer_site_save_executor;
grant select,insert,update(id) on public.observer_site_subscriptions to observer_site_save_executor;
grant insert on public.observer_site_memberships,public.digital_observer_entitlement_grants,public.digital_observer_financial_audit to observer_site_save_executor;
commit;

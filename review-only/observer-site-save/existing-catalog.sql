-- Shared pre-install and post-withdraw verification. Compare only the original
-- surface. Remaining history objects have a separate custody/shape check.
begin;
do $$ begin raise exception 'REVIEW ONLY: trusted pre-change receipt required'; end $$;
do $catalog$
declare
  actual text;
  baseline text := current_setting('observer_review.existing_catalog_sha256', true);
begin
  if baseline is null or baseline !~ '^[0-9a-f]{64}$' then
    raise exception 'MISSING_INDEPENDENT_PRE_CHANGE_DIGEST';
  end if;
  with affected(rel) as (select unnest(array[
    'public.profiles','public.digital_observer_accounts','public.observer_monitoring_packages',
    'public.observer_sites','public.observer_site_memberships','public.observer_site_onboarding_drafts',
    'public.observer_monitoring_schedules','public.observer_site_subscriptions',
    'public.digital_observer_entitlement_grants','public.digital_observer_financial_audit',
    'public.digital_observer_camera_sources']::regclass[])),
  predicates(fn) as (select unnest(array['public.can_manage_observer_site(uuid)',
    'public.can_access_observer_site(uuid)','public.digital_observer_current_session_active()',
    'public.enforce_observer_engine_boundary()','public.sync_authorized_siren_policy_to_crossing_line()',
    'public.digital_guard_crossing_line_valid(jsonb)','public.block_digital_observer_financial_history_mutation()',
    'auth.uid()','extensions.hmac(text,text,text)']::regprocedure[])),
  entries(kind,key,value) as (
    select 'relation',rel::text,jsonb_build_array(pg_get_userbyid(relowner),relacl::text,
      relrowsecurity,relforcerowsecurity) from affected join pg_class on oid=rel
    union all select 'column',rel::text||'.'||attname,jsonb_build_array(format_type(atttypid,atttypmod),
      attacl::text,attnotnull,attidentity,attgenerated,pg_get_expr(adbin,adrelid))
      from affected join pg_attribute on attrelid=rel left join pg_attrdef on adrelid=rel and adnum=attnum
      where attnum>0 and not attisdropped
    union all select 'policy',rel::text||'.'||polname,jsonb_build_array(polcmd,polpermissive,
      array(select case when x=0 then 'PUBLIC' else pg_get_userbyid(x)::text end from unnest(polroles) x order by 1),
      pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) from affected join pg_policy on polrelid=rel
    union all select 'constraint',rel::text||'.'||conname,jsonb_build_array(convalidated,pg_get_constraintdef(oid))
      from affected join pg_constraint on conrelid=rel
    union all select 'trigger',rel::text||'.'||tgname,jsonb_build_array(tgenabled,pg_get_triggerdef(oid))
      from affected join pg_trigger on tgrelid=rel where not tgisinternal
    union all select 'index',indexrelid::regclass::text,jsonb_build_array(indisready,indisvalid,pg_get_indexdef(indexrelid))
      from affected join pg_index on indrelid=rel
    union all select 'function',fn::text,jsonb_build_array(pg_get_userbyid(proowner),proacl::text,
      pg_get_functiondef(oid)) from predicates join pg_proc on oid=fn
    union all select 'namespace',nspname,jsonb_build_array(pg_get_userbyid(nspowner),nspacl::text)
      from pg_namespace where nspname in ('public','auth','extensions')
    union all select 'default',concat_ws('/',pg_get_userbyid(defaclrole),defaclnamespace::regnamespace::text,defaclobjtype),
      to_jsonb(defaclacl::text) from pg_default_acl where defaclnamespace=0 or defaclnamespace in (
        select oid from pg_namespace where nspname in ('public','auth','extensions'))
    union all select 'existing role',rolname,jsonb_build_array(rolsuper,rolinherit,rolcreaterole,rolcreatedb,
      rolcanlogin,rolreplication,rolbypassrls,rolconfig) from pg_roles
      where rolname in ('postgres','authenticator','anon','authenticated','service_role') or rolname=current_user
    union all select 'membership',concat_ws('/',pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)),
      jsonb_build_array(admin_option,inherit_option,set_option) from pg_auth_members
      where roleid in (select oid from pg_roles where rolname in ('postgres','authenticator','anon','authenticated','service_role') or rolname=current_user)
         or member in (select oid from pg_roles where rolname in ('postgres','authenticator','anon','authenticated','service_role') or rolname=current_user)
  )
  select encode(sha256(convert_to(jsonb_agg(jsonb_build_array(kind,key,value)
    order by kind collate "C",key collate "C",value::text collate "C")::text,'UTF8')),'hex') into actual from entries;
  if actual is distinct from baseline then raise exception 'ORIGINAL_CATALOG_RECEIPT_MISMATCH'; end if;
end
$catalog$;
commit;

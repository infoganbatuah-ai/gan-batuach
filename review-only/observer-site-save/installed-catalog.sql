-- Recompare new objects against the independently reviewed installation receipt
-- before removing them. Includes private objects and receipts' schema, never rows.
begin;
do $$ begin raise exception 'REVIEW ONLY: installed writer metadata receipt required'; end $$;
do $catalog$
declare
  actual text;
  baseline text := current_setting('observer_review.new_catalog_sha256', true);
begin
  with ns(id) as (values ('observer_site_save_private'::regnamespace::oid)),
  entries(kind,key,value) as (
    select 'namespace',nspname::text,jsonb_build_array(pg_get_userbyid(nspowner),nspacl::text)
      from pg_namespace where oid=(select id from ns)
    union all select 'role',rolname::text,jsonb_build_array(rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,
      rolreplication,rolbypassrls,rolconfig) from pg_roles where rolname in ('observer_site_save_executor','observer_site_save_caller')
    union all select 'edge',concat_ws('/',pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)),
      jsonb_build_array(inherit_option,set_option,admin_option) from pg_auth_members
      where roleid in ('observer_site_save_executor'::regrole,'observer_site_save_caller'::regrole)
         or member in ('observer_site_save_executor'::regrole,'observer_site_save_caller'::regrole)
    union all select 'function',oid::regprocedure::text,jsonb_build_array(pg_get_userbyid(proowner),proacl::text,pg_get_functiondef(oid))
      from pg_proc where pronamespace=(select id from ns) or oid in (
        'public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text)'::regprocedure,
        'public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)'::regprocedure,
        'public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)'::regprocedure)
    union all select 'relation',relname,jsonb_build_array(relkind,relacl::text,pg_get_userbyid(relowner),
      relrowsecurity,relforcerowsecurity) from pg_class where relnamespace=(select id from ns)
    union all select 'column',attrelid::regclass::text||'.'||attname,jsonb_build_array(format_type(atttypid,atttypmod),
      attacl::text,attnotnull,attidentity,attgenerated,pg_get_expr(adbin,adrelid),attcollation::regcollation::text)
      from pg_attribute join pg_class on attrelid=oid left join pg_attrdef on adrelid=attrelid and adnum=attnum
      where relnamespace=(select id from ns) and attnum>0 and not attisdropped
    union all select 'constraint',conrelid::regclass::text||'.'||conname,jsonb_build_array(convalidated,pg_get_constraintdef(oid))
      from pg_constraint where connamespace=(select id from ns)
    union all select 'policy',polrelid::regclass::text||'.'||polname,jsonb_build_array(polcmd,polpermissive,
      array(select case when x=0 then 'PUBLIC' else pg_get_userbyid(x)::text end from unnest(polroles) x order by 1),
      pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid))
      from pg_policy join pg_class on polrelid=pg_class.oid where relnamespace=(select id from ns)
    union all select 'index',indexrelid::regclass::text,jsonb_build_array(indisready,indisvalid,pg_get_indexdef(indexrelid))
      from pg_index join pg_class on indrelid=oid where relnamespace=(select id from ns)
    union all select 'trigger',tgrelid::regclass::text||'.'||tgname,jsonb_build_array(tgenabled,pg_get_triggerdef(pg_trigger.oid))
      from pg_trigger join pg_class on tgrelid=pg_class.oid where not tgisinternal and relnamespace=(select id from ns)
    union all select 'type',typname,jsonb_build_array(typtype,typacl::text,pg_get_userbyid(typowner))
      from pg_type where typnamespace=(select id from ns)
  )
  select encode(sha256(convert_to(jsonb_agg(jsonb_build_array(kind,key,value)
    order by kind collate "C",key collate "C",value::text collate "C")::text,'UTF8')),'hex') into actual from entries;
  if baseline is null or baseline !~ '^[0-9a-f]{64}$' or actual is distinct from baseline then
    raise exception 'MISSING_OR_CHANGED_INSTALLED_CATALOG';
  end if;
end
$catalog$;
commit;

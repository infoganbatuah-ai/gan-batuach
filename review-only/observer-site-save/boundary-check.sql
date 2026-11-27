-- Final catalog assertions for the assembled PG17 install, after pair-forward.
begin;
do $$ begin raise exception 'REVIEW ONLY: assembled writer boundary requires separate qualification'; end $$;
do $boundary$
declare
  installer oid := current_user::regrole;
  caller oid := 'observer_site_save_caller'::regrole;
  executor oid := 'observer_site_save_executor'::regrole;
  gateway oid := 'authenticator'::regrole;
  api_roles oid[] := array['anon','authenticated','service_role','authenticator']::regrole[];
  private_ns oid := 'observer_site_save_private'::regnamespace;
  sites oid := 'public.observer_sites'::regclass;
  pin oid := 'observer_site_save_private.pair_pin'::regclass;
  receipts oid[] := array['observer_site_save_private.receipts',
                          'observer_site_save_private.pair_receipts']::regclass[];
  peer oid;
  tbl oid;
  fn record;
  needed record;
  helper regprocedure;
  ns regnamespace;
  bad record;
begin
  if installer = any(api_roles || array[caller,executor])
    or exists (select from pg_roles where oid in (caller,executor) and
      (rolsuper or rolinherit or rolcreaterole or rolcreatedb or rolcanlogin or rolreplication or rolbypassrls))
    or exists (select from pg_roles where oid=gateway and
      (not rolcanlogin or rolinherit or rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls))
  then raise exception 'Unsafe installer, writer or authenticator role attributes'; end if;

  -- Check both ends, even ADMIN-only edges invisible to SET/USAGE tests.
  -- A non-superuser creator on PG17 can receive a bootstrap-granted ADMIN
  -- membership. Withdrawal accepts only the installer as member with ADMIN
  -- alone. Any extra creator self-grant or writer-issued edge fails closed.
  select * into bad from pg_auth_members m
    where (m.member in (caller,executor) or m.roleid in (caller,executor) or m.grantor in (caller,executor))
      and not (m.roleid=caller and m.member=gateway and m.set_option
               and not m.inherit_option and not m.admin_option and m.grantor in (installer,10))
      and not (m.roleid in (caller,executor) and m.member=installer and m.grantor=10
               and m.admin_option and not m.set_option and not m.inherit_option);
  if found then
    raise exception 'Unexpected membership % -> % (grantor %, SET %, INHERIT %, ADMIN %)',
      bad.member::regrole,bad.roleid::regrole,bad.grantor::regrole,
      bad.set_option,bad.inherit_option,bad.admin_option;
  end if;
  if (select count(*) from pg_auth_members where roleid=caller and member=gateway) <> 1
    or not pg_has_role(gateway,caller,'SET') or pg_has_role(gateway,caller,'USAGE')
    or pg_has_role(caller,executor,'MEMBER')
  then raise exception 'Invalid authenticator/caller/executor membership'; end if;

  foreach peer in array api_roles loop
    if pg_has_role(peer,installer,'MEMBER') or pg_has_role(peer,executor,'MEMBER')
      or (peer<>gateway and pg_has_role(peer,caller,'MEMBER'))
    then raise exception 'Unexpected writer role reachable by %',peer::regrole; end if;
  end loop;

  foreach peer in array array[caller,executor] loop
    if not has_schema_privilege(peer,'public','USAGE') or has_schema_privilege(peer,'public','CREATE')
    then raise exception 'Unexpected public schema privileges for %',peer::regrole; end if;
  end loop;

  -- A multi-object/column GRANT can warn and succeed partially. Inspect each
  -- requested bit at its original scope, even if PUBLIC supplies it effectively.
  for needed in
    select format('public.%I',t)::regclass as rel, col, priv
    from (values
      ('profiles',null::text,'SELECT'),
      ('digital_observer_accounts',null,'SELECT'),
      ('digital_observer_accounts','profile_id','UPDATE'),
      ('observer_monitoring_packages',null,'SELECT'),
      ('observer_monitoring_packages','id','UPDATE'),
      ('observer_sites',null,'SELECT,INSERT,UPDATE'),
      ('observer_site_onboarding_drafts',null,'SELECT,INSERT,UPDATE'),
      ('observer_monitoring_schedules',null,'SELECT,INSERT,UPDATE'),
      ('observer_site_subscriptions',null,'SELECT,INSERT'),
      ('observer_site_subscriptions','id','UPDATE'),
      ('observer_site_memberships',null,'INSERT'),
      ('observer_site_memberships','observer_site_id','SELECT'),
      ('observer_site_memberships','profile_id','SELECT'),
      ('observer_site_memberships','active','SELECT'),
      ('digital_observer_entitlement_grants',null,'INSERT'),
      ('digital_observer_financial_audit',null,'INSERT')
    ) as required(t,col,privs) cross join lateral string_to_table(privs,',') as bits(priv)
  loop
    if needed.col is null then
      if not has_table_privilege(executor,needed.rel,needed.priv)
        or not exists (select from pg_class c,lateral aclexplode(c.relacl) a where c.oid=needed.rel
          and a.grantee=executor and a.privilege_type=needed.priv and not a.is_grantable)
      then raise exception 'Expected direct and effective executor % on %',needed.priv,needed.rel; end if;
    elsif not has_column_privilege(executor,needed.rel,needed.col,needed.priv)
      or not exists (select from pg_attribute c,lateral aclexplode(c.attacl) a where c.attrelid=needed.rel
        and c.attname=needed.col and not c.attisdropped and a.grantee=executor
        and a.privilege_type=needed.priv and not a.is_grantable)
    then raise exception 'Expected direct and effective executor % on %.%',needed.priv,needed.rel,needed.col; end if;
  end loop;

  foreach ns in array array['public','auth','extensions']::regnamespace[] loop
    foreach peer in array array[executor,caller] loop
      if (peer=executor or ns='public'::regnamespace) and
        (not has_schema_privilege(peer,ns,'USAGE') or not exists (
          select from pg_namespace n,lateral aclexplode(n.nspacl) a where n.oid=ns
            and a.grantee=peer and a.privilege_type='USAGE' and not a.is_grantable))
      then raise exception 'Expected direct and effective USAGE on % for %',ns,peer::regrole; end if;
    end loop;
  end loop;
  foreach helper in array array['public.digital_observer_current_session_active()',
      'public.can_access_observer_site(uuid)','public.can_manage_observer_site(uuid)']::regprocedure[] loop
    if not has_function_privilege(executor,helper,'EXECUTE') or not exists (
      select from pg_proc p,lateral aclexplode(p.proacl) a where p.oid=helper
        and a.grantee=executor and a.privilege_type='EXECUTE' and not a.is_grantable)
    then raise exception 'Expected direct and effective executor EXECUTE on %',helper; end if;
  end loop;

  -- The hosted receipt hashes default ACLs but does not enumerate them. Check
  -- the resulting ACL of each new signature, including PUBLIC via a NULL ACL.
  -- On submit_observer_site_save a residual postgres EXECUTE after OWNER TO
  -- is an extra direct grant if postgres is no longer owner. The pair rehearsal
  -- observed that default on submit_qa_site_source_pair. Fail on either object.
  for fn in select * from (values
    ('public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)'::regprocedure, installer, false, executor),
    ('public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)'::regprocedure, executor, true, null::oid),
    ('public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text)'::regprocedure, executor, true, caller),
    ('observer_site_save_private.lock_pair_pin(uuid,text)'::regprocedure, installer, true, executor),
    ('observer_site_save_private.check_pair_acl(boolean)'::regprocedure, installer, false, null::oid)
  ) as expected(sig,owner_id,definer,delegate) loop
    if not exists (select from pg_proc where oid=fn.sig and prokind='f'
        and proowner=fn.owner_id and prosecdef=fn.definer and proconfig=array['search_path=""'])
      or (select count(*) from pg_proc p join pg_proc expected on expected.oid=fn.sig
          and p.pronamespace=expected.pronamespace and p.proname=expected.proname) <> 1
    then raise exception 'Unexpected owner, mode, search_path or overload on %',fn.sig; end if;

    select a.* into bad from pg_proc p,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=fn.sig and a.grantee<>fn.owner_id and
        (a.grantee is distinct from fn.delegate or a.grantor<>fn.owner_id or a.is_grantable);
    if found then
      raise exception 'Unexpected EXECUTE on % for % (grantor %, grant option %)',fn.sig,
        case when bad.grantee=0 then 'PUBLIC' else pg_get_userbyid(bad.grantee) end,
        bad.grantor::regrole,bad.is_grantable;
    end if;
    foreach peer in array api_roles || array[caller,executor] loop
      if has_function_privilege(peer,fn.sig,'EXECUTE') <>
          (peer=fn.owner_id or peer is not distinct from fn.delegate)
      then raise exception 'Unexpected effective EXECUTE on % for %',fn.sig,peer::regrole; end if;
    end loop;
  end loop;

  if not exists (select from pg_namespace where oid=private_ns and nspowner=installer)
    or not has_schema_privilege(executor,private_ns,'USAGE')
    or (select count(*) from pg_proc where pronamespace=private_ns) <> 2
    or exists (select from pg_class where relnamespace=private_ns and relkind not in ('i','I')
               and oid<>all(receipts || pin))
  then raise exception 'Unexpected observer_site_save_private schema owner, access or inventory'; end if;
  select a.* into bad from pg_namespace n,lateral aclexplode(n.nspacl) a
    where n.oid=private_ns and a.grantee<>installer and
      (a.grantee<>executor or a.privilege_type<>'USAGE' or a.is_grantable);
  if found then raise exception 'Unexpected % on observer_site_save_private for grantee %',
    bad.privilege_type,bad.grantee; end if;

  foreach peer in array api_roles || caller loop
    if has_schema_privilege(peer,private_ns,'USAGE,CREATE')
    then raise exception 'Unexpected private schema access for %',peer::regrole; end if;
  end loop;
  foreach tbl in array receipts || pin loop
    if not exists (select from pg_class where oid=tbl and relkind='r' and relowner=installer
        and (relname='receipts' or relrowsecurity))
    then raise exception 'Unexpected table owner, kind or RLS on %',tbl::regclass; end if;
    select a.* into bad from pg_class c,lateral aclexplode(c.relacl) a
      where c.oid=tbl and a.grantee<>installer and
        (tbl=pin or a.grantee<>executor or a.privilege_type not in ('SELECT','INSERT') or a.is_grantable);
    if found then raise exception 'Unexpected % on % for grantee %',
      bad.privilege_type,tbl::regclass,bad.grantee; end if;
    select c.attname,a.* into bad from pg_attribute c,lateral aclexplode(c.attacl) a
      where c.attrelid=tbl and not c.attisdropped and a.grantee<>installer;
    if found then raise exception 'Unexpected % on %.% for grantee %',
      bad.privilege_type,tbl::regclass,bad.attname,bad.grantee; end if;
    foreach peer in array api_roles || caller loop
      if has_table_privilege(peer,tbl,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        or has_any_column_privilege(peer,tbl,'SELECT,INSERT,UPDATE,REFERENCES')
      then raise exception 'Unexpected private table access on % for %',tbl::regclass,peer::regrole; end if;
    end loop;
    if has_table_privilege(executor,tbl,'SELECT') <> (tbl<>pin)
      or has_table_privilege(executor,tbl,'INSERT') <> (tbl<>pin)
      or has_table_privilege(executor,tbl,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    then raise exception 'Unexpected executor privileges on %',tbl::regclass; end if;
  end loop;

  -- Hosted service_role already has INSERT/UPDATE/DELETE on observer_sites.
  -- The negative Site write assertion concerns the new caller. The EXECUTE
  -- checks above independently cover service_role on every new write RPC.
  if has_table_privilege(caller,sites,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or has_any_column_privilege(caller,sites,'INSERT,UPDATE,REFERENCES')
    or pg_has_role(caller,(select relowner from pg_class where oid=sites),'MEMBER')
  then raise exception 'Caller can modify public.observer_sites'; end if;
end
$boundary$;
commit;

import {sql,config} from './local-database.mjs';
// Reconstruct exact effective ACLs, including default PUBLIC function execute.
// pg_dump alone assumes a target with no provider-injected default grants.
export function baselineAcl() {
  const query=`WITH objects AS (
    SELECT 'TABLE' kind,format('%I.%I',n.nspname,c.relname) identity,
      coalesce(c.relacl,acldefault('r',c.relowner)) acl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
    UNION ALL SELECT 'SEQUENCE',format('%I.%I',n.nspname,c.relname),coalesce(c.relacl,acldefault('s',c.relowner))
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S'
    UNION ALL SELECT 'FUNCTION',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),coalesce(p.proacl,acldefault('f',p.proowner))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  ), commands AS (
    SELECT kind,identity,0 seq,format('REVOKE ALL ON %s %s FROM PUBLIC, anon, authenticated, service_role;',kind,identity) command FROM objects
    UNION ALL SELECT o.kind,o.identity,1,format('GRANT %s ON %s %s TO %s%s;',a.privilege_type,o.kind,o.identity,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
      CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
    FROM objects o CROSS JOIN LATERAL aclexplode(o.acl) a
    UNION ALL SELECT 'TABLE',format('%I.%I',n.nspname,c.relname),2,
      format('GRANT %s (%I) ON TABLE %I.%I TO %s%s;',a.privilege_type,att.attname,n.nspname,c.relname,
        CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
        CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
    FROM pg_attribute att JOIN pg_class c ON c.oid=att.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(att.attacl) a WHERE n.nspname='public' AND att.attnum>0 AND NOT att.attisdropped
  ) SELECT coalesce(json_agg(command ORDER BY kind,identity,seq,command),'[]') FROM commands;`;
  return JSON.parse(sql(query,{database:config.builderDatabase})).join('\n')+'\n';
}

import {writeFileSync} from 'node:fs';
import {sql,config} from './local-database.mjs';
const inventory={environment:config.environment,baselineId:config.baselineId,observedAt:new Date().toISOString(),provenance:'Pinned historical source statements + local Supabase platform image + independently recorded post-baseline migrations',productionAccess:false};
const queries={
 extensions:"select extname name,extversion version,n.nspname schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by1",
 enums:"select n.nspname schema,t.typname name,array_agg(e.enumlabel order by e.enumsortorder) values from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' group by1,2 order by1,2",
 relations:"select c.relname name,c.relkind kind,c.relrowsecurity rls,c.relforcerowsecurity forced_rls,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S') order by1",
 functions:"select p.oid::regprocedure::text identity,p.prosecdef security_definer,p.proconfig settings from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by1",
 triggers:"select n.nspname schema,c.relname relation,t.tgname name,t.tgenabled enabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or t.tgfoid in (select p.oid from pg_proc p join pg_namespace pn on pn.oid=p.pronamespace where pn.nspname='public')) order by1,2,3",
 indexes:"select schemaname schema,tablename relation,indexname name,indexdef definition from pg_indexes where schemaname='public' order by1,2,3",
 policies:"select schemaname schema,tablename relation,policyname name,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') order by1,2,3",
 storageBuckets:"select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id",
 };
for(const [name,query] of Object.entries(queries))inventory[name]=JSON.parse(sql(`select coalesce(json_agg(row_to_json(q)),'[]') from (${query.replaceAll('by1','by 1')}) q;`));
writeFileSync('development/database/schema-inventory.json',JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(inventory).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))));

import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {config,docker,sql} from './local-database.mjs';
import {splitSql,leadingCode,sha256} from './baseline-source.mjs';
import {baselineAcl} from './baseline-acl.mjs';

// Compare an untouched local Supabase platform with the derived builder. Keep
// changes outside public too (Auth triggers, Storage policies/ACLs/extensions).
const dump = database => docker(['exec',config.container,'pg_dump','-U','supabase_admin','-d',database,'--schema-only','--no-owner'])
  .replace(/^\\(?:un)?restrict .+\n/gm,'');
const publicTables=Number(sql("select count(*) from pg_tables where schemaname='public';").trim());
if(publicTables!==0)throw Error('Export requires untouched canonical platform; refusing a customer/application schema as foundation');
const base=dump('postgres'),derived=dump(config.builderDatabase);
const statements=text=>splitSql(text).map(leadingCode).filter(Boolean);
const before=statements(base),after=statements(derived),beforeSet=new Set(before),afterSet=new Set(after);
const additions=after.filter(s=>!beforeSet.has(s)),removals=before.filter(s=>!afterSet.has(s));
const output=resolve('development/database/baselines',config.baselineId);mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'platform-differences.json'),JSON.stringify({platformSha256:sha256(base),derivedSha256:sha256(derived),removedStatements:removals,addedStatementCount:additions.length},null,2)+'\n');
if(removals.length)throw Error(`Platform statements changed/removed (${removals.length}); review exact diff before bootstrap`);
const guard=`DO $baseline_guard$ BEGIN
  IF current_setting('gan_batuach.development_baseline', true) IS DISTINCT FROM '${config.baselineId}'
     OR current_database() <> 'postgres'
     OR EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')
     OR EXISTS (SELECT 1 FROM auth.users)
  THEN RAISE EXCEPTION 'DEVELOPMENT baseline requires guarded fresh isolated database; Production use forbidden'; END IF;
END $baseline_guard$;`;
const schema=`-- NEW CLEAN DEVELOPMENT ONLY. NOT A PRODUCTION MIGRATION.\n${guard}\n${additions.join('\n\n')}\n`;
writeFileSync(resolve(output,'schema.sql'),schema);
const manifest=JSON.parse(readFileSync(resolve(output,'provenance.json'),'utf8'));
manifest.schemaSha256=sha256(schema);manifest.platformSha256=sha256(base);
const acl=baselineAcl();writeFileSync(resolve(output,'exact-acl.sql'),acl);manifest.aclSha256=sha256(acl);
manifest.derivedSchemaSha256=sha256(derived);manifest.addedStatementCount=additions.length;
manifest.status='DERIVED_NOT_YET_CANONICALLY_VERIFIED';
writeFileSync(resolve(output,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:manifest.status,addedStatements:additions.length,platformRemovals:removals.length,schemaSha256:manifest.schemaSha256}));

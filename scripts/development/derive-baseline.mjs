import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {sha256,deriveSchemaStatements} from './baseline-source.mjs';
import {config,sql,docker,assertLocalDatabase} from './local-database.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:'pipe'}).trim();
const files=git('ls-tree','-r','--name-only',config.sourceIntegrationSha,'--','supabase/migrations').split('\n').filter(f=>f.endsWith('.sql')).sort();
const history=[],parts=[];
for(const file of files){
  const source=execFileSync('git',['show',`${config.sourceIntegrationSha}:${file}`],{encoding:'utf8',maxBuffer:8*1024*1024});
  const statements=deriveSchemaStatements(file.split('/').at(-1),source);
  history.push({file,version:file.split('/').at(-1).split('_')[0],gitBlob:git('rev-parse',`${config.sourceIntegrationSha}:${file}`),sourceSha256:sha256(source),classification:'HISTORICAL_MIGRATION',baselineMapping:'DEVELOPMENT_BASELINE_INCLUDED_SCHEMA_ONLY',statements:statements.map(({sql,...s})=>s)});
  parts.push({file,statements:statements.filter(s=>s.sql),body:statements.filter(s=>s.sql).map(s=>`-- Source ${file} statement ${s.ordinal}\n${s.sql}`).join('\n')});
}
const output=resolve('development/database/baselines',config.baselineId);mkdirSync(output,{recursive:true});
const manifest={baselineId:config.baselineId,sourceIntegrationSha:config.sourceIntegrationSha,productionUseForbidden:true,sourceCount:files.length,derivation:'Pinned Git source, top-level schema statements only; historical data and exact documented live-activation/fixture blocks omitted; builder autocommit resolves enum-use ordering. Original files unchanged.',migrations:history};
writeFileSync(resolve(output,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');
if(process.argv.includes('--plan-only')){console.log(JSON.stringify({status:'PLAN_ONLY',sources:files.length,output,productionAccess:false}));process.exit(0);}
assertLocalDatabase();
const builder=config.builderDatabase;
const exists=sql(`select exists(select 1 from pg_database where datname='${builder}');`).trim()==='t';
const checkpoint=resolve(config.runtimeRoot,'builder-progress.json');
if(!exists){
  sql(`CREATE DATABASE ${builder} TEMPLATE template0;`);
  const foundation=docker(['exec',config.container,'pg_dump','-U','supabase_admin','-d','postgres','--schema-only']);
  sql(foundation,{database:builder,platformBootstrap:true,args:['--single-transaction']});
  writeFileSync(checkpoint,JSON.stringify({source:config.sourceIntegrationSha,completed:[]}));
}
if(!existsSync(checkpoint))throw Error('Existing builder has no provenance checkpoint; refusing takeover/reset');
const progress=JSON.parse(readFileSync(checkpoint,'utf8'));
if(progress.source!==config.sourceIntegrationSha)throw Error('Builder source mismatch; no automatic reset');
for(const part of parts){
  const digest=sha256(part.body),prior=progress.completed.find(p=>p.file===part.file);
  if(prior){if(prior.digest!==digest)throw Error(`Already derived source changed: ${part.file}`);continue;}
  if(progress.current&&(progress.current.file!==part.file||progress.current.digest!==digest))throw Error('Partial builder checkpoint differs; manual review required');
  const ordinal=progress.current?.ordinal||0;
  const pending=part.statements.filter(s=>s.ordinal>ordinal).map(s=>`${s.sql}\n\\echo BASELINE_DDL_COMPLETED_${s.ordinal}`).join('\n');
  try{sql(`SET statement_timeout='60s'; SET lock_timeout='5s';\n${pending}`,{database:builder});}
  catch(error){
    const marks=[...String(error.stdout||'').matchAll(/BASELINE_DDL_COMPLETED_(\d+)/g)].map(m=>Number(m[1]));
    progress.current={file:part.file,digest,ordinal:marks.at(-1)||ordinal};writeFileSync(checkpoint,JSON.stringify(progress,null,2));
    console.error(`BLOCKED source ${part.file}, last completed statement ${progress.current.ordinal}`);console.error(String(error.stderr||error.message).slice(-2500));process.exit(1);
  }
  delete progress.current;
  progress.completed.push({file:part.file,digest});writeFileSync(checkpoint,JSON.stringify(progress,null,2));console.log(`DERIVED ${part.file}`);
}
const schema=docker(['exec',config.container,'pg_dump','-U','postgres','-d',builder,'--schema-only','--no-owner','--schema=public']);
writeFileSync(resolve(output,'schema.sql'),schema);
manifest.schemaSha256=sha256(schema);manifest.status='DERIVED_NOT_YET_CANONICALLY_VERIFIED';
writeFileSync(resolve(output,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:manifest.status,sourceCount:files.length,schemaSha256:manifest.schemaSha256,productionAccess:false}));

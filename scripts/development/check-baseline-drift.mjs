import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {config,sql} from './local-database.mjs';
import {sha256} from './baseline-source.mjs';
import {schemaFingerprint} from './verify-baseline-schema.mjs';
import {compareBaselineState} from './baseline-drift.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe',maxBuffer:8*1024*1024}).trim();
try{
  const ledger=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
  const paths=git('ls-tree','-r','--name-only','HEAD','--','supabase/migrations').split('\n').filter(f=>f.endsWith('.sql'));
  const files=paths.map(file=>({file,blob:git('rev-parse',`HEAD:${file}`),sha256:sha256(execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8',maxBuffer:8*1024*1024}))}));
  const baseline=JSON.parse(sql('select row_to_json(b) from development_metadata.baselines b;'));
  if(baseline.id!==config.baselineId||baseline.source_commit!==config.sourceIntegrationSha)throw Error('Wrong canonical development baseline identity');
  const post=JSON.parse(sql("select coalesce(json_agg(m order by applied_at),'[]') from development_metadata.migrations m;"));
  const expected=post.at(-1)?.schema_fingerprint||baseline.fingerprint;
  const result=compareBaselineState({files,baseline,postMigrations:post,ledger:ledger.migrations,schemaFingerprint:{expected,actual:schemaFingerprint('postgres')}});
  const report={...result,environment:config.environment,observedAt:new Date().toISOString(),integrationCommit:git('rev-parse','HEAD'),productionAccess:false};
  if(process.argv.includes('--record'))writeFileSync('development/database/drift-receipt.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(result.status!=='PASS')process.exitCode=1;
}catch(error){console.log(JSON.stringify({status:'BLOCKED',reason:error.status!==undefined?'Local schema/history query failed':error.message,productionAccess:false}));process.exitCode=1;}

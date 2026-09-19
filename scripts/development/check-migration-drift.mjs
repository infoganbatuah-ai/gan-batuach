import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {compareMigrationState} from './migration-drift.mjs';

// Read-only, hard-scoped local Docker query. No connection string, remote DB URL,
// linked Supabase project, migration application or history repair supported.
const exec=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:'pipe',timeout:15000,maxBuffer:16*1024*1024});
const git=(...args)=>exec('git',args).trim();
const config=JSON.parse(readFileSync('config/development-database.json','utf8'));
const ledger=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
const files=git('ls-tree','-r','HEAD','--','supabase/migrations/').split('\n').filter(Boolean).map(line=>{
  const [meta,file]=line.split('\t'),match=file.match(/\/(\d{14})_(.+)\.sql$/);
  if(!match)throw Error(`Invalid migration filename ${file}`);
  return {file,blob:meta.split(' ')[2],version:match[1],name:match[2]};
});
let history=null,dependencyError=null;
try {
  if(config.environment!=='DEVELOPMENT'||config.productionAccessAllowed!==false||config.status!=='READY'||!config.dockerContext)throw Error('Canonical isolated DEVELOPMENT database is not configured/ready');
  if(config.projectId!=='gan-batuach-integration'||config.container!==`supabase_db_${config.projectId}`)throw Error('Unexpected canonical development identity');
  const contexts=JSON.parse(exec('docker',['context','inspect',config.dockerContext]));
  if(!contexts[0]?.Endpoints?.docker?.Host?.startsWith('unix:///'))throw Error('Only a local Unix Docker socket is allowed');
  const labels=JSON.parse(exec('docker',['--context',config.dockerContext,'inspect','--format','{{json .Config.Labels}}',config.container]));
  if(labels?.['com.supabase.cli.project']!==config.projectId)throw Error('Container project identity mismatch');
  const sql="BEGIN READ ONLY; SELECT coalesce(json_agg(row_to_json(m)), '[]'::json) FROM (SELECT version, name, md5(coalesce(statements::text,'')) AS \"statementsDigest\" FROM supabase_migrations.schema_migrations ORDER BY version) m; COMMIT;";
  history=JSON.parse(exec('docker',['--context',config.dockerContext,'exec',config.container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql]).trim());
} catch(error) {
  dependencyError=error.status!==undefined?'Local Docker/database history query failed; no remote fallback':error.message;
}
const result=compareMigrationState({files,ledger:ledger.migrations,history,environment:'DEVELOPMENT'});
console.log(JSON.stringify({...result,observedAt:new Date().toISOString(),gitSha:git('rev-parse','HEAD'),environment:'DEVELOPMENT',dependencyError,productionRead:false,productionWrite:false},null,2));
if(result.status!=='PASS')process.exitCode=1;

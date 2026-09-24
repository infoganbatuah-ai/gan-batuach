import {execFileSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
export const config=JSON.parse(readFileSync(new URL('../../development/database/environment.json',import.meta.url),'utf8'));
export function docker(args,options={}) {
  return execFileSync('docker',['--config',resolve(config.runtimeRoot,'docker'),'--context',config.dockerContext,...args],{encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024,stdio:'pipe',...options});
}
export function assertLocalDatabase() {
  if(config.environment!=='DEVELOPMENT / INTEGRATION'||config.productionAllowed!==false||config.projectId!=='gan-batuach-integration'||config.container!==`supabase_db_${config.projectId}`)throw Error('Forbidden database identity');
  const root=realpathSync(config.runtimeRoot),contexts=JSON.parse(docker(['context','inspect',config.dockerContext]));
  const socket=contexts[0]?.Endpoints?.docker?.Host;
  if(!socket?.startsWith(`unix://${root}/colima/`))throw Error('Docker target is not the dedicated local development socket');
  const c=JSON.parse(docker(['inspect',config.container]))[0];
  if(c.Config.Labels?.['com.supabase.cli.project']!==config.projectId||!c.State.Running)throw Error('Wrong or stopped local Supabase project');
  return c;
}
export function sql(query,{database='postgres',args=[],platformBootstrap=false}={}) {
  assertLocalDatabase();
  if(!['postgres',config.builderDatabase].includes(database))throw Error('Database outside development allowlist');
  if(platformBootstrap&&database!==config.builderDatabase)throw Error('Platform bootstrap privilege is restricted to the empty builder');
  return docker(['exec','-i',config.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',platformBootstrap?'supabase_admin':'postgres','-d',database,...args],{input:query+'\n',timeout:120000});
}

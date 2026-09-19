import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { integrationEnvironment, isGeneratedNextEnv } from './integration-environment.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const git = (...args) => execFileSync('git', args, {cwd:root,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
try {
  if (git('branch','--show-current') !== 'integration/development') throw new Error('Start the canonical integration/development worktree, not main or an isolated feature branch.');
  const generatedTypes = readFileSync(resolve(root,'next-env.d.ts'),'utf8').trim();
  if (!isGeneratedNextEnv(generatedTypes,git('show','HEAD:next-env.d.ts')) || git('diff','--cached','--','next-env.d.ts')) throw new Error('Unexpected next-env.d.ts edit; only unstaged Next-generated development type paths are allowed.');
  if (git('status','--porcelain=v1','-uall','--','.',':(exclude)next-env.d.ts')) throw new Error('Integration snapshot is dirty. Preserve/commit scoped work and reconcile the ledger before preview.');
  for (const name of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local']) {
    if (existsSync(resolve(root,name))) throw new Error(`Unexpected ${name}: never load the Production environment into integration. Use config/integration.local.env only.`);
  }
  const uiOnly = process.argv.includes('--ui-only');
  const localFile = resolve(root,'config/integration.local.env');
  const local = !uiOnly && existsSync(localFile) ? parseEnv(readFileSync(localFile,'utf8')) : {};
  const sha = git('rev-parse','HEAD');
  const env = integrationEnvironment(local,{uiOnly,sha,timestamp:new Date().toISOString(),system:process.env});
  if (!uiOnly) {
    try { execFileSync(process.execPath,[resolve(root,'scripts/development/check-migration-drift.mjs')],{cwd:root,stdio:'pipe'}); }
    catch { throw new Error('Development migration drift/readiness gate failed. Run npm run qa:development-drift; never fall back to Production or label an adapted feature DB as canonical.'); }
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,{
      headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000),redirect:'error',
    });
    if (!response.ok) throw new Error('Local Supabase health failed; no fallback to Production.');
  }
  const port = 3000;
  console.log(`DEVELOPMENT / INTEGRATION ${sha}\nhttp://127.0.0.1:${port}\nBackend: ${env.INTEGRATION_BACKEND}`);
  if (uiOnly) console.log('UI-only: login, database journeys, migrations and camera/provider behavior are NOT VERIFIED.');
  const child = spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,stdio:'inherit'});
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
  child.on('error',()=>{console.error('Unable to start local Next.js; install locked dependencies.');process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
} catch (error) { console.error(`Integration startup BLOCKED: ${error.message}`); process.exitCode=1; }

import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {config,assertLocalDatabase} from './local-database.mjs';
export function localCredentials() {
  assertLocalDatabase();
  const status=JSON.parse(execFileSync('supabase',['status','--workdir',resolve(config.runtimeRoot,'stack'),'--output','json'],{encoding:'utf8',stdio:'pipe',timeout:30000,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,DOCKER_CONFIG:resolve(config.runtimeRoot,'docker'),DOCKER_CONTEXT:config.dockerContext}}));
  if(status.API_URL!==config.apiUrl||!status.ANON_KEY||!status.SERVICE_ROLE_KEY)throw Error('Unexpected isolated local API/credentials');
  return {url:status.API_URL,anon:status.ANON_KEY,service:status.SERVICE_ROLE_KEY};
}
export async function localRequest(path,{token,method='GET',body,raw=false}={}) {
  const keys=localCredentials();
  const response=await fetch(`${keys.url}${path}`,{method,headers:{apikey:keys.anon,...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body),headers:{apikey:keys.anon,...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'}}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});
  return raw?response:{status:response.status,data:await response.json()};
}

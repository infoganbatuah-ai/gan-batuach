import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {config,sql} from './local-database.mjs';
import {localCredentials} from './local-client.mjs';
if(sql("select count(*) from development_metadata.baselines;").trim()!=='1')throw Error('Verified development baseline required');
const keys=localCredentials(),client=createClient(keys.url,keys.service,{auth:{persistSession:false,autoRefreshToken:false}});
const definitions=[['101','parent-a','parent'],['102','parent-b','parent'],['201','manager-a','manager'],['202','manager-b','manager'],['301','staff-a','staff'],['302','staff-b','staff'],['303','staff-ab','staff'],['304','staff-candidate','staff'],['305','staff-revoked','staff'],['401','inspector-a','inspector'],['501','admin','admin'],['f01','observer-a','parent'],['f02','observer-b','parent']];
const file=resolve(config.runtimeRoot,'qa-identities.private.json');
const saved=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{environment:config.environment,users:[]};
if(saved.environment!==config.environment)throw Error('QA credentials file belongs to another environment');
for(const [suffix,name,role] of definitions){
  const id=`00000000-0000-4000-8000-000000000${suffix}`,email=`${name}@integration.qa.invalid`;
  let user=saved.users.find(u=>u.id===id);
  if(!user){user={id,email,role,password:randomBytes(24).toString('base64url')};saved.users.push(user);writeFileSync(file,JSON.stringify(saved,null,2)+'\n',{mode:0o600});}
  const existing=await client.auth.admin.getUserById(id);
  if(existing.data.user){if(existing.data.user.email!==email||existing.data.user.user_metadata?.environment!=='DEVELOPMENT')throw Error('Refusing to take over an existing non-QA identity');continue;}
  if(existing.error?.status!==404)throw Error(`Auth lookup failed for synthetic role ${name}`);
  const {error}=await client.auth.admin.createUser({id,email,password:user.password,email_confirm:true,app_metadata:{role,environment:'DEVELOPMENT'},user_metadata:{full_name:`QA ${name}`,environment:'DEVELOPMENT',...(name.startsWith('observer')?{product:'digital_observer',account_type:'home'}:{})}});
  if(error)throw Error(`QA Auth creation failed (${name}): ${error.message}`);
}
console.log(JSON.stringify({environment:config.environment,identities:saved.users.length,credentials:'Private file outside Git; values not printed',productionAccess:false}));

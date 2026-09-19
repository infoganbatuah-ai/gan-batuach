import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {integrationEnvironment} from '../development/integration-environment.mjs';

test('integration drops inherited provider secrets and live flags',()=>{
  const env=integrationEnvironment({}, {uiOnly:true,sha:'test',timestamp:'test',system:{PATH:'/usr/bin',SUPABASE_SERVICE_ROLE_KEY:'sensitive-test',PRODUCTION_ACTIVATION_APPROVED:'true',OPENAI_API_KEY:'sensitive-test'}});
  assert.equal(env.APP_ENV,'local');assert.equal(env.PRODUCTION_ACTIVATION_APPROVED,'false');
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,undefined);assert.equal(env.OPENAI_API_KEY,undefined);
  assert.equal(env.INTEGRATION_BACKEND,'UNAVAILABLE_UI_ONLY');
});
test('missing, remote, indirect and credential-bearing database targets fail closed',()=>{
  assert.throws(()=>integrationEnvironment({}));
  for(const url of ['https://example.supabase.co','http://localhost:54321','http://127.0.0.1.evil.example','http://user:pass@127.0.0.1:54321','http://127.0.0.1:54321/path']) {
    assert.throws(()=>integrationEnvironment({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test'}));
  }
  assert.doesNotThrow(()=>integrationEnvironment({NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test'}));
});
test('UI-only cannot consume configured credentials; arbitrary env cannot reach child',()=>{
  assert.throws(()=>integrationEnvironment({SUPABASE_SERVICE_ROLE_KEY:'test'},{uiOnly:true}));
  assert.throws(()=>integrationEnvironment({NODE_OPTIONS:'--require=unexpected'}));
});
test('repository policy enables only main, including branches containing slashes',()=>{
  const policy=JSON.parse(readFileSync('vercel.json','utf8')).git.deploymentEnabled;
  assert.deepEqual(policy,{'**':false,main:true});
  const agents=readFileSync('AGENTS.md','utf8');
  assert.match(agents,/There is no scheduled Production release/);
  assert.match(agents,/PUSH 38 remains NOT DONE/);
});
